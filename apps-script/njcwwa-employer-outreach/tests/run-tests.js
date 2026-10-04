'use strict';

const { assert, context, sheets, records } = require('./mock-runtime');

function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.stack}`); process.exitCode = 1; }
}

test('verification is non-sending and passes', () => {
  const output = context.verifyAllianceSetup();
  assert.match(output, /Authenticated Gmail: weldingworkforcealliance@gmail.com/);
  assert.match(output, /Daily new outreach target: 100/);
  assert.match(output, /Verification result: PASS/);
});

test('live safety remains blocked', () => {
  const config = context.getConfig_();
  assert.throws(() => context.assertLiveSendingAllowed_(config), /Campaign Enabled must be Yes/);
});

test('reply parser extracts structured hiring details', () => {
  const queueEntry = context.findFirstRecord_('Campaign Queue', (record) => record['Queue ID'] === 'TEST-Q1');
  const result = context.processEmployerReply_({
    messageId: 'REPLY-1', threadId: 'THREAD-1', internalDate: String(Date.parse('2026-10-04T14:00:00Z')),
    headers: { from: 'Joe Smith <joe@testfabrication.example>', subject: 'Re: Hiring welders?' },
    from: 'joe@testfabrication.example', subject: 'Re: Hiring welders?',
    originalBody: 'We are hiring 3 entry-level MIG welders in Middlesex County on second shift at $24-$28 per hour. AWS D1.1 is preferred. Please call Joe Smith at 732-555-0100. Start date November 15, 2026.',
    queueEntries: [queueEntry]
  });
  assert.strictEqual(result.classification, 'Hiring Now');
  assert.strictEqual(result.information.county, 'Middlesex');
  assert.strictEqual(result.information.openings, 3);
  assert.strictEqual(result.information.entryLevelStatus, 'Yes');
  assert.strictEqual(result.information.shift.toLowerCase(), 'second shift');
  assert.strictEqual(result.information.payMin, 24);
  assert.strictEqual(result.information.payMax, 28);
  assert.ok(result.information.certifications.includes('AWS D1.1'));
  assert.strictEqual(result.information.phone, '732-555-0100');
});

test('genuine reply stops sequence and creates reply, lead, opportunity and task', () => {
  const queue = records('Campaign Queue').find((row) => row['Queue ID'] === 'TEST-Q1');
  assert.strictEqual(queue['Reply Received'], 'Yes'); assert.strictEqual(queue['Stop Sequence'], 'Yes');
  const reply = records('Replies').find((row) => row['Employer ID'] === 'TEST-E1');
  assert.ok(reply); assert.match(reply['Original Reply'], /3 entry-level MIG welders/); assert.strictEqual(reply['County'], 'Middlesex'); assert.strictEqual(reply['Openings'], 3);
  const lead = records('Leads').find((row) => row['Employer ID'] === 'TEST-E1'); assert.ok(lead); assert.strictEqual(lead['Lead Stage'], 'Hiring Now');
  const opportunity = records('Job Opportunities').find((row) => row['Employer ID'] === 'TEST-E1');
  assert.ok(opportunity); assert.strictEqual(opportunity['County'], 'Middlesex'); assert.strictEqual(opportunity['Openings'], 3); assert.strictEqual(opportunity['Entry Level'], 'Yes'); assert.strictEqual(opportunity['Pay Min'], 24); assert.strictEqual(opportunity['Pay Max'], 28);
  const task = records('Follow-Ups').find((row) => row['Employer ID'] === 'TEST-E1'); assert.ok(task); assert.strictEqual(task['Status'], 'Open');
});

test('message processing is idempotent', () => {
  const queueEntry = context.findFirstRecord_('Campaign Queue', (record) => record['Queue ID'] === 'TEST-Q1');
  const before = records('Replies').length;
  const result = context.processEmployerReply_({messageId:'REPLY-1',threadId:'THREAD-1',internalDate:String(Date.now()),headers:{from:'joe@testfabrication.example',subject:'Re: duplicate'},from:'joe@testfabrication.example',subject:'Re: duplicate',originalBody:'Duplicate reply',queueEntries:[queueEntry]});
  assert.strictEqual(result.skipped, true); assert.strictEqual(records('Replies').length, before);
});

test('unsubscribe creates permanent suppression and no lead', () => {
  const testQueue = {'Queue ID':'NJCWWA-TEST-UNSUB-Q','Campaign ID':'NJCWWA-TEST-UNSUB-C','Employer ID':'NJCWWA-TEST-UNSUB-E','Contact ID':'NJCWWA-TEST-UNSUB-CONT','Company Name':'Unsubscribe Test','Contact Name':'Test','Email':'unsubscribe-test@example.com','Worksite County':'Unknown','Job Family':'General Welder','Approval Status':'Approved','Send Status':'Sent','Reply Received':'No','Stop Sequence':'No','Gmail Thread ID':'UNSUB-THREAD'};
  context.appendRecord_('Campaign Queue', testQueue);
  const entry = context.findFirstRecord_('Campaign Queue', (record) => record['Queue ID'] === testQueue['Queue ID']);
  context.processEmployerReply_({messageId:'UNSUB-REPLY-1',threadId:'UNSUB-THREAD',internalDate:String(Date.now()),headers:{from:'unsubscribe-test@example.com',subject:'Re: Outreach'},from:'unsubscribe-test@example.com',subject:'Re: Outreach',originalBody:'UNSUBSCRIBE. Please remove me from all future outreach.',queueEntries:[entry]});
  const suppression = records('Suppressions').find((row) => row.Email === 'unsubscribe-test@example.com'); assert.ok(suppression); assert.strictEqual(suppression.Permanent, 'Yes');
  const lead = records('Leads').find((row) => row['Employer ID'] === 'NJCWWA-TEST-UNSUB-E'); assert.strictEqual(lead, undefined);
});

if (process.exitCode) process.exit(process.exitCode);
console.log('All NJCWWA automation tests passed.');
