/** Sequence stopping and structured Lead, Opportunity, and follow-up writes. */
function stopSequencesForReply_(queueEntries, isFailure) {
  var campaignId = safeString_(queueEntries[0].record['Campaign ID']);
  var contactId = safeString_(queueEntries[0].record['Contact ID']);
  var email = normalizeEmail_(queueEntries[0].record['Email']);
  var threadId = safeString_(queueEntries[0].record['Gmail Thread ID']);
  getRecords_(NJCWWA.SHEETS.QUEUE).forEach(function (entry) {
    var record = entry.record;
    var sameContact = contactId && safeString_(record['Contact ID']) === contactId;
    var sameEmail = email && normalizeEmail_(record['Email']) === email;
    var sameCampaign = !campaignId || safeString_(record['Campaign ID']) === campaignId;
    var sameThread = threadId && safeString_(record['Gmail Thread ID']) === threadId;
    if (!((sameContact || sameEmail) && sameCampaign) && !sameThread) return;
    var patch = { 'Reply Received': 'Yes', 'Stop Sequence': 'Yes' };
    var status = safeString_(record['Send Status']).toLowerCase();
    if (status === 'queued' || status === 'scheduled') patch['Send Status'] = 'Stopped';
    if (isFailure && status === 'sent') patch['Error / Notes'] = appendNote_(record['Error / Notes'], 'Delivery failure detected.');
    updateRecordRow_(NJCWWA.SHEETS.QUEUE, entry.rowNumber, patch);
  });
}

function upsertLeadFromReply_(replyId, queue, classification, info, receivedAt, config) {
  var employerId = safeString_(queue['Employer ID']);
  var email = normalizeEmail_(queue['Email']);
  var existing = findFirstRecord_(NJCWWA.SHEETS.LEADS, function (record) {
    var sameEmployer = employerId && safeString_(record['Employer ID']) === employerId;
    var sameEmail = email && normalizeEmail_(record['Email']) === email;
    var closed = ['closed', 'not interested'].indexOf(safeString_(record['Lead Stage']).toLowerCase()) !== -1;
    return sameEmployer && sameEmail && !closed;
  });
  var leadId = existing ? safeString_(existing.record['Lead ID']) : makeId_('LEAD');
  var sourceNote = 'Source reply: ' + replyId;
  var existingNotes = existing ? safeString_(existing.record['Notes']) : '';
  var notes = existingNotes.indexOf(sourceNote) === -1 ? appendNote_(existingNotes, sourceNote) : existingNotes;
  var leadRecord = {
    'Lead ID': leadId,
    'Employer ID': employerId,
    'Company Name': queue['Company Name'] || '',
    'Primary Contact': queue['Contact Name'] || info.hiringContact || '',
    'Email': email,
    'Phone': info.phone || '',
    'Worksite County': info.county || queue['Worksite County'] || 'Unknown',
    'Lead Stage': leadStageForClassification_(classification.primary),
    'Lead Type': classification.primary,
    'Job Type(s)': info.jobTypes.join('; '),
    'Openings': info.openings || '',
    'Entry Level': info.entryLevelStatus,
    'Internship': info.internshipStatus,
    'Apprenticeship': info.apprenticeshipStatus,
    'Hiring Timeframe': classification.hiringNow ? info.hiringDate || 'Immediate' : classification.futureHiring ? info.hiringDate || 'Future' : '',
    'Assigned To': config.defaultLeadOwner,
    'First Positive Reply': existing ? existing.record['First Positive Reply'] || receivedAt : receivedAt,
    'Last Activity': receivedAt,
    'Next Action': info.nextStep,
    'Follow-Up Date': nextBusinessDate_(receivedAt, 1),
    'Lead Score': calculateLeadScore_(classification, info),
    'Review Status': 'Needs Review',
    'Notes': notes
  };
  if (existing) updateRecordRow_(NJCWWA.SHEETS.LEADS, existing.rowNumber, leadRecord);
  else appendRecord_(NJCWWA.SHEETS.LEADS, leadRecord);
  return leadId;
}

function maybeCreateOpportunity_(replyId, leadId, queue, classification, info, receivedAt) {
  var signal = classification.hiringNow || classification.futureHiring || classification.internship || classification.apprenticeship || Boolean(info.openings);
  if (!signal || !leadId) return '';
  var existing = findFirstRecord_(NJCWWA.SHEETS.OPPORTUNITIES, function (record) {
    return safeString_(record['Source Reply ID']) === replyId;
  });
  if (existing) return safeString_(existing.record['Opportunity ID']);
  var jobType = info.jobTypes[0] || safeString_(queue['Job Family']) || 'Other';
  var employmentType = info.internshipStatus === 'Yes' ? 'Internship' : info.apprenticeshipStatus === 'Yes' ? 'Apprenticeship' : 'Unknown';
  var opportunityId = makeId_('OPP');
  appendRecord_(NJCWWA.SHEETS.OPPORTUNITIES, {
    'Opportunity ID': opportunityId,
    'Lead ID': leadId,
    'Employer ID': queue['Employer ID'] || '',
    'Company Name': queue['Company Name'] || '',
    'Original Job Title': jobType,
    'Standard Job Type': jobType,
    'Career Level': info.entryLevelStatus === 'Yes' ? 'Entry Level' : 'Unknown',
    'Welding Process(es)': info.processes.join('; '),
    'Openings': info.openings || '',
    'Employment Type': employmentType,
    'Entry Level': info.entryLevelStatus,
    'Internship': info.internshipStatus,
    'Apprenticeship': info.apprenticeshipStatus,
    'Experience Required': info.experience,
    'Certifications': info.certifications.join('; '),
    'Worksite Address': '',
    'City': info.city,
    'ZIP': info.zip,
    'County': info.county || queue['Worksite County'] || 'Unknown',
    'County Source': info.countySource || 'Campaign Record',
    'Shift': info.shift,
    'Pay Min': info.payMin,
    'Pay Max': info.payMax,
    'Pay Type': info.payType,
    'Benefits': info.benefits,
    'Anticipated Start': info.hiringDate,
    'Application Method': info.nextStep,
    'Application Contact': info.hiringContact || queue['Contact Name'] || '',
    'Permission to Share': 'Unknown',
    'Status': 'Needs Review',
    'Date Received': receivedAt,
    'Last Confirmed': receivedAt,
    'Expiration Review Date': nextBusinessDate_(receivedAt, 30),
    'Source Reply ID': replyId,
    'Notes': 'Employer reply pay/details: ' + (info.payText || 'Not supplied')
  });
  return opportunityId;
}

function createReviewTask_(replyId, leadId, queue, classification, info, receivedAt, config) {
  if (!leadId) return;
  var sourceMarker = 'Source reply: ' + replyId;
  var existing = findFirstRecord_(NJCWWA.SHEETS.FOLLOW_UPS, function (record) {
    return safeString_(record['Lead ID']) === safeString_(leadId) && safeString_(record['Notes']).indexOf(sourceMarker) !== -1;
  });
  if (existing) return safeString_(existing.record['Task ID']);
  var taskId = makeId_('TASK');
  appendRecord_(NJCWWA.SHEETS.FOLLOW_UPS, {
    'Task ID': taskId,
    'Lead ID': leadId,
    'Employer ID': queue['Employer ID'] || '',
    'Company Name': queue['Company Name'] || '',
    'Contact': queue['Contact Name'] || info.hiringContact || '',
    'Task Type': 'Review Employer Reply',
    'Due Date': nextBusinessDate_(receivedAt, 1),
    'Due Time': '9:00 AM',
    'Priority': classification.hiringNow ? 'Urgent' : 'High',
    'Owner': config.defaultLeadOwner,
    'Status': 'Open',
    'Draft Subject': '',
    'Draft Body': '',
    'Gmail Draft ID': '',
    'Completed At': '',
    'Notes': sourceMarker + ' | Classification: ' + classification.primary + (info.additionalInformation ? ' | ' + info.additionalInformation : '')
  });
  return taskId;
}
