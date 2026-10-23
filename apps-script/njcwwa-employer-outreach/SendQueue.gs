/**
 * Campaign queue preparation and controlled Gmail sending.
 */

function runOutreachCycle() {
  var started = new Date();
  return withScriptLock_(function () {
    var checked = 0; var changed = 0; var sentCount = 0; var errors = [];
    try {
      assertAllianceAccount_(); assertRequiredSheets_(); var config = getConfig_(); var now = new Date();
      if (!config.campaignEnabled) { logAutomation_('runOutreachCycle','Skipped',0,0,0,'',secondsSince_(started),'Campaign Enabled is No.'); return { sent:0, skipped:true, reason:'Campaign Enabled is No.' }; }
      if (!config.testMode) assertLiveSendingAllowed_(config);
      if (config.businessDaysOnly && !isBusinessDay_(now)) return { sent:0, skipped:true, reason:'Not a configured business day.' };
      if (!isWithinSendWindow_(now,config.sendWindowStart,config.sendWindowEnd,config.timeZone)) return { sent:0, skipped:true, reason:'Outside configured send window.' };
      if (!batchIntervalElapsed_(config.minutesBetweenBatches)) return { sent:0, skipped:true, reason:'Batch spacing interval has not elapsed.' };
      var result = sendApprovedBatchInternal_({ config:config, now:now, explicitTest:false });
      checked=result.checked; changed=result.changed; sentCount=result.sent; errors=result.errors; if(sentCount>0) markBatchSent_(now);
      logAutomation_('runOutreachCycle',errors.length?'Completed with errors':'Completed',checked,changed,sentCount,errors.join(' | '),secondsSince_(started),result.details);
      return result;
    } catch(error) { logAutomation_('runOutreachCycle','Failed',checked,changed,sentCount,error.message,secondsSince_(started),''); throw error; }
  });
}

function sendApprovedBatch() {
  var started = new Date();
  return withScriptLock_(function () {
    assertAllianceAccount_(); assertRequiredSheets_(); var config=getConfig_();
    if(!config.campaignEnabled) throw new Error('Campaign Enabled must be Yes before sendApprovedBatch() can run.');
    if(!config.testMode) assertLiveSendingAllowed_(config);
    var result=sendApprovedBatchInternal_({config:config,now:new Date(),explicitTest:false}); if(result.sent>0) markBatchSent_();
    logAutomation_('sendApprovedBatch',result.errors.length?'Completed with errors':'Completed',result.checked,result.changed,result.sent,result.errors.join(' | '),secondsSince_(started),result.details);
    return result;
  });
}

function sendApprovedBatchInternal_(options) {
  var config=options.config||getConfig_(); var now=options.now||new Date(); var explicitTest=Boolean(options.explicitTest);
  assertAllianceAccount_();
  if (!config.testMode) { assertLiveSendingAllowed_(config); assertCampaignSchedule_(now, config); }
  var queue=getRecords_(NJCWWA.SHEETS.QUEUE); var templates=getActiveTemplateMap_(); var contacts=getContactMap_(); var suppressed=getSuppressedEmailSet_();
  var dailyStats=getTodaySendStats_(now,config.timeZone); var totalRemaining=Math.max(0,config.dailyTotalCap-dailyStats.totalSent); var errors=[]; var changed=0; var sentCount=0;
  if(totalRemaining<=0) return {checked:queue.length,changed:0,sent:0,errors:[],details:'Daily total send cap already reached.'};
  var eligible=queue.filter(function(entry){var record=entry.record;var email=normalizeEmail_(record['Email']);var approval=safeString_(record['Approval Status']).toLowerCase();var status=safeString_(record['Send Status']).toLowerCase();if(config.requireApprovedStatus&&approval!=='approved')return false;if(['queued','scheduled'].indexOf(status)===-1)return false;if(Number(record['Touch Number']||1)>config.maximumFollowUps+1)return false;if(yes_(record['Reply Received'])||yes_(record['Stop Sequence']))return false;if(!isValidEmail_(email)||suppressed[email])return false;if(!isQueueRecordDue_(record,now,config.timeZone))return false;if(config.testMode&&config.testAllowlist.indexOf(email)===-1)return false;if(explicitTest&&config.testAllowlist.indexOf(email)===-1)return false;return true;});
  eligible.sort(function(a,b){var touchA=Number(a.record['Touch Number']||1);var touchB=Number(b.record['Touch Number']||1);if(touchA!==touchB)return touchA-touchB;return priorityRank_(a.record['Priority'])-priorityRank_(b.record['Priority']);});
  var batchLimit=Math.min(config.messagesPerBatch,totalRemaining);var newNeeded=Math.max(0,config.dailyNewTarget-dailyStats.newSent);var firstTouches=eligible.filter(function(entry){return Number(entry.record['Touch Number']||1)===1;});var followUps=eligible.filter(function(entry){return Number(entry.record['Touch Number']||1)>1;});var selected=[];
  if(explicitTest) selected=eligible.slice(0,batchLimit); else {if(newNeeded>0)selected=firstTouches.slice(0,Math.min(batchLimit,newNeeded));if(selected.length<batchLimit&&dailyStats.newSent+selected.length>=config.dailyNewTarget)selected=selected.concat(followUps.slice(0,batchLimit-selected.length));if(selected.length<batchLimit&&newNeeded>selected.length)selected=selected.concat(firstTouches.slice(selected.length,batchLimit));if(selected.length<batchLimit&&firstTouches.length<=selected.filter(function(entry){return Number(entry.record['Touch Number']||1)===1;}).length)selected=selected.concat(followUps.slice(0,batchLimit-selected.length));}
  var batchEmails={};
  selected.forEach(function(entry){var record=entry.record;var email=normalizeEmail_(record['Email']);if(batchEmails[email])return;batchEmails[email]=true;try{if(config.testMode)assertTestRecipientAllowed_(email,config);var templateId=safeString_(record['Template ID']);var template=templates[templateId];if(!template)throw new Error('Active template not found: '+templateId);var contact=contacts[safeString_(record['Contact ID'])]||{};var subjectTemplate=safeString_(record['Subject'])||template.subject;var subject=renderTemplate_(subjectTemplate,record,contact,config);var body=buildOutboundBody_(template.body,record,contact,config);var sent=sendRawMessage_(email,subject,body);var sentAt=new Date();updateRecordRow_(NJCWWA.SHEETS.QUEUE,entry.rowNumber,{'Send Status':'Sent','Sent At':sentAt,'Gmail Thread ID':sent.threadId||'','Gmail Message ID':sent.id||'','Error / Notes':''});logEmailActivity_({timestamp:sentAt,queueId:record['Queue ID'],campaignId:record['Campaign ID'],employerId:record['Employer ID'],contactId:record['Contact ID'],email:email,eventType:'Sent',threadId:sent.threadId||'',messageId:sent.id||'',details:'Touch '+Number(record['Touch Number']||1)+' | Template '+templateId});updateLastContact_(record['Employer ID'],record['Contact ID'],sentAt);changed++;sentCount++;Utilities.sleep(1000);}catch(error){updateRecordRow_(NJCWWA.SHEETS.QUEUE,entry.rowNumber,{'Send Status':'Failed','Error / Notes':error.message});logEmailActivity_({timestamp:new Date(),queueId:record['Queue ID'],campaignId:record['Campaign ID'],employerId:record['Employer ID'],contactId:record['Contact ID'],email:email,eventType:'Error',details:error.message});errors.push(email+': '+error.message);}});
  var shortage=Math.max(0,newNeeded-firstTouches.length);
  return {checked:queue.length,changed:changed,sent:sentCount,errors:errors,details:['New sent before batch: '+dailyStats.newSent,'Total sent before batch: '+dailyStats.totalSent,'Eligible first touches: '+firstTouches.length,'Eligible follow-ups: '+followUps.length,shortage?'Approved first-touch shortfall: '+shortage:'No approved first-touch shortfall detected'].join(' | ')};
}

function getTodaySendStats_(now,timeZone){var key=dateKey_(now,timeZone);var totalSent=0;var newSent=0;getRecords_(NJCWWA.SHEETS.ACTIVITY).forEach(function(entry){var record=entry.record;if(safeString_(record['Event Type']).toLowerCase()!=='sent')return;if(safeString_(record['Queue ID']).indexOf(NJCWWA.TEST_PREFIX)===0)return;var timestamp=record['Timestamp'];if(!timestamp)return;var date=timestamp instanceof Date?timestamp:new Date(timestamp);if(isNaN(date.getTime())||dateKey_(date,timeZone)!==key)return;totalSent++;if(/\bTouch 1\b/i.test(safeString_(record['Details'])))newSent++;});return{totalSent:totalSent,newSent:newSent};}

function buildNextOutreachQueue(limit){var started=new Date();assertAllianceAccount_();assertRequiredSheets_();var maximum=positiveInteger_(limit,120);var suppressed=getSuppressedEmailSet_();var existingEmails={};getRecords_(NJCWWA.SHEETS.QUEUE).forEach(function(entry){var email=normalizeEmail_(entry.record['Email']);if(email)existingEmails[email]=true;});getRecords_(NJCWWA.SHEETS.ACTIVITY).forEach(function(entry){var email=normalizeEmail_(entry.record['Email']);if(email)existingEmails[email]=true;});var contacts=getRecords_(NJCWWA.SHEETS.CONTACTS).filter(function(entry){var record=entry.record;var email=normalizeEmail_(record['Email']);if(!isValidEmail_(email)||suppressed[email]||existingEmails[email])return false;if(yes_(record['Do Not Contact']))return false;return true;});contacts.sort(function(a,b){var confirmedA=isPublicConfirmedContact_(a.record)?0:1;var confirmedB=isPublicConfirmedContact_(b.record)?0:1;if(confirmedA!==confirmedB)return confirmedA-confirmedB;return safeString_(a.record['Company Name']).localeCompare(safeString_(b.record['Company Name']));});var employerMap={};getRecords_(NJCWWA.SHEETS.EMPLOYERS).forEach(function(entry){employerMap[safeString_(entry.record['Employer ID'])]=entry.record;});var campaignId='NJCWWA-OUTREACH-'+Utilities.formatDate(new Date(),NJCWWA.TIME_ZONE,'yyyyMMdd');var scheduledDate=nextBusinessDate_(new Date(),0);var rows=[];contacts.slice(0,maximum).forEach(function(entry){var contact=entry.record;var employer=employerMap[safeString_(contact['Employer ID'])]||{};var companyName=safeString_(contact['Company Name'])||safeString_(employer['Company Name']);var contactName=[safeString_(contact['First Name']),safeString_(contact['Last Name'])].filter(Boolean).join(' ');rows.push({'Queue ID':makeId_('Q'),'Campaign ID':campaignId,'Employer ID':contact['Employer ID'],'Contact ID':contact['Contact ID'],'Company Name':companyName,'Contact Name':contactName,'Email':normalizeEmail_(contact['Email']),'Worksite County':contact['Worksite County']||'Unknown','Job Family':employer['Industry']||'Welding / Metal Trades','Template ID':'TPL-INITIAL','Subject':'','Scheduled Date':scheduledDate,'Scheduled Time':getConfig_().sendWindowStart,'Touch Number':1,'Priority':isPublicConfirmedContact_(contact)?'High':'Normal','Approval Status':'Ready for Review','Send Status':'Queued','Reply Received':'No','Stop Sequence':'No','Error / Notes':'Generated automatically. Human approval is still required before sending.'});});appendRecords_(NJCWWA.SHEETS.QUEUE,rows);logAutomation_('buildNextOutreachQueue','Completed',contacts.length,rows.length,0,'',secondsSince_(started),'Created Ready for Review records; no emails sent.');return{available:contacts.length,created:rows.length,campaignId:campaignId};}
