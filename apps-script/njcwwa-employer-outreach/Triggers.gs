/**
 * Trigger management and follow-up scheduling.
 * These functions are never called automatically during installation.
 */

function installNJCWWATriggers() {
  assertAllianceAccount_();
  assertRequiredSheets_();
  var config = getConfig_();
  if (!config.testMode) assertLiveSendingAllowed_(config);
  removeNJCWWATriggers();
  ScriptApp.newTrigger('runOutreachCycle').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('scanEmployerReplies').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('dailyMaintenance').timeBased().atHour(7).nearMinute(15).everyDays(1).create();
  logAutomation_('installNJCWWATriggers','Completed',3,3,0,'',0,'Outreach checks every 15 minutes; reply scan every 10 minutes; maintenance near 7:15 AM.');
  return listNJCWWATriggers();
}

function removeNJCWWATriggers() {
  assertAllianceAccount_();
  var deleted = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (NJCWWA.MANAGED_TRIGGER_FUNCTIONS.indexOf(trigger.getHandlerFunction()) !== -1) { ScriptApp.deleteTrigger(trigger); deleted++; }
  });
  return deleted;
}

function listNJCWWATriggers() {
  return ScriptApp.getProjectTriggers().filter(function (trigger) { return NJCWWA.MANAGED_TRIGGER_FUNCTIONS.indexOf(trigger.getHandlerFunction()) !== -1; }).map(function (trigger) {
    return { handler:trigger.getHandlerFunction(), eventType:String(trigger.getEventType()), source:String(trigger.getTriggerSource()), uniqueId:trigger.getUniqueId() };
  });
}

function dailyMaintenance() {
  var started = new Date();
  assertAllianceAccount_();
  assertRequiredSheets_();
  var created = scheduleDueFollowUps_();
  var replyResult = scanEmployerReplies();
  logAutomation_('dailyMaintenance','Completed',0,created,0,'',secondsSince_(started),'Follow-ups created: ' + created + ' | Replies processed: ' + (replyResult && replyResult.processed || 0));
  return { followUpsCreated:created, replyResult:replyResult };
}

function scheduleDueFollowUps_() {
  var config = getConfig_(); var queue = getRecords_(NJCWWA.SHEETS.QUEUE); var templates = getActiveTemplateMap_(); var suppressed = getSuppressedEmailSet_(); var now = new Date(); var created = 0; var existingKeys = {}; var firstTouchByKey = {};
  queue.forEach(function (entry) {
    var record = entry.record; var key = safeString_(record['Campaign ID']) + '|' + safeString_(record['Contact ID']); var touch = Number(record['Touch Number'] || 1);
    existingKeys[key + '|' + touch] = true;
    if (touch === 1 && safeString_(record['Send Status']).toLowerCase() === 'sent' && record['Sent At']) firstTouchByKey[key] = entry;
  });
  Object.keys(firstTouchByKey).forEach(function (key) {
    var initialEntry = firstTouchByKey[key]; var initial = initialEntry.record; var email = normalizeEmail_(initial['Email']);
    if (!email || suppressed[email] || yes_(initial['Reply Received']) || yes_(initial['Stop Sequence'])) return;
    var sentAt = initial['Sent At'] instanceof Date ? initial['Sent At'] : new Date(initial['Sent At']);
    if (isNaN(sentAt.getTime())) return;
    var elapsed = businessDaysBetween_(sentAt, now); var touch = 0; var templateId = '';
    if (elapsed >= config.followUp1Delay && !existingKeys[key + '|2']) { touch = 2; templateId = 'TPL-FU1'; }
    else if (elapsed >= config.followUp2Delay && existingKeys[key + '|2'] && !existingKeys[key + '|3'] && config.maximumFollowUps >= 2) { touch = 3; templateId = 'TPL-FU2'; }
    if (!touch || !templates[templateId]) return;
    appendRecord_(NJCWWA.SHEETS.QUEUE, {
      'Queue ID':makeId_('Q'),'Campaign ID':initial['Campaign ID'],'Employer ID':initial['Employer ID'],'Contact ID':initial['Contact ID'],'Company Name':initial['Company Name'],'Contact Name':initial['Contact Name'],'Email':email,'Worksite County':initial['Worksite County'],'Job Family':initial['Job Family'],'Template ID':templateId,'Subject':templates[templateId].subject,'Scheduled Date':nextBusinessDate_(now,0),'Scheduled Time':'9:00 AM','Touch Number':touch,'Priority':'Normal','Approval Status':'Approved','Send Status':'Queued','Reply Received':'No','Stop Sequence':'No','Error / Notes':'Automatically scheduled from initial queue record ' + initial['Queue ID']
    });
    existingKeys[key + '|' + touch] = true; created++;
  });
  return created;
}
