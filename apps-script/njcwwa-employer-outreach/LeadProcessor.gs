/** Reply ingestion and idempotent dispatch. */
function processEmployerReply_(context) {
  var messageId = safeString_(context.messageId);
  if (!messageId) throw new Error('Incoming Gmail Message ID is required for reply processing.');

  var existingReply = findReplyByMessageId_(messageId);
  if (existingReply && safeString_(existingReply.record['Processing Status']).toLowerCase() === 'processed') {
    return { skipped: true, reason: 'Message already processed: ' + messageId, replyId: existingReply.record['Reply ID'] };
  }

  var queueEntries = context.queueEntries || [];
  if (!queueEntries.length) throw new Error('Reply has no matching Campaign Queue record.');

  var primaryEntry = queueEntries[0];
  var queue = primaryEntry.record;
  var fullOriginalBody = String(context.originalBody || '');
  var fullCleanBody = cleanReplyText_(fullOriginalBody);
  var headers = context.headers || {};
  var from = normalizeEmail_(context.from || extractEmail_(headers.from || queue['Email']));
  var subject = safeString_(context.subject || headers.subject);
  var classification = classifyReply_(subject, fullCleanBody, headers, from);
  var info = extractReplyInformation_(fullCleanBody, queue);
  var receivedAt = context.internalDate ? new Date(Number(context.internalDate)) : new Date();
  if (isNaN(receivedAt.getTime())) receivedAt = new Date();

  var config = getConfig_();
  var replyId = existingReply ? safeString_(existingReply.record['Reply ID']) : makeId_('RPL');
  var archiveId = existingReply ? safeString_(existingReply.record['Archive ID']) : '';
  if (!archiveId && fullOriginalBody.length > 30000) {
    archiveId = archiveReplyBody_(messageId, context.threadId, replyId, queue, from, subject, fullOriginalBody);
  }

  var originalBody = boundedCellText_(fullOriginalBody, 30000, '\n\n[Full original reply archived as ' + (archiveId || 'external archive unavailable') + ']');
  var cleanBody = boundedCellText_(fullCleanBody, 12000);
  var positive = isPositiveClassification_(classification.primary);
  var replyRecord = {
    'Reply ID': replyId,
    'Received At': receivedAt,
    'Employer ID': queue['Employer ID'] || '',
    'Contact ID': queue['Contact ID'] || '',
    'Company Name': queue['Company Name'] || '',
    'Contact Email': from || queue['Email'] || '',
    'Gmail Thread ID': context.threadId || queue['Gmail Thread ID'] || '',
    'Subject': subject,
    'Original Reply': originalBody,
    'Clean Reply': cleanBody,
    'Primary Classification': classification.primary,
    'Positive': positive ? 'Yes' : 'No',
    'Hiring Now': classification.hiringNow ? 'Yes' : 'No',
    'Future Hiring': classification.futureHiring ? 'Yes' : 'No',
    'Entry Level': info.entryLevelStatus,
    'Internship': info.internshipStatus,
    'Apprenticeship': info.apprenticeshipStatus,
    'Worksite City': info.city,
    'Worksite ZIP': info.zip,
    'County': info.county,
    'County Source': info.countySource,
    'Job Type(s)': info.jobTypes.join('; '),
    'Openings': info.openings || '',
    'Welding Processes': info.processes.join('; '),
    'Experience': info.experience,
    'Certifications': info.certifications.join('; '),
    'Shift': info.shift,
    'Pay': info.payText,
    'Benefits': info.benefits,
    'Hiring Date': info.hiringDate,
    'Preferred Next Step': info.nextStep,
    'Hiring Contact': info.hiringContact,
    'Phone': info.phone,
    'Additional Information': info.additionalInformation,
    'Extraction Confidence': info.confidence,
    'Human Review Status': existingReply ? existingReply.record['Human Review Status'] || 'Needs Review' : 'Needs Review',
    'Assigned To': config.defaultLeadOwner,
    'Outreach Email': queue['Email'] || '',
    'Queue ID': queue['Queue ID'] || '',
    'Archive ID': archiveId,
    'Processing Status': 'Processing',
    'Processing Error': '',
    'Gmail Message ID': messageId
  };

  var replyRow;
  if (existingReply) {
    replyRow = existingReply.rowNumber;
    updateRecordRow_(NJCWWA.SHEETS.REPLIES, replyRow, replyRecord);
  } else {
    replyRow = appendRecord_(NJCWWA.SHEETS.REPLIES, replyRecord);
  }

  try {
    if (classification.isBounce) {
      stopSequencesForReply_(queueEntries, true);
      addSuppression_(queue['Email'], queue['Employer ID'], queue['Company Name'], 'Hard Bounce', 'Gmail Delivery Notice', boundedCellText_(cleanBody, 4000));
      queueEntries.forEach(function (entry) {
        updateRecordRow_(NJCWWA.SHEETS.QUEUE, entry.rowNumber, {
          'Send Status': 'Failed',
          'Reply Received': 'Yes',
          'Stop Sequence': 'Yes',
          'Error / Notes': appendNote_(entry.record['Error / Notes'], 'Bounce detected: ' + classification.primary)
        });
      });
    } else if (classification.primary === 'Unsubscribe') {
      stopSequencesForReply_(queueEntries, true);
      addSuppression_(from || queue['Email'], queue['Employer ID'], queue['Company Name'], 'Unsubscribe', 'Employer Reply', boundedCellText_(cleanBody, 4000));
    } else if (!classification.isAutomatic) {
      stopSequencesForReply_(queueEntries, false);
    }

    var leadId = '';
    if (shouldCreateLead_(classification.primary)) {
      leadId = upsertLeadFromReply_(replyId, queue, classification, info, receivedAt, config);
      maybeCreateOpportunity_(replyId, leadId, queue, classification, info, receivedAt);
      createReviewTask_(replyId, leadId, queue, classification, info, receivedAt, config);
    }

    updateRecordRow_(NJCWWA.SHEETS.REPLIES, replyRow, {
      'Processing Status': 'Processed',
      'Processing Error': ''
    });

    if (!hasEmailActivityForMessage_(messageId, classification.isBounce ? 'Bounce' : 'Reply')) {
      try {
        logEmailActivity_({
          timestamp: receivedAt,
          queueId: queue['Queue ID'],
          campaignId: queue['Campaign ID'],
          employerId: queue['Employer ID'],
          contactId: queue['Contact ID'],
          email: from || queue['Email'],
          eventType: classification.isBounce ? 'Bounce' : 'Reply',
          threadId: context.threadId || queue['Gmail Thread ID'],
          messageId: messageId,
          details: classification.primary
        });
      } catch (activityError) {
        logAutomation_('logEmailActivity', 'Failed', 1, 0, 0, compactError_(activityError), 0, 'Core reply processing completed for Gmail message ' + messageId + '.');
      }
    }

    try {
      applyReplyLabel_(messageId, classification);
    } catch (labelError) {
      logAutomation_('applyReplyLabel', 'Failed', 1, 0, 0, compactError_(labelError), 0, 'Message ID: ' + messageId);
    }

    return {
      replyId: replyId,
      leadId: leadId,
      classification: classification.primary,
      positive: positive,
      information: info
    };
  } catch (error) {
    updateRecordRow_(NJCWWA.SHEETS.REPLIES, replyRow, {
      'Processing Status': 'Failed',
      'Processing Error': compactError_(error)
    });
    throw error;
  }
}
