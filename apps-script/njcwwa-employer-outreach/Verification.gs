/**
 * Non-sending verification and health checks.
 */

function verifyAllianceSetup() {
  var started = new Date();
  var results = [];
  var warnings = [];
  try {
    var email = assertAllianceAccount_();
    results.push('Authenticated Gmail: ' + email);
    var spreadsheet = getSpreadsheet_();
    results.push('Spreadsheet: ' + spreadsheet.getName());
    assertRequiredSheets_();
    results.push('Required tabs: complete');
    assertRequiredHeaders_();
    results.push('Required headers: complete');
    var config = getConfig_();
    results.push('Daily new outreach target: ' + config.dailyNewTarget);
    results.push('Daily total send cap: ' + config.dailyTotalCap);
    results.push('Messages per batch: ' + config.messagesPerBatch);
    results.push('Minutes between batches: ' + config.minutesBetweenBatches);
    results.push('Campaign Enabled: ' + (config.campaignEnabled ? 'Yes' : 'No'));
    results.push('Test Mode: ' + (config.testMode ? 'Yes' : 'No'));
    results.push('Live Launch Authorized: ' + (config.liveLaunchAuthorized ? 'Yes' : 'No'));
    results.push('Automation version: ' + NJCWWA.VERSION);
    if (config.senderEmail !== NJCWWA.SENDER_EMAIL) throw new Error('Configuration Sender Email does not match the locked Alliance account.');
    if (config.dailyNewTarget !== 100) throw new Error('Daily New Outreach Target must equal 100.');
    if (config.dailyTotalCap !== 100) throw new Error('Daily Total Send Cap must equal 100.');
    if (config.campaignEnabled) throw new Error('Campaign Enabled must be No during verification.');
    if (!config.testMode) throw new Error('Test Mode must be Yes during verification.');
    if (config.liveLaunchAuthorized) throw new Error('Live Launch Authorized must be No during verification.');
    results.push('Campaign dates: ' + config.campaignStartDate + ' through ' + config.campaignEndDate);
    if (config.dailyTotalCap < config.dailyNewTarget) throw new Error('Daily Total Send Cap must be at least the Daily New Outreach Target.');
    if (config.messagesPerBatch > 25) warnings.push('Messages Per Batch is above the conservative limit of 25.');
    if (!config.testAllowlist.length) throw new Error('Test Recipient Allowlist is empty.');
    if (isPlaceholderValue_(config.physicalAddress)) warnings.push('Physical Mailing Address is not ready; live sending remains blocked.');
    ['Needs Review','Hiring Now','Future Hiring','Internship','Not Interested','Unsubscribed','Automatic Reply','Bounced'].forEach(function (suffix) { ensureNJCWWALabel_(suffix); });
    results.push('Gmail labels: ready');
    var triggerCount = listNJCWWATriggers().length;
    results.push('Managed triggers installed: ' + triggerCount);
    if (triggerCount) throw new Error('Managed triggers must be absent during pre-launch verification.');
    var testSent = 0; var liveSent = 0;
    getRecords_(NJCWWA.SHEETS.ACTIVITY).forEach(function (entry) {
      if (safeString_(entry.record['Event Type']).toLowerCase() !== 'sent') return;
      if (safeString_(entry.record['Queue ID']).indexOf(NJCWWA.TEST_PREFIX) === 0) testSent++;
      else liveSent++;
    });
    results.push('Test messages sent: ' + testSent);
    results.push('Live employer messages sent: ' + liveSent);
    var output = results.concat(warnings.map(function (warning) { return 'WARNING: ' + warning; }));
    output.push('Verification result: PASS');
    logAutomation_('verifyAllianceSetup','Completed',1,0,0,'',secondsSince_(started),output.join(' | '));
    console.log(output.join('\n'));
    return output.join('\n');
  } catch (error) {
    logAutomation_('verifyAllianceSetup','Failed',1,0,0,compactError_(error),secondsSince_(started),results.join(' | '));
    throw error;
  }
}

function verifyReplyScannerRepair() {
  var started = new Date();
  var results = [];
  try {
    var email = assertAllianceAccount_();
    assertRequiredSheets_();
    assertRequiredHeaders_();
    var replyHeaders = getHeaderMap_(getSheet_(NJCWWA.SHEETS.REPLIES));
    ['Gmail Message ID','Processing Status','Processing Error'].forEach(function (header) {
      if (typeof replyHeaders[header] === 'undefined') throw new Error('Reply scanner repair header missing: ' + header);
    });
    var scannerTriggers = listNJCWWATriggers().filter(function (trigger) { return trigger.handler === 'scanEmployerReplies'; });
    results.push('Authenticated Gmail: ' + email);
    results.push('Automation version: ' + NJCWWA.VERSION);
    results.push('Reply scanner triggers: ' + scannerTriggers.length);
    results.push('Reply message-id columns: ready');
    results.push('Reply scanner mode: incremental Gmail history');
    results.push('Verification result: PASS');
    logAutomation_('verifyReplyScannerRepair','Completed',1,0,0,'',secondsSince_(started),results.join(' | '));
    console.log(results.join('\n'));
    return results.join('\n');
  } catch (error) {
    logAutomation_('verifyReplyScannerRepair','Failed',1,0,0,compactError_(error),secondsSince_(started),results.join(' | '));
    throw error;
  }
}

function getNJCWWAStatus() {
  assertAllianceAccount_();
  var config = getConfig_();
  var dailyStats = getTodaySendStats_(new Date(), config.timeZone);
  var queue = getRecords_(NJCWWA.SHEETS.QUEUE);
  var approvedQueued = queue.filter(function (entry) {
    return safeString_(entry.record['Approval Status']).toLowerCase() === 'approved' && ['queued','scheduled'].indexOf(safeString_(entry.record['Send Status']).toLowerCase()) !== -1;
  }).length;
  return { version:NJCWWA.VERSION, sender:NJCWWA.SENDER_EMAIL, campaignEnabled:config.campaignEnabled, testMode:config.testMode, liveLaunchAuthorized:config.liveLaunchAuthorized, dailyNewTarget:config.dailyNewTarget, dailyTotalCap:config.dailyTotalCap, newSentToday:dailyStats.newSent, totalSentToday:dailyStats.totalSent, approvedQueued:approvedQueued, managedTriggers:listNJCWWATriggers() };
}
