/**
 * NJCWWA Employer Outreach Automation
 * Configuration, account guards, and general utilities.
 *
 * Live sending is impossible unless all three sheet controls are satisfied:
 *   Campaign Enabled = Yes
 *   Test Mode = No
 *   Live Launch Authorized = Yes
 */
var NJCWWA = Object.freeze({
  VERSION: '2026-10-08.1',
  SPREADSHEET_ID: '1I0uFNU_tjFAiBLuXbOWZrR91WpeF7Mwbsg070XRGPG0',
  SENDER_EMAIL: 'weldingworkforcealliance@gmail.com',
  TIME_ZONE: 'America/New_York',
  TEST_PREFIX: 'NJCWWA-TEST-',
  LABEL_ROOT: 'NJCWWA',
  SHEETS: Object.freeze({
    CONFIG: 'Configuration',
    TEMPLATES: 'Templates',
    EMPLOYERS: 'Employers',
    LOCATIONS: 'Locations',
    CONTACTS: 'Contacts',
    QUEUE: 'Campaign Queue',
    ACTIVITY: 'Email Activity',
    REPLIES: 'Replies',
    REPLY_ARCHIVE: 'Reply Archive',
    LEADS: 'Leads',
    OPPORTUNITIES: 'Job Opportunities',
    FOLLOW_UPS: 'Follow-Ups',
    SUPPRESSIONS: 'Suppressions',
    LOG: 'Automation Log'
  }),
  REQUIRED_SHEETS: Object.freeze([
    'Configuration', 'Templates', 'Employers', 'Locations', 'Contacts',
    'Campaign Queue', 'Email Activity', 'Replies', 'Leads',
    'Job Opportunities', 'Follow-Ups', 'Suppressions', 'Automation Log'
  ]),
  REQUIRED_HEADERS: Object.freeze({
    'Configuration': ['Setting', 'Value'],
    'Templates': ['Template ID', 'Template Name', 'Touch Number', 'Active', 'Subject', 'Plain-Text Body'],
    'Employers': ['Employer ID', 'Company Name', 'Industry', 'Relationship Stage', 'Active'],
    'Locations': ['Location ID', 'Employer ID', 'Company Name', 'City', 'County'],
    'Contacts': ['Contact ID', 'Employer ID', 'Company Name', 'Email', 'Worksite County', 'Do Not Contact'],
    'Campaign Queue': ['Queue ID', 'Campaign ID', 'Employer ID', 'Contact ID', 'Company Name', 'Email', 'Template ID', 'Touch Number', 'Approval Status', 'Send Status', 'Gmail Thread ID', 'Gmail Message ID', 'Reply Received', 'Stop Sequence'],
    'Email Activity': ['Event ID', 'Timestamp', 'Queue ID', 'Campaign ID', 'Email', 'Event Type', 'Gmail Thread ID', 'Gmail Message ID', 'Details'],
    'Replies': ['Reply ID', 'Received At', 'Employer ID', 'Contact ID', 'Company Name', 'Contact Email', 'Gmail Thread ID', 'Gmail Message ID', 'Original Reply', 'Primary Classification', 'Processing Status', 'Processing Error', 'Human Review Status'],
    'Leads': ['Lead ID', 'Employer ID', 'Company Name', 'Email', 'Worksite County', 'Lead Stage', 'Next Action', 'Review Status'],
    'Job Opportunities': ['Opportunity ID', 'Lead ID', 'Employer ID', 'Company Name', 'Standard Job Type', 'Openings', 'County', 'Status', 'Source Reply ID'],
    'Follow-Ups': ['Task ID', 'Lead ID', 'Employer ID', 'Company Name', 'Due Date', 'Status'],
    'Suppressions': ['Suppression ID', 'Email', 'Employer ID', 'Company Name', 'Reason', 'Permanent'],
    'Automation Log': ['Log ID', 'Timestamp', 'Process', 'Status', 'Messages Sent', 'Errors', 'Details']
  }),
  MANAGED_TRIGGER_FUNCTIONS: Object.freeze(['runOutreachCycle', 'scanEmployerReplies', 'dailyMaintenance'])
});

function getConfig_() {
  var sheet = getSheet_(NJCWWA.SHEETS.CONFIG);
  var lastRow = Math.max(1, sheet.getLastRow());
  var values = sheet.getRange(1, 1, lastRow, 2).getValues();
  var raw = {};
  values.forEach(function (row) {
    var key = safeString_(row[0]);
    if (key && key !== 'Setting' && key !== 'NJCWWA Employer Outreach Automation Configuration') raw[key] = row[1];
  });
  return {
    senderEmail: normalizeEmail_(raw['Sender Email']) || NJCWWA.SENDER_EMAIL,
    dailyNewTarget: outreachDailyLimit_(raw['Daily New Outreach Target']),
    dailyTotalCap: outreachDailyLimit_(raw['Daily Total Send Cap']),
    campaignStartDate: configDateKey_(raw['Campaign Start Date']),
    campaignEndDate: configDateKey_(raw['Campaign End Date']),
    businessDaysOnly: yes_(raw['Business Days Only']),
    timeZone: safeString_(raw['Time Zone']) || NJCWWA.TIME_ZONE,
    sendWindowStart: safeString_(raw['Send Window Start']) || '9:30 AM',
    sendWindowEnd: safeString_(raw['Send Window End']) || '4:30 PM',
    messagesPerBatch: positiveInteger_(raw['Messages Per Batch'], 10),
    minutesBetweenBatches: positiveInteger_(raw['Minutes Between Batches'], 45),
    followUp1Delay: positiveInteger_(raw['Follow-Up 1 Delay'], 5),
    followUp2Delay: positiveInteger_(raw['Follow-Up 2 Delay'], 10),
    maximumFollowUps: Math.max(0, Math.floor(Number(raw['Maximum Follow-Ups']) || 0)),
    stopOnReply: yes_(raw['Stop on Reply']),
    stopOnUnsubscribe: yes_(raw['Stop on Unsubscribe']),
    requireApprovedStatus: yes_(raw['Require Approved Status']),
    requireUniqueEmail: yes_(raw['Require Unique Email']),
    campaignEnabled: yes_(raw['Campaign Enabled']),
    testMode: yes_(raw['Test Mode']),
    liveLaunchAuthorized: yes_(raw['Live Launch Authorized']),
    testAllowlist: safeString_(raw['Test Recipient Allowlist'] || NJCWWA.SENDER_EMAIL).split(',').map(normalizeEmail_).filter(Boolean),
    physicalAddress: safeString_(raw['Physical Mailing Address']),
    hiringFormUrl: safeString_(raw['Employer Hiring Form URL']),
    website: safeString_(raw['Alliance Website']),
    defaultLeadOwner: safeString_(raw['Default Lead Owner']) || 'Richard Genco'
  };
}

function assertAllianceAccount_() {
  var sessionEmail = '';
  try {
    sessionEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
  } catch (sessionError) {
    sessionEmail = '';
  }

  if (sessionEmail) {
    if (sessionEmail !== NJCWWA.SENDER_EMAIL) {
      throw new Error('Wrong authenticated Google account: ' + sessionEmail + '. Required: ' + NJCWWA.SENDER_EMAIL);
    }
    return sessionEmail;
  }

  var profile;
  try {
    profile = Gmail.Users.getProfile('me');
  } catch (error) {
    if (isGmailQuotaError_(error)) {
      throw new Error('Gmail API quota temporarily exceeded while confirming the Alliance account: ' + compactError_(error));
    }
    throw new Error('Gmail API account check failed. Confirm Gmail API v1 remains enabled and the Alliance account is authorized. Original error: ' + compactError_(error));
  }

  var email = normalizeEmail_(profile && profile.emailAddress);
  if (email !== NJCWWA.SENDER_EMAIL) {
    throw new Error('Wrong authenticated Google account: ' + (email || 'unknown') + '. Required: ' + NJCWWA.SENDER_EMAIL);
  }
  return email;
}

function isGmailQuotaError_(error) {
  var text = error && error.message ? error.message : String(error || '');
  return /quota exceeded|rate limit|user-rate limit|too many requests|resource has been exhausted|limit.*per minute|\b429\b/i.test(text);
}

function assertRequiredSheets_() {
  var spreadsheet = getSpreadsheet_();
  var missing = NJCWWA.REQUIRED_SHEETS.filter(function (name) {
    return !spreadsheet.getSheetByName(name);
  });
  if (missing.length) throw new Error('Missing required sheet tabs: ' + missing.join(', '));
}

function assertRequiredHeaders_() {
  Object.keys(NJCWWA.REQUIRED_HEADERS).forEach(function (sheetName) {
    var sheet = getSheet_(sheetName);
    var map;
    if (sheetName === NJCWWA.SHEETS.CONFIG) {
      map = {};
      var rows = sheet.getRange(1, 1, Math.min(10, Math.max(1, sheet.getLastRow())), Math.max(2, sheet.getLastColumn())).getDisplayValues();
      rows.forEach(function (row) {
        row.forEach(function (value, index) {
          if (safeString_(value)) map[safeString_(value)] = index;
        });
      });
    } else {
      map = getHeaderMap_(sheet);
    }
    var missing = NJCWWA.REQUIRED_HEADERS[sheetName].filter(function (header) {
      return typeof map[header] === 'undefined';
    });
    if (missing.length) throw new Error('Missing required headers in ' + sheetName + ': ' + missing.join(', '));
  });
}

function assertLiveSendingAllowed_(config) {
  if (!config.campaignEnabled) throw new Error('Campaign Enabled must be Yes.');
  if (config.testMode) throw new Error('Test Mode must be No for live sending.');
  if (!config.liveLaunchAuthorized) throw new Error('Live Launch Authorized must be Yes.');
  if (config.senderEmail !== NJCWWA.SENDER_EMAIL) throw new Error('Configuration Sender Email must remain ' + NJCWWA.SENDER_EMAIL + '.');
  if (!config.physicalAddress || /required|tbd|omitted/i.test(config.physicalAddress)) throw new Error('Physical Mailing Address must be completed before live outreach.');
}

function assertTestRecipientAllowed_(email, config) {
  var normalized = normalizeEmail_(email);
  if (!config.testMode) throw new Error('Test Mode must be Yes for a controlled test send.');
  if (config.testAllowlist.indexOf(normalized) === -1) throw new Error('Test recipient is not in Test Recipient Allowlist: ' + normalized);
}

function outreachDailyLimit_(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 100;
  var number = Number(value);
  if (!isFinite(number) || number <= 0 || Math.floor(number) !== number) return 100;
  return Math.min(100, number);
}

function configDateKey_(value) {
  return value instanceof Date ? dateKey_(value, NJCWWA.TIME_ZONE) : safeString_(value);
}

function isCampaignDateAllowed_(date, config) {
  var start = config.campaignStartDate;
  var end = config.campaignEndDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '') || start > end) return false;
  var today = dateKey_(date, NJCWWA.TIME_ZONE);
  var day = new Date(today + 'T12:00:00Z').getUTCDay();
  return today >= start && today <= end && day >= 1 && day <= 5;
}

function assertCampaignSchedule_(date, config) {
  if (!isCampaignDateAllowed_(date, config)) throw new Error('Outside the authorized weekday campaign dates.');
  if (!isWithinSendWindow_(date, config.sendWindowStart, config.sendWindowEnd, NJCWWA.TIME_ZONE)) throw new Error('Outside configured send window.');
}

function isPublicConfirmedContact_(contact) {
  var currentNotes = safeString_(contact.Notes).split(/Previous research:/i)[0];
  return yes_(contact['Email Verified']) || /PUBLIC EMAIL CONFIRMED/i.test(currentNotes);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(NJCWWA.SPREADSHEET_ID);
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Required sheet not found: ' + name);
  return sheet;
}

function withScriptLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { skipped: true, reason: 'Another NJCWWA automation run already holds the script lock.' };
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function isBusinessDay_(date) {
  var day = date.getDay();
  return day !== 0 && day !== 6;
}

function nextBusinessDate_(date, businessDays) {
  var result = new Date(date.getTime());
  var remaining = Number(businessDays || 0);
  if (remaining === 0) {
    while (!isBusinessDay_(result)) result.setDate(result.getDate() + 1);
    return result;
  }
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay_(result)) remaining--;
  }
  return result;
}

function businessDaysBetween_(start, end) {
  var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  var finish = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  var count = 0;
  while (cursor < finish) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay_(cursor)) count++;
  }
  return count;
}

function timeToMinutes_(value) {
  var text = safeString_(value);
  var match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return 0;
  var hour = Number(match[1]);
  var minute = Number(match[2] || 0);
  var meridiem = safeString_(match[3]).toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function isWithinSendWindow_(date, start, end, timeZone) {
  var zone = timeZone || NJCWWA.TIME_ZONE;
  var current = Utilities.formatDate(date, zone, 'h:mm a');
  var nowMinutes = timeToMinutes_(current);
  return nowMinutes >= timeToMinutes_(start) && nowMinutes <= timeToMinutes_(end);
}

function isQueueRecordDue_(record, now, timeZone) {
  var scheduledDate = record['Scheduled Date'];
  var scheduledTime = record['Scheduled Time'];
  if (!scheduledDate && !scheduledTime) return true;
  var zone = timeZone || NJCWWA.TIME_ZONE;
  var today = Utilities.formatDate(now, zone, 'yyyy-MM-dd');
  var dateString = today;
  if (scheduledDate instanceof Date) dateString = Utilities.formatDate(scheduledDate, zone, 'yyyy-MM-dd');
  else if (/^\d{4}-\d{2}-\d{2}$/.test(safeString_(scheduledDate))) dateString = safeString_(scheduledDate);
  else if (scheduledDate) {
    var parsed = new Date(scheduledDate);
    if (!isNaN(parsed.getTime())) dateString = Utilities.formatDate(parsed, zone, 'yyyy-MM-dd');
  }
  if (dateString > today) return false;
  if (dateString < today) return true;
  if (!scheduledTime) return true;
  var currentMinutes = timeToMinutes_(Utilities.formatDate(now, zone, 'h:mm a'));
  var scheduledMinutes;
  if (scheduledTime instanceof Date) {
    scheduledMinutes = Number(Utilities.formatDate(scheduledTime, zone, 'H')) * 60 + Number(Utilities.formatDate(scheduledTime, zone, 'm'));
  } else {
    scheduledMinutes = timeToMinutes_(scheduledTime);
  }
  return currentMinutes >= scheduledMinutes;
}

function batchIntervalElapsed_(minutes) {
  var value = PropertiesService.getScriptProperties().getProperty('NJCWWA_LAST_BATCH_AT');
  if (!value) return true;
  return Date.now() - Number(value) >= Math.max(1, Number(minutes || 45)) * 60 * 1000;
}

function markBatchSent_(startedAt) {
  PropertiesService.getScriptProperties().setProperty('NJCWWA_LAST_BATCH_AT', String(startedAt instanceof Date ? startedAt.getTime() : Date.now()));
}

function safeString_(value) {
  return value === null || typeof value === 'undefined' ? '' : String(value).trim();
}

function normalizeEmail_(value) {
  return safeString_(value).toLowerCase();
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeString_(value));
}

function extractEmail_(value) {
  var text = safeString_(value);
  var angle = text.match(/<([^>]+)>/);
  if (angle) return normalizeEmail_(angle[1]);
  var plain = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return normalizeEmail_(plain ? plain[0] : text);
}

function yes_(value) {
  return ['yes', 'true', '1', 'y', 'approved', 'active'].indexOf(safeString_(value).toLowerCase()) !== -1;
}

function positiveInteger_(value, fallback) {
  var number = Number(value);
  return isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function priorityRank_(value) {
  var map = { urgent: 0, high: 1, normal: 2, low: 3 };
  var key = safeString_(value || 'normal').toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : 2;
}

function makeId_(prefix) {
  return prefix + '-' + Utilities.getUuid().split('-')[0].toUpperCase() + '-' + Date.now();
}

function formatDateTime_(date, timeZone) {
  return Utilities.formatDate(date, timeZone || NJCWWA.TIME_ZONE, 'yyyy-MM-dd h:mm:ss a z');
}

function dateKey_(date, timeZone) {
  return Utilities.formatDate(date, timeZone || NJCWWA.TIME_ZONE, 'yyyy-MM-dd');
}

function secondsSince_(started) {
  return Math.round(((Date.now() - started.getTime()) / 1000) * 100) / 100;
}

function escapeRegExp_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeHeader_(value) {
  return safeString_(value).replace(/[\r\n]+/g, ' ');
}

function isPlaceholderValue_(value) {
  return !safeString_(value) || /required|tbd|omitted|placeholder/i.test(safeString_(value));
}
