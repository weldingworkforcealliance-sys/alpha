'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const scanner = read('ReplyScanner.gs');
const processor = read('LeadProcessor.gs');
const store = read('SheetStore.gs');
const triggers = read('Triggers.gs');
const config = read('Config.gs');
const writer = read('LeadWriter.gs');

const checks = [
  [!scanner.includes('Gmail.Users.Threads.get'), 'Scanner must not reread complete Gmail threads.'],
  [scanner.includes('Gmail.Users.History.list'), 'Scanner must use incremental Gmail history.'],
  [scanner.includes("Gmail.Users.Messages.get('me', candidate.id"), 'Scanner must fetch only candidate messages.'],
  [scanner.includes('NJCWWA_REPLY_SCAN_LIMIT = 50'), 'Scanner must cap each run at 50 messages.'],
  [scanner.includes('NJCWWA_REPLY_HISTORY_ID'), 'Scanner must persist a Gmail history cursor.'],
  [scanner.includes('NJCWWA_REPLY_PENDING_MESSAGE_IDS'), 'Scanner must preserve pending messages.'],
  [scanner.includes('NJCWWA_REPLY_BACKOFF_UNTIL'), 'Scanner must persist quota backoff.'],
  [processor.includes("'Gmail Message ID': messageId"), 'Reply records must store immutable Gmail Message IDs.'],
  [processor.includes("'Processing Status': 'Processing'"), 'Reply processing must use durable state.'],
  [processor.includes("'Processing Status': 'Processed'"), 'Reply processing must mark completion.'],
  [processor.includes("'Processing Status': 'Failed'"), 'Reply processing must preserve failures for retry.'],
  [store.includes("NJCWWA.SHEETS.REPLIES"), 'Processed-message set must include Replies.'],
  [store.includes("status === 'processed'"), 'Only processed reply rows may block retry.'],
  [store.includes('boundedCellText_'), 'Sheet writes must bound oversized text.'],
  [store.includes("'Errors': boundedCellText_"), 'Automation log errors must be bounded.'],
  [triggers.includes("everyMinutes(15)"), 'Reply scanner trigger must run every 15 minutes.'],
  [!(/function dailyMaintenance\(\)[\s\S]*?scanEmployerReplies\(/.test(triggers)), 'Daily maintenance must not invoke the scanner again.'],
  [triggers.includes('repairReplyScannerTrigger'), 'A trigger-only repair function must exist.'],
  [writer.includes('Source reply: '), 'Lead/task retry paths must be source-reply idempotent.'],
  [config.includes("VERSION: '2026-10-08.1'"), 'Automation version must be 2026-10-08.1.'],
  [config.includes("'Gmail Message ID'"), 'Required Reply headers must include Gmail Message ID.'],
  [config.includes("'Processing Status'"), 'Required Reply headers must include Processing Status.'],
  [config.includes("'Processing Error'"), 'Required Reply headers must include Processing Error.'],
  [config.includes('Session.getEffectiveUser'), 'Account guard should avoid unnecessary Gmail profile quota.'],
  [config.includes('isGmailQuotaError_'), 'Quota errors must retain their real meaning.']
];

let failed = false;
for (const [passed, message] of checks) {
  if (passed) console.log(`PASS ${message}`);
  else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}
if (failed) process.exit(1);
console.log(`Reply-scanner regression checks passed: ${checks.length}.`);
