/**
 * Incremental Gmail reply discovery, MIME decoding, and idempotent dispatch.
 *
 * The scanner uses Gmail history instead of rereading every historical thread.
 * It processes at most 50 campaign messages per run and stores its cursor in
 * Script Properties so a quota or runtime interruption can resume safely.
 */

var NJCWWA_REPLY_SCAN = Object.freeze({
  HISTORY_ID: 'NJCWWA_REPLY_HISTORY_ID',
  PAGE_TOKEN: 'NJCWWA_REPLY_HISTORY_PAGE_TOKEN',
  TARGET_HISTORY_ID: 'NJCWWA_REPLY_HISTORY_TARGET_ID',
  PENDING: 'NJCWWA_REPLY_PENDING_MESSAGE_IDS',
  LAST_RUN_AT: 'NJCWWA_REPLY_LAST_RUN_AT',
  BACKOFF_UNTIL: 'NJCWWA_REPLY_BACKOFF_UNTIL'
});
var NJCWWA_REPLY_SCAN_LIMIT = 50;
var NJCWWA_REPLY_SCAN_MIN_INTERVAL_MS = 14 * 60 * 1000;
var NJCWWA_REPLY_BOOTSTRAP_DAYS = 14;
var NJCWWA_REPLY_BOOTSTRAP_PAGES = 5;
var NJCWWA_REPLY_HISTORY_PAGES = 5;

function scanEmployerReplies() {
  return scanEmployerRepliesInternal_(false);
}

function scanEmployerRepliesNow() {
  return scanEmployerRepliesInternal_(true);
}

function scanEmployerRepliesInternal_(force) {
  var started = new Date();
  return withScriptLock_(function () {
    var checked = 0;
    var changed = 0;
    var errors = [];
    var properties = PropertiesService.getScriptProperties();
    var now = Date.now();

    try {
      assertAllianceAccount_();
      assertRequiredSheets_();
      assertRequiredHeaders_();

      var backoffUntil = Number(properties.getProperty(NJCWWA_REPLY_SCAN.BACKOFF_UNTIL) || 0);
      if (!force && backoffUntil > now) {
        return {
          skipped: true,
          reason: 'Gmail reply scanner is in quota backoff until ' + new Date(backoffUntil).toISOString()
        };
      }

      var lastRunAt = Number(properties.getProperty(NJCWWA_REPLY_SCAN.LAST_RUN_AT) || 0);
      if (!force && lastRunAt && now - lastRunAt < NJCWWA_REPLY_SCAN_MIN_INTERVAL_MS) {
        return { skipped: true, reason: 'Reply scanner already ran within the protected 15-minute interval.' };
      }
      properties.setProperty(NJCWWA_REPLY_SCAN.LAST_RUN_AT, String(now));

      var threadMap = buildCampaignThreadMap_();
      if (!Object.keys(threadMap).length) {
        logAutomation_('scanEmployerReplies', 'Completed', 0, 0, 0, '', secondsSince_(started), 'No campaign Gmail thread IDs are available to scan.');
        return { checked: 0, processed: 0, errors: [] };
      }

      var processedIds = getProcessedMessageIdSet_();
      var state = loadReplyScanState_(properties);
      var candidates = [];
      var stateDetails = '';

      if (state.pending.length) {
        candidates = state.pending.slice(0, NJCWWA_REPLY_SCAN_LIMIT);
        state.pending = state.pending.slice(NJCWWA_REPLY_SCAN_LIMIT);
        stateDetails = 'Resumed pending Gmail messages.';
      } else if (!state.historyId) {
        var bootstrap = bootstrapReplyScan_(threadMap, processedIds);
        candidates = bootstrap.candidates.slice(0, NJCWWA_REPLY_SCAN_LIMIT);
        state.pending = bootstrap.candidates.slice(NJCWWA_REPLY_SCAN_LIMIT);
        state.targetHistoryId = bootstrap.targetHistoryId;
        state.pageToken = '';
        stateDetails = 'Initialized Gmail history cursor with a bounded ' + NJCWWA_REPLY_BOOTSTRAP_DAYS + '-day inbox scan.';
      } else {
        var historyBatch;
        try {
          historyBatch = fetchHistoryCandidates_(state, threadMap, processedIds);
        } catch (historyError) {
          if (isInvalidHistoryError_(historyError)) {
            clearReplyScanCursor_(properties);
            var recovery = bootstrapReplyScan_(threadMap, processedIds);
            candidates = recovery.candidates.slice(0, NJCWWA_REPLY_SCAN_LIMIT);
            state = {
              historyId: '',
              pageToken: '',
              targetHistoryId: recovery.targetHistoryId,
              pending: recovery.candidates.slice(NJCWWA_REPLY_SCAN_LIMIT)
            };
            stateDetails = 'Expired Gmail history cursor was safely rebuilt with a bounded inbox scan.';
          } else {
            throw historyError;
          }
        }
        if (historyBatch) {
          candidates = historyBatch.candidates.slice(0, NJCWWA_REPLY_SCAN_LIMIT);
          state.pending = historyBatch.candidates.slice(NJCWWA_REPLY_SCAN_LIMIT);
          state.pageToken = historyBatch.nextPageToken;
          state.targetHistoryId = historyBatch.targetHistoryId;
          stateDetails = 'Read incremental Gmail history.';
        }
      }

      var result = processReplyCandidates_(candidates, threadMap, processedIds);
      checked += result.checked;
      changed += result.processed;
      errors = result.errors;

      if (result.retry.length) {
        state.pending = mergeReplyCandidates_(result.retry, state.pending);
      }

      if (result.quotaError) {
        properties.setProperty(NJCWWA_REPLY_SCAN.BACKOFF_UNTIL, String(Date.now() + 15 * 60 * 1000));
      } else {
        properties.deleteProperty(NJCWWA_REPLY_SCAN.BACKOFF_UNTIL);
      }

      finalizeReplyScanState_(properties, state);

      var status = errors.length ? 'Completed with errors' : 'Completed';
      var errorSummary = summarizeScannerErrors_(errors);
      var detail = stateDetails + ' Candidates: ' + candidates.length +
        ' | Pending: ' + state.pending.length +
        ' | Incremental cursor: ' + (state.historyId || state.targetHistoryId || 'initializing');
      logAutomation_('scanEmployerReplies', status, checked, changed, 0, errorSummary, secondsSince_(started), detail);

      return {
        checked: checked,
        processed: changed,
        pending: state.pending.length,
        quotaBackoff: result.quotaError,
        errors: errors.slice(0, 10)
      };
    } catch (error) {
      var compact = compactError_(error);
      if (isGmailQuotaError_(error)) {
        properties.setProperty(NJCWWA_REPLY_SCAN.BACKOFF_UNTIL, String(Date.now() + 15 * 60 * 1000));
      }
      logAutomation_('scanEmployerReplies', 'Failed', checked, changed, 0, compact, secondsSince_(started), 'Incremental reply scan stopped safely; cursor and pending messages were preserved.');
      throw error;
    }
  });
}

function buildCampaignThreadMap_() {
  var map = {};
  getRecords_(NJCWWA.SHEETS.QUEUE).forEach(function (entry) {
    var threadId = safeString_(entry.record['Gmail Thread ID']);
    if (!threadId) return;
    if (!map[threadId]) map[threadId] = [];
    map[threadId].push(entry);
  });
  Object.keys(map).forEach(function (threadId) {
    map[threadId].sort(function (a, b) {
      return queueSentTime_(a.record) - queueSentTime_(b.record);
    });
  });
  return map;
}

function queueSentTime_(record) {
  var value = record['Sent At'];
  var date = value instanceof Date ? value : new Date(value || 0);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function loadReplyScanState_(properties) {
  return {
    historyId: safeString_(properties.getProperty(NJCWWA_REPLY_SCAN.HISTORY_ID)),
    pageToken: safeString_(properties.getProperty(NJCWWA_REPLY_SCAN.PAGE_TOKEN)),
    targetHistoryId: safeString_(properties.getProperty(NJCWWA_REPLY_SCAN.TARGET_HISTORY_ID)),
    pending: parseReplyCandidates_(properties.getProperty(NJCWWA_REPLY_SCAN.PENDING))
  };
}

function parseReplyCandidates_(value) {
  if (!value) return [];
  try {
    var parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function (item) {
      if (typeof item === 'string') {
        var parts = item.split('|');
        return { id: safeString_(parts[0]), threadId: safeString_(parts[1]) };
      }
      return normalizeReplyCandidate_(item);
    }).filter(function (item) { return item.id && item.threadId; });
  } catch (error) {
    return [];
  }
}

function normalizeReplyCandidate_(candidate) {
  candidate = candidate || {};
  return { id: safeString_(candidate.id), threadId: safeString_(candidate.threadId) };
}

function saveReplyCandidates_(properties, candidates) {
  var compact = mergeReplyCandidates_(candidates || [], []);
  if (!compact.length) {
    properties.deleteProperty(NJCWWA_REPLY_SCAN.PENDING);
    return;
  }
  var encoded = compact.slice(0, 200).map(function (candidate) {
    return candidate.id + '|' + candidate.threadId;
  });
  properties.setProperty(NJCWWA_REPLY_SCAN.PENDING, JSON.stringify(encoded));
}

function mergeReplyCandidates_(first, second) {
  var seen = {};
  var merged = [];
  (first || []).concat(second || []).forEach(function (candidate) {
    var normalized = normalizeReplyCandidate_(candidate);
    if (!normalized.id || !normalized.threadId || seen[normalized.id]) return;
    seen[normalized.id] = true;
    merged.push(normalized);
  });
  return merged;
}

function finalizeReplyScanState_(properties, state) {
  saveReplyCandidates_(properties, state.pending);
  if (state.pending.length) {
    setOptionalProperty_(properties, NJCWWA_REPLY_SCAN.PAGE_TOKEN, state.pageToken);
    setOptionalProperty_(properties, NJCWWA_REPLY_SCAN.TARGET_HISTORY_ID, state.targetHistoryId);
    return;
  }

  if (state.pageToken) {
    setOptionalProperty_(properties, NJCWWA_REPLY_SCAN.PAGE_TOKEN, state.pageToken);
    setOptionalProperty_(properties, NJCWWA_REPLY_SCAN.TARGET_HISTORY_ID, state.targetHistoryId);
    return;
  }

  if (state.targetHistoryId) {
    properties.setProperty(NJCWWA_REPLY_SCAN.HISTORY_ID, state.targetHistoryId);
  }
  properties.deleteProperty(NJCWWA_REPLY_SCAN.PAGE_TOKEN);
  properties.deleteProperty(NJCWWA_REPLY_SCAN.TARGET_HISTORY_ID);
}

function setOptionalProperty_(properties, key, value) {
  if (safeString_(value)) properties.setProperty(key, safeString_(value));
  else properties.deleteProperty(key);
}

function clearReplyScanCursor_(properties) {
  properties.deleteProperty(NJCWWA_REPLY_SCAN.HISTORY_ID);
  properties.deleteProperty(NJCWWA_REPLY_SCAN.PAGE_TOKEN);
  properties.deleteProperty(NJCWWA_REPLY_SCAN.TARGET_HISTORY_ID);
  properties.deleteProperty(NJCWWA_REPLY_SCAN.PENDING);
}

function bootstrapReplyScan_(threadMap, processedIds) {
  var profile = Gmail.Users.getProfile('me');
  var targetHistoryId = safeString_(profile && profile.historyId);
  var query = 'newer_than:' + NJCWWA_REPLY_BOOTSTRAP_DAYS + 'd -from:' + NJCWWA.SENDER_EMAIL;
  var pageToken = '';
  var pages = 0;
  var candidates = [];

  while (pages < NJCWWA_REPLY_BOOTSTRAP_PAGES && candidates.length < 200) {
    var options = { q: query, maxResults: 100, includeSpamTrash: true };
    if (pageToken) options.pageToken = pageToken;
    var response = Gmail.Users.Messages.list('me', options);
    var messages = response.messages || [];
    messages.forEach(function (message) {
      if (!message || !message.id || !message.threadId) return;
      if (!threadMap[message.threadId] || processedIds[message.id]) return;
      candidates.push({ id: message.id, threadId: message.threadId });
    });
    pageToken = safeString_(response.nextPageToken);
    pages++;
    if (!pageToken) break;
  }

  return {
    candidates: mergeReplyCandidates_(candidates, []),
    targetHistoryId: targetHistoryId
  };
}

function fetchHistoryCandidates_(state, threadMap, processedIds) {
  var pageToken = state.pageToken;
  var candidates = [];
  var targetHistoryId = state.targetHistoryId || state.historyId;
  var pages = 0;

  while (pages < NJCWWA_REPLY_HISTORY_PAGES && candidates.length < NJCWWA_REPLY_SCAN_LIMIT) {
    var options = {
      startHistoryId: state.historyId,
      historyTypes: ['messageAdded'],
      maxResults: 50
    };
    if (pageToken) options.pageToken = pageToken;
    var response = Gmail.Users.History.list('me', options);
    targetHistoryId = safeString_(response.historyId) || targetHistoryId;
    collectHistoryCandidates_(response.history || [], candidates, threadMap, processedIds);
    pageToken = safeString_(response.nextPageToken);
    pages++;
    if (!pageToken) break;
  }

  return {
    candidates: mergeReplyCandidates_(candidates, []),
    nextPageToken: pageToken,
    targetHistoryId: targetHistoryId
  };
}

function collectHistoryCandidates_(historyRecords, output, threadMap, processedIds) {
  (historyRecords || []).forEach(function (history) {
    (history.messagesAdded || []).forEach(function (added) {
      var message = added && added.message;
      if (!message || !message.id || !message.threadId) return;
      if (!threadMap[message.threadId] || processedIds[message.id]) return;
      output.push({ id: message.id, threadId: message.threadId });
    });
  });
}

function processReplyCandidates_(candidates, threadMap, processedIds) {
  var checked = 0;
  var processed = 0;
  var errors = [];
  var retry = [];
  var quotaError = false;

  for (var i = 0; i < candidates.length; i++) {
    var candidate = normalizeReplyCandidate_(candidates[i]);
    if (!candidate.id || !candidate.threadId || processedIds[candidate.id]) continue;
    var queueEntries = threadMap[candidate.threadId];
    if (!queueEntries || !queueEntries.length) continue;

    var message;
    try {
      message = Gmail.Users.Messages.get('me', candidate.id, { format: 'full' });
      checked++;
    } catch (messageError) {
      retry.push(candidate);
      errors.push(candidate.id + ': ' + compactError_(messageError));
      if (isGmailQuotaError_(messageError)) {
        quotaError = true;
        retry = mergeReplyCandidates_(retry, candidates.slice(i + 1));
        break;
      }
      continue;
    }

    var headers = getMimeHeaderMap_(message.payload && message.payload.headers);
    var from = extractEmail_(headers.from || '');
    if (!from || from === NJCWWA.SENDER_EMAIL) {
      processedIds[candidate.id] = true;
      continue;
    }

    var sentDate = earliestQueueSentDate_(queueEntries);
    var receivedDate = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
    if (sentDate && !isNaN(sentDate.getTime()) && receivedDate < sentDate) {
      processedIds[candidate.id] = true;
      continue;
    }

    try {
      var result = processEmployerReply_({
        messageId: candidate.id,
        threadId: candidate.threadId,
        internalDate: message.internalDate,
        headers: headers,
        from: from,
        subject: headers.subject || '',
        originalBody: extractMessageBody_(message.payload),
        queueEntries: queueEntries
      });
      processedIds[candidate.id] = true;
      if (!result || !result.skipped) processed++;
    } catch (replyError) {
      retry.push(candidate);
      errors.push(candidate.id + ': ' + compactError_(replyError));
      if (isGmailQuotaError_(replyError)) {
        quotaError = true;
        retry = mergeReplyCandidates_(retry, candidates.slice(i + 1));
        break;
      }
    }
  }

  return {
    checked: checked,
    processed: processed,
    errors: errors,
    retry: mergeReplyCandidates_(retry, []),
    quotaError: quotaError
  };
}

function earliestQueueSentDate_(queueEntries) {
  var earliest = null;
  (queueEntries || []).forEach(function (entry) {
    var value = entry.record['Sent At'];
    var date = value instanceof Date ? value : new Date(value || 0);
    if (isNaN(date.getTime())) return;
    if (!earliest || date < earliest) earliest = date;
  });
  return earliest;
}

function summarizeScannerErrors_(errors) {
  if (!errors || !errors.length) return '';
  var quotaCount = 0;
  var other = [];
  errors.forEach(function (message) {
    if (isGmailQuotaError_(message)) quotaCount++;
    else if (other.length < 8) other.push(compactError_(message));
  });
  var parts = [];
  if (quotaCount) parts.push('Gmail quota/rate-limit errors: ' + quotaCount + '; processing paused with cursor preserved.');
  if (other.length) parts.push(other.join(' | '));
  if (errors.length > quotaCount + other.length) parts.push('Additional errors omitted: ' + (errors.length - quotaCount - other.length));
  return boundedCellText_(parts.join(' '), 8000);
}

function isInvalidHistoryError_(error) {
  var text = compactError_(error).toLowerCase();
  return text.indexOf('404') !== -1 ||
    text.indexOf('starthistoryid') !== -1 ||
    text.indexOf('history id') !== -1 && text.indexOf('not found') !== -1;
}

function getMimeHeaderMap_(headers) {
  var map = {};
  (headers || []).forEach(function (header) {
    map[safeString_(header.name).toLowerCase()] = safeString_(header.value);
  });
  return map;
}

function extractMessageBody_(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) return decodeBase64Url_(payload.body.data);
  var parts = payload.parts || [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].mimeType === 'text/plain') {
      var plain = extractMessageBody_(parts[i]);
      if (plain) return plain;
    }
  }
  for (var j = 0; j < parts.length; j++) {
    var nested = extractMessageBody_(parts[j]);
    if (nested) return nested;
  }
  if (payload.body && payload.body.data) {
    var decoded = decodeBase64Url_(payload.body.data);
    return payload.mimeType === 'text/html' ? stripHtml_(decoded) : decoded;
  }
  return '';
}

function decodeBase64Url_(value) {
  if (!value) return '';
  if (Array.isArray(value)) return Utilities.newBlob(value).getDataAsString('UTF-8');
  var encoded = String(value).replace(/\s/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  while (encoded.length % 4) encoded += '=';
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString('UTF-8');
}

function cleanReplyText_(text) {
  var value = String(text || '').replace(/\r/g, '');
  var cutPatterns = [/^On .+wrote:$/m, /^From:\s.+$/m, /^-----Original Message-----$/m, /^_{5,}$/m];
  for (var i = 0; i < cutPatterns.length; i++) {
    var match = value.match(cutPatterns[i]);
    if (match && match.index > 0) {
      value = value.slice(0, match.index);
      break;
    }
  }
  value = value.split('\n').filter(function (line) { return !/^>/.test(line.trim()); }).join('\n');
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function stripHtml_(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
