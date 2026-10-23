/**
 * Permanent suppression handling and Gmail label helpers.
 */

function isSuppressed_(email) {
  var set = getSuppressedEmailSet_();
  return Boolean(set[normalizeEmail_(email)]);
}

function detectUnsubscribe_(text) {
  return /\b(unsubscribe|remove me|stop emailing|do not contact|opt[ -]?out|take me off)\b/i.test(String(text || ''));
}

function addSuppression_(email, employerId, companyName, reason, source, notes) {
  var normalized = normalizeEmail_(email);
  if (!normalized) return false;

  var existing = findFirstRecord_(NJCWWA.SHEETS.SUPPRESSIONS, function (record) {
    return normalizeEmail_(record['Email']) === normalized && yes_(record['Permanent']);
  });
  if (existing) return false;

  appendRecord_(NJCWWA.SHEETS.SUPPRESSIONS, {
    'Suppression ID': makeId_('SUP'),
    'Email': normalized,
    'Employer ID': employerId || '',
    'Company Name': companyName || '',
    'Reason': reason || 'Unsubscribe',
    'Source': source || 'Employer Reply',
    'Date Added': new Date(),
    'Permanent': 'Yes',
    'Notes': boundedCellText_(notes || '', 8000)
  });

  markContactDoNotContact_(normalized, employerId);
  return true;
}

function markContactDoNotContact_(email, employerId) {
  getRecords_(NJCWWA.SHEETS.CONTACTS).forEach(function (entry) {
    var sameEmail = normalizeEmail_(entry.record['Email']) === normalizeEmail_(email);
    var sameEmployer = employerId && safeString_(entry.record['Employer ID']) === safeString_(employerId);
    if (sameEmail || sameEmployer && sameEmail) {
      updateRecordRow_(NJCWWA.SHEETS.CONTACTS, entry.rowNumber, {
        'Do Not Contact': 'Yes',
        'Last Contact': new Date(),
        'Notes': appendNote_(entry.record['Notes'], 'Permanent suppression recorded ' + formatDateTime_(new Date()) + '.')
      });
    }
  });
}

function ensureNJCWWALabel_(suffix) {
  var fullName = NJCWWA.LABEL_ROOT + '/' + suffix;
  var response = Gmail.Users.Labels.list('me');
  var labels = response.labels || [];
  for (var i = 0; i < labels.length; i++) {
    if (labels[i].name === fullName) return labels[i].id;
  }
  var created = Gmail.Users.Labels.create({
    name: fullName,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show'
  }, 'me');
  return created.id;
}

function applyReplyLabel_(messageId, classification) {
  if (!messageId) return;
  var suffix = 'Needs Review';
  if (classification.primary === 'Hiring Now') suffix = 'Hiring Now';
  else if (classification.primary === 'Future Hiring') suffix = 'Future Hiring';
  else if (classification.primary === 'Internship Interest') suffix = 'Internship';
  else if (classification.primary === 'Not Interested' || classification.primary === 'Not Currently Hiring') suffix = 'Not Interested';
  else if (classification.primary === 'Unsubscribe') suffix = 'Unsubscribed';
  else if (classification.primary === 'Bounce') suffix = 'Bounced';
  else if (classification.primary === 'Automatic Reply' || classification.primary === 'Out of Office') suffix = 'Automatic Reply';

  var labelId = ensureNJCWWALabel_(suffix);
  Gmail.Users.Messages.modify({ addLabelIds: [labelId] }, 'me', messageId);
}

function appendNote_(existing, note) {
  var current = safeString_(existing);
  var addition = safeString_(note);
  if (!current) return addition;
  if (!addition || current.indexOf(addition) !== -1) return current;
  return current + '\n' + addition;
}
