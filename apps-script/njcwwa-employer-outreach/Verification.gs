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
    if (config.dailyNewTarget < 100) throw new Error('Daily New Outreach Target is below the required minimum of 100.');
    if (config.dailyTotalCap < config.dailyNewTarget) throw new Error('Daily Total Send Cap must be at least the Daily New Outreach Target.');
    if (config.messagesPerBatch > 25) warnings.push('Messages Per Batch is above the conservative limit of 25.');
    if (!config.testAllowlist.length) throw new Error('Test Recipient Allowlist is empty.');
    if (isPlaceholderValue_(config.physicalAddress)) warnings.push('Physical Mailing Address is not ready; live sending remains blocked.');
    ['Needs Review','Hiring Now','Future Hiring','Internship','Not Interested','Unsubscribed','Automatic Reply'].forEach(function (suffix) { ensureNJCWWALabel_(suffix); });
    results.push('Gmail labels: ready');
    var triggerCount = listNJCWWATriggers().length;
    results.push('Managed triggers installed: ' + triggerCount);
    if (triggerCount) warnings.push('Managed triggers already exist; confirm this is intentional before testing.');
    var output = results.concat(warnings.map(function (warning) { return 'WARNING: ' + warning; }));
    output.push('Verification result: PASS');
    logAutomation_('verifyAllianceSetup','Completed',1,0,0,'',secondsSince_(started),output.join(' | '));
    console.log(output.join('\n'));
    return output.join('\n');
  } catch (error) {
    logAutomation_('verifyAllianceSetup','Failed',1,0,0,error.message,secondsSince_(started),results.join(' | '));
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
