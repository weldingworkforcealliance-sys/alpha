/**
 * Header-driven Google Sheets storage helpers.
 * All writes resolve columns from visible headers instead of fragile numbers.
 */

function getHeaderMap_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return {};
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var map = {};
  headers.forEach(function (header, index) {
    var key = safeString_(header);
    if (key) map[key] = index;
  });
  return map;
}

function getSheetSnapshot_(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) {
    return { sheet: sheet, headers: [], headerMap: {}, rows: [] };
  }

  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var headers = values[0].map(safeString_);
  var headerMap = {};
  headers.forEach(function (header, index) {
    if (header) headerMap[header] = index;
  });
  return { sheet: sheet, headers: headers, headerMap: headerMap, rows: values.slice(1) };
}

function getRecords_(sheetName) {
  var snapshot = getSheetSnapshot_(sheetName);
  return snapshot.rows.map(function (row, index) {
    var record = {};
    snapshot.headers.forEach(function (header, columnIndex) {
      if (header) record[header] = row[columnIndex];
    });
    return {
      sheet: snapshot.sheet,
      rowNumber: index + 2,
      values: row,
      record: record
    };
  });
}

function objectToRow_(headers, object) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
  });
}

function appendRecord_(sheetName, object) {
  var snapshot = getSheetSnapshot_(sheetName);
  if (!snapshot.headers.length) throw new Error('Sheet has no header row: ' + sheetName);
  var row = objectToRow_(snapshot.headers, object);
  snapshot.sheet.getRange(snapshot.sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return snapshot.sheet.getLastRow();
}

function appendRecords_(sheetName, objects) {
  if (!objects || !objects.length) return [];
  var snapshot = getSheetSnapshot_(sheetName);
  if (!snapshot.headers.length) throw new Error('Sheet has no header row: ' + sheetName);
  var rows = objects.map(function (object) { return objectToRow_(snapshot.headers, object); });
  var startRow = snapshot.sheet.getLastRow() + 1;
  snapshot.sheet.getRange(startRow, 1, rows.length, snapshot.headers.length).setValues(rows);
  return rows.map(function (_, index) { return startRow + index; });
}

function updateRecordRow_(sheetName, rowNumber, patch) {
  var snapshot = getSheetSnapshot_(sheetName);
  if (rowNumber < 2 || rowNumber > snapshot.sheet.getMaxRows()) {
    throw new Error('Invalid row number for ' + sheetName + ': ' + rowNumber);
  }
  var current = snapshot.sheet.getRange(rowNumber, 1, 1, snapshot.headers.length).getValues()[0];
  Object.keys(patch).forEach(function (header) {
    if (typeof snapshot.headerMap[header] === 'undefined') {
      throw new Error('Header not found in ' + sheetName + ': ' + header);
    }
    current[snapshot.headerMap[header]] = patch[header];
  });
  snapshot.sheet.getRange(rowNumber, 1, 1, snapshot.headers.length).setValues([current]);
}

function findFirstRecord_(sheetName, predicate) {
  var records = getRecords_(sheetName);
  for (var i = 0; i < records.length; i++) {
    if (predicate(records[i].record, records[i])) return records[i];
  }
  return null;
}

function findRecords_(sheetName, predicate) {
  return getRecords_(sheetName).filter(function (entry) {
    return predicate(entry.record, entry);
  });
}

function deleteRecords_(sheetName, predicate) {
  var records = getRecords_(sheetName);
  var rows = records.filter(function (entry) {
    return predicate(entry.record, entry);
  }).map(function (entry) {
    return entry.rowNumber;
  }).sort(function (a, b) { return b - a; });

  rows.forEach(function (rowNumber) {
    getSheet_(sheetName).deleteRow(rowNumber);
  });
  return rows.length;
}

function buildColumnSet_(sheetName, header, filterFn) {
  var set = {};
  getRecords_(sheetName).forEach(function (entry) {
    if (filterFn && !filterFn(entry.record, entry)) return;
    var value = safeString_(entry.record[header]);
    if (value) set[value] = true;
  });
  return set;
}

function findReplyByMessageId_(messageId) {
  var target = safeString_(messageId);
  if (!target) return null;
  return findFirstRecord_(NJCWWA.SHEETS.REPLIES, function (record) {
    return safeString_(record['Gmail Message ID']) === target;
  });
}

function getProcessedMessageIdSet_() {
  var set = {};
  getRecords_(NJCWWA.SHEETS.ACTIVITY).forEach(function (entry) {
    var messageId = safeString_(entry.record['Gmail Message ID']);
    var eventType = safeString_(entry.record['Event Type']).toLowerCase();
    if (messageId && (eventType === 'reply' || eventType === 'bounce')) set[messageId] = true;
  });
  getRecords_(NJCWWA.SHEETS.REPLIES).forEach(function (entry) {
    var messageId = safeString_(entry.record['Gmail Message ID']);
    var status = safeString_(entry.record['Processing Status']).toLowerCase();
    if (messageId && status === 'processed') set[messageId] = true;
  });
  return set;
}

function hasEmailActivityForMessage_(messageId, eventType) {
  var targetId = safeString_(messageId);
  var targetType = safeString_(eventType).toLowerCase();
  if (!targetId) return false;
  return Boolean(findFirstRecord_(NJCWWA.SHEETS.ACTIVITY, function (record) {
    return safeString_(record['Gmail Message ID']) === targetId &&
      (!targetType || safeString_(record['Event Type']).toLowerCase() === targetType);
  }));
}

function getSuppressedEmailSet_() {
  var set = {};
  getRecords_(NJCWWA.SHEETS.SUPPRESSIONS).forEach(function (entry) {
    if (!yes_(entry.record['Permanent'])) return;
    var email = normalizeEmail_(entry.record['Email']);
    if (email) set[email] = true;
  });
  return set;
}

function logEmailActivity_(fields) {
  appendRecord_(NJCWWA.SHEETS.ACTIVITY, {
    'Event ID': fields.eventId || makeId_('EVT'),
    'Timestamp': fields.timestamp || new Date(),
    'Queue ID': fields.queueId || '',
    'Campaign ID': fields.campaignId || '',
    'Employer ID': fields.employerId || '',
    'Contact ID': fields.contactId || '',
    'Email': fields.email || '',
    'Event Type': fields.eventType || '',
    'Gmail Thread ID': fields.threadId || '',
    'Gmail Message ID': fields.messageId || '',
    'Details': boundedCellText_(fields.details || '', 8000),
    'Processed': fields.processed || 'Yes'
  });
}

function logAutomation_(process, status, checked, changed, sent, errors, duration, details) {
  appendRecord_(NJCWWA.SHEETS.LOG, {
    'Log ID': makeId_('LOG'),
    'Timestamp': new Date(),
    'Process': process,
    'Status': status,
    'Records Checked': checked || 0,
    'Records Changed': changed || 0,
    'Messages Sent': sent || 0,
    'Errors': boundedCellText_(errors || '', 8000),
    'Duration Seconds': duration || 0,
    'Details': boundedCellText_(details || '', 8000)
  });
}

function boundedCellText_(value, limit, suffix) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value);
  var maximum = Math.max(100, Number(limit || 45000));
  var ending = String(suffix || '\n[Content truncated safely]');
  if (text.length <= maximum) return text;
  var keep = Math.max(0, maximum - ending.length);
  return text.slice(0, keep) + ending;
}

function compactError_(error) {
  var text = error && error.message ? error.message : String(error || 'Unknown error');
  return boundedCellText_(text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim(), 2000);
}

function archiveReplyBody_(messageId, threadId, replyId, queue, contactEmail, subject, body) {
  var archiveSheet = getSpreadsheet_().getSheetByName('Reply Archive');
  if (!archiveSheet || !body) return '';

  var existing = findFirstRecord_('Reply Archive', function (record) {
    return safeString_(record['Source Message ID']) === safeString_(messageId);
  });
  if (existing) return safeString_(existing.record['Archive ID']);

  var archiveId = makeId_('ARCH');
  var chunkSize = 30000;
  var chunks = [];
  for (var offset = 0; offset < body.length; offset += chunkSize) {
    chunks.push(body.slice(offset, offset + chunkSize));
  }
  if (!chunks.length) chunks.push('');

  var records = chunks.map(function (chunk, index) {
    return {
      'Archive ID': archiveId,
      'Created At': new Date(),
      'Source Message ID': messageId,
      'Source Thread ID': threadId || '',
      'Source RFC Message ID': '',
      'Source Reply ID': replyId,
      'Queue ID': queue['Queue ID'] || '',
      'Contact ID': queue['Contact ID'] || '',
      'Employer ID': queue['Employer ID'] || '',
      'Company Name': queue['Company Name'] || '',
      'Contact Email': contactEmail || queue['Email'] || '',
      'Subject': subject || '',
      'Body Type': 'Original Reply ' + (index + 1) + '/' + chunks.length,
      'Body Content': chunk
    };
  });
  appendRecords_('Reply Archive', records);
  return archiveId;
}

function updateLastContact_(employerId, contactId, timestamp) {
  if (contactId) {
    var contact = findFirstRecord_(NJCWWA.SHEETS.CONTACTS, function (record) {
      return safeString_(record['Contact ID']) === safeString_(contactId);
    });
    if (contact) updateRecordRow_(NJCWWA.SHEETS.CONTACTS, contact.rowNumber, { 'Last Contact': timestamp });
  }

  if (employerId) {
    var employer = findFirstRecord_(NJCWWA.SHEETS.EMPLOYERS, function (record) {
      return safeString_(record['Employer ID']) === safeString_(employerId);
    });
    if (employer) updateRecordRow_(NJCWWA.SHEETS.EMPLOYERS, employer.rowNumber, { 'Last Contact': timestamp });
  }
}
