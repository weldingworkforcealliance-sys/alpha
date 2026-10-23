'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter((name) => name.endsWith('.gs')).sort();
const forbidden = [
  { pattern: /torrikoppenaal@gmail\.com/i, message: 'Torri Gmail must never appear in automation code.' },
  { pattern: /\beval\s*\(/, message: 'eval is not allowed.' },
  { pattern: /new\s+Function\s*\(/, message: 'Dynamic Function construction is not allowed.' },
  { pattern: /\bMailApp\./, message: 'MailApp is not allowed; use Advanced Gmail API.' },
  { pattern: /\bGmailApp\./, message: 'GmailApp is not allowed; use Advanced Gmail API.' },
  { pattern: /\?\?/, message: 'Nullish coalescing is excluded for conservative Apps Script compatibility.' }
];

let failed = false;
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) {
      failed = true;
      console.error(`FAIL lint ${file}: ${rule.message}`);
    }
  }
}

const combined = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const required = [
  'weldingworkforcealliance@gmail.com',
  'Campaign Enabled',
  'Test Mode',
  'Live Launch Authorized',
  'assertAllianceAccount_',
  'assertLiveSendingAllowed_',
  'Stop Sequence',
  'Suppressions'
];
for (const token of required) {
  if (!combined.includes(token)) {
    failed = true;
    console.error(`FAIL lint: required safety token missing: ${token}`);
  }
}

if (failed) process.exit(1);
console.log(`Static safety lint passed for ${files.length} Apps Script files.`);
