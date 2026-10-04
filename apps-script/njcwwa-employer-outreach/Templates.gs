/**
 * Template lookup, merge-field rendering, and MIME message construction.
 */

function getActiveTemplateMap_() {
  var map = {};
  getRecords_(NJCWWA.SHEETS.TEMPLATES).forEach(function (entry) {
    var id = safeString_(entry.record['Template ID']);
    if (!id || !yes_(entry.record['Active'])) return;
    map[id] = {
      id: id,
      subject: safeString_(entry.record['Subject']),
      body: safeString_(entry.record['Plain-Text Body']),
      touchNumber: Number(entry.record['Touch Number'] || 1)
    };
  });
  return map;
}

function getContactMap_() {
  var map = {};
  getRecords_(NJCWWA.SHEETS.CONTACTS).forEach(function (entry) {
    var id = safeString_(entry.record['Contact ID']);
    if (!id) return;
    map[id] = {
      firstName: safeString_(entry.record['First Name']),
      lastName: safeString_(entry.record['Last Name']),
      title: safeString_(entry.record['Title']),
      email: normalizeEmail_(entry.record['Email']),
      phone: safeString_(entry.record['Phone'])
    };
  });
  return map;
}

function renderTemplate_(text, queueRecord, contact, config) {
  var contactName = safeString_(queueRecord['Contact Name']);
  var firstName = safeString_(contact && contact.firstName);
  if (!firstName && contactName) firstName = contactName.split(/\s+/)[0];
  if (!firstName) firstName = 'there';

  var replacements = {
    '{{FirstName}}': firstName,
    '{{ContactName}}': contactName,
    '{{CompanyName}}': safeString_(queueRecord['Company Name']),
    '{{County}}': safeString_(queueRecord['Worksite County']),
    '{{JobFamily}}': safeString_(queueRecord['Job Family']),
    '{{HiringFormURL}}': config.hiringFormUrl || '',
    '{{AllianceWebsite}}': config.website || '',
    '{{PhysicalMailingAddress}}': config.physicalAddress || ''
  };

  var rendered = String(text || '');
  Object.keys(replacements).forEach(function (key) {
    rendered = rendered.split(key).join(replacements[key]);
  });
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

function buildOutboundBody_(templateBody, queueRecord, contact, config) {
  var body = renderTemplate_(templateBody, queueRecord, contact, config).trim();
  var footerLines = [
    '',
    '---',
    'New Jersey Community Welding Workforce Alliance',
    config.physicalAddress || '',
    config.website || '',
    'Reply UNSUBSCRIBE to stop employer-outreach messages from ' + NJCWWA.SENDER_EMAIL + '.'
  ].filter(function (value) { return Boolean(safeString_(value)); });
  return body + '\n' + footerLines.join('\n');
}

function buildRawMessage_(to, subject, body, threadId) {
  if (!isValidEmail_(to)) throw new Error('Invalid recipient address: ' + to);
  var safeSubject = sanitizeHeader_(subject || 'NJCWWA Employer Outreach');
  var headers = [
    'From: New Jersey Community Welding Workforce Alliance <' + NJCWWA.SENDER_EMAIL + '>',
    'To: ' + normalizeEmail_(to),
    'Reply-To: ' + NJCWWA.SENDER_EMAIL,
    'Subject: ' + safeSubject,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    'List-Unsubscribe: <mailto:' + NJCWWA.SENDER_EMAIL + '?subject=UNSUBSCRIBE>'
  ];
  var rawText = headers.join('\r\n') + '\r\n\r\n' + String(body || '').replace(/\r?\n/g, '\r\n');
  var message = {
    raw: Utilities.base64EncodeWebSafe(rawText, Utilities.Charset.UTF_8).replace(/=+$/, '')
  };
  if (threadId) message.threadId = threadId;
  return message;
}

function sendRawMessage_(to, subject, body, threadId) {
  assertAllianceAccount_();
  var config = getConfig_();
  if (config.testMode) assertTestRecipientAllowed_(to, config);
  else {
    assertLiveSendingAllowed_(config);
    assertCampaignSchedule_(new Date(), config);
    if (getTodaySendStats_(new Date(), NJCWWA.TIME_ZONE).totalSent >= config.dailyTotalCap) throw new Error('Daily total send cap already reached.');
  }
  var message = buildRawMessage_(to, subject, body, threadId);
  return Gmail.Users.Messages.send(message, 'me');
}
