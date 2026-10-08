'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const properties = new Map();
const processed = new Set();
const processedCalls = [];
const logs = [];
let phase = 'bootstrap';
let quotaThrown = false;

const propertyStore = {
  getProperty(key) { return properties.has(key) ? properties.get(key) : null; },
  setProperty(key, value) { properties.set(key, String(value)); },
  deleteProperty(key) { properties.delete(key); }
};

const queueEntry = {
  rowNumber: 2,
  record: {
    'Gmail Thread ID': 'thread-1',
    'Gmail Message ID': 'outgoing-1',
    'Send Status': 'Sent',
    'Sent At': new Date('2026-10-08T13:00:00Z'),
    'Queue ID': 'Q-1',
    'Campaign ID': 'C-1',
    'Employer ID': 'E-1',
    'Contact ID': 'CT-1',
    'Company Name': 'Test Fabricator',
    'Email': 'hire@example.com'
  }
};

const fullMessage = (id, historyId) => ({
  id,
  threadId: 'thread-1',
  historyId: String(historyId),
  internalDate: String(new Date('2026-10-08T14:00:00Z').getTime()),
  payload: {
    mimeType: 'text/plain',
    headers: [
      { name: 'From', value: 'Hiring Manager <hire@example.com>' },
      { name: 'Subject', value: 'Re: NJCWWA' }
    ],
    body: { data: Buffer.from('We are hiring two welders.').toString('base64url') }
  }
});

const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  isNaN,
  isFinite,
  NJCWWA: {
    SENDER_EMAIL: 'weldingworkforcealliance@gmail.com',
    SHEETS: { QUEUE: 'Campaign Queue' }
  },
  PropertiesService: { getScriptProperties: () => propertyStore },
  Gmail: {
    Users: {
      getProfile() { return { emailAddress: 'weldingworkforcealliance@gmail.com', historyId: '100' }; },
      Messages: {
        list() {
          return phase === 'bootstrap' ? { messages: [{ id: 'incoming-1', threadId: 'thread-1' }] } : { messages: [] };
        },
        get(_user, id) {
          if (phase === 'quota' && id === 'incoming-2' && !quotaThrown) {
            quotaThrown = true;
            throw new Error("Quota exceeded for quota metric 'Total Query Cost'");
          }
          return fullMessage(id, id === 'incoming-2' ? 102 : 100);
        }
      },
      History: {
        list() {
          if (phase === 'empty') return { historyId: '101', history: [] };
          if (phase === 'quota') {
            return {
              historyId: '102',
              history: [{ messagesAdded: [{ message: { id: 'incoming-2', threadId: 'thread-1' } }] }]
            };
          }
          throw new Error('Unexpected history phase: ' + phase);
        }
      }
    }
  },
  Utilities: {
    newBlob(value) {
      return {
        getDataAsString() {
          if (Array.isArray(value) || Buffer.isBuffer(value)) return Buffer.from(value).toString('utf8');
          return String(value);
        }
      };
    },
    base64DecodeWebSafe(value) { return Buffer.from(value, 'base64url'); }
  },
  withScriptLock_: (callback) => callback(),
  assertAllianceAccount_: () => 'weldingworkforcealliance@gmail.com',
  assertRequiredSheets_: () => true,
  assertRequiredHeaders_: () => true,
  getRecords_: (sheet) => sheet === 'Campaign Queue' ? [queueEntry] : [],
  getProcessedMessageIdSet_: () => Object.fromEntries([...processed].map((id) => [id, true])),
  processEmployerReply_: (input) => {
    processed.add(input.messageId);
    processedCalls.push(input.messageId);
    return { replyId: 'R-' + input.messageId };
  },
  logAutomation_: (...args) => logs.push(args),
  secondsSince_: () => 0.1,
  compactError_: (error) => error && error.message ? error.message : String(error),
  boundedCellText_: (value, limit) => String(value || '').slice(0, limit || 8000),
  isGmailQuotaError_: (error) => /quota exceeded/i.test(error && error.message ? error.message : String(error)),
  safeString_: (value) => value === null || value === undefined ? '' : String(value).trim(),
  normalizeEmail_: (value) => value === null || value === undefined ? '' : String(value).trim().toLowerCase(),
  extractEmail_: (value) => {
    const match = String(value || '').match(/<([^>]+)>|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    return match ? String(match[1] || match[2]).toLowerCase() : '';
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'ReplyScanner.gs'), 'utf8'), context);

phase = 'bootstrap';
let result = context.scanEmployerRepliesNow();
assert.strictEqual(result.processed, 1, 'Bootstrap should process one matching incoming message.');
assert.deepStrictEqual(processedCalls, ['incoming-1']);
assert.strictEqual(properties.get('NJCWWA_REPLY_HISTORY_ID'), '100');

phase = 'empty';
result = context.scanEmployerRepliesNow();
assert.strictEqual(result.processed, 0, 'Empty history should not reprocess prior messages.');
assert.deepStrictEqual(processedCalls, ['incoming-1']);
assert.strictEqual(properties.get('NJCWWA_REPLY_HISTORY_ID'), '101');

phase = 'quota';
result = context.scanEmployerRepliesNow();
assert.strictEqual(result.quotaBackoff, true, 'Quota error should enter durable backoff.');
assert.ok(properties.get('NJCWWA_REPLY_PENDING_MESSAGE_IDS').includes('incoming-2'), 'Quota-failed message must remain pending.');
assert.ok(Number(properties.get('NJCWWA_REPLY_BACKOFF_UNTIL')) > Date.now(), 'Backoff deadline must be stored.');

result = context.scanEmployerRepliesNow();
assert.strictEqual(result.processed, 1, 'Forced retry should process the preserved pending message.');
assert.deepStrictEqual(processedCalls, ['incoming-1', 'incoming-2']);
assert.strictEqual(properties.get('NJCWWA_REPLY_HISTORY_ID'), '102');
assert.strictEqual(properties.has('NJCWWA_REPLY_PENDING_MESSAGE_IDS'), false);
assert.strictEqual(properties.has('NJCWWA_REPLY_BACKOFF_UNTIL'), false);

console.log('Reply-scanner runtime state/cursor/backoff test passed.');
