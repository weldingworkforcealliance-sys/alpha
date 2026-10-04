/** Reply ingestion and dispatch. */
function processEmployerReply_(context) {
  var messageId = safeString_(context.messageId);
  if (messageId && getProcessedMessageIdSet_()[messageId]) return { skipped: true, reason: 'Message already processed: ' + messageId };
  var queueEntries = context.queueEntries || [];
  if (!queueEntries.length) throw new Error('Reply has no matching Campaign Queue record.');
  var primaryEntry = queueEntries[0]; var queue = primaryEntry.record;
  var originalBody = String(context.originalBody || ''); var cleanBody = cleanReplyText_(originalBody); var headers = context.headers || {};
  var from = normalizeEmail_(context.from || extractEmail_(headers.from || queue['Email'])); var subject = safeString_(context.subject || headers.subject);
  var classification = classifyReply_(subject, cleanBody, headers, from); var info = extractReplyInformation_(cleanBody, queue);
  var receivedAt = context.internalDate ? new Date(Number(context.internalDate)) : new Date(); if (isNaN(receivedAt.getTime())) receivedAt = new Date();
  var config = getConfig_(); var replyId = makeId_('RPL'); var positive = isPositiveClassification_(classification.primary);
  appendRecord_(NJCWWA.SHEETS.REPLIES, {
    'Reply ID':replyId,'Received At':receivedAt,'Employer ID':queue['Employer ID']||'','Contact ID':queue['Contact ID']||'','Company Name':queue['Company Name']||'','Contact Email':from||queue['Email']||'','Gmail Thread ID':context.threadId||queue['Gmail Thread ID']||'','Subject':subject,'Original Reply':originalBody,'Clean Reply':cleanBody,'Primary Classification':classification.primary,'Positive':positive?'Yes':'No','Hiring Now':classification.hiringNow?'Yes':'No','Future Hiring':classification.futureHiring?'Yes':'No','Entry Level':info.entryLevelStatus,'Internship':info.internshipStatus,'Apprenticeship':info.apprenticeshipStatus,'Worksite City':info.city,'Worksite ZIP':info.zip,'County':info.county,'County Source':info.countySource,'Job Type(s)':info.jobTypes.join('; '),'Openings':info.openings||'','Welding Processes':info.processes.join('; '),'Experience':info.experience,'Certifications':info.certifications.join('; '),'Shift':info.shift,'Pay':info.payText,'Benefits':info.benefits,'Hiring Date':info.hiringDate,'Preferred Next Step':info.nextStep,'Hiring Contact':info.hiringContact,'Phone':info.phone,'Additional Information':info.additionalInformation,'Extraction Confidence':info.confidence,'Human Review Status':'Needs Review','Assigned To':config.defaultLeadOwner
  });
  logEmailActivity_({timestamp:receivedAt,queueId:queue['Queue ID'],campaignId:queue['Campaign ID'],employerId:queue['Employer ID'],contactId:queue['Contact ID'],email:from||queue['Email'],eventType:classification.isBounce?'Bounce':'Reply',threadId:context.threadId||queue['Gmail Thread ID'],messageId:messageId,details:classification.primary});
  if (classification.isBounce) {
    stopSequencesForReply_(queueEntries,true); addSuppression_(queue['Email'],queue['Employer ID'],queue['Company Name'],'Hard Bounce','Gmail Delivery Notice',cleanBody);
    queueEntries.forEach(function(entry){updateRecordRow_(NJCWWA.SHEETS.QUEUE,entry.rowNumber,{'Send Status':'Failed','Reply Received':'Yes','Stop Sequence':'Yes','Error / Notes':appendNote_(entry.record['Error / Notes'],'Bounce detected: '+classification.primary)});});
  } else if (classification.primary === 'Unsubscribe') { stopSequencesForReply_(queueEntries,true); addSuppression_(from||queue['Email'],queue['Employer ID'],queue['Company Name'],'Unsubscribe','Employer Reply',cleanBody); }
  else if (!classification.isAutomatic) stopSequencesForReply_(queueEntries,false);
  var leadId='';
  if (shouldCreateLead_(classification.primary)) { leadId=upsertLeadFromReply_(replyId,queue,classification,info,receivedAt,config); maybeCreateOpportunity_(replyId,leadId,queue,classification,info,receivedAt); createReviewTask_(leadId,queue,classification,info,receivedAt,config); }
  try { applyReplyLabel_(messageId,classification); } catch(labelError) { logAutomation_('applyReplyLabel','Failed',1,0,0,labelError.message,0,'Message ID: '+messageId); }
  return {replyId:replyId,leadId:leadId,classification:classification.primary,positive:positive,information:info};
}
