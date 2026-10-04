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

function getProcessedMessageIdSet_() {
  var set = {};
  getRecords_(NJCWWA.SHEETS.ACTIVITY).forEach(function (entry) {
    var messageId = safeString_(entry.record['Gmail Message ID']);
    if (messageId) set[messageId] = true;
  });
  return set;
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
    'Details': fields.details || '',
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
    'Errors': errors || '',
    'Duration Seconds': duration || 0,
    'Details': details || ''
  });
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
