/**
 * Gmail reply discovery, MIME decoding, and idempotent dispatch.
 */

function scanEmployerReplies() {
  var started = new Date();
  return withScriptLock_(function () {
    var checked = 0; var changed = 0; var errors = [];
    try {
      assertAllianceAccount_(); assertRequiredSheets_();
      var queueEntries = getRecords_(NJCWWA.SHEETS.QUEUE); var threadMap = {};
      queueEntries.forEach(function (entry) {
        var threadId = safeString_(entry.record['Gmail Thread ID']); var sendStatus = safeString_(entry.record['Send Status']).toLowerCase();
        if (!threadId || sendStatus !== 'sent') return;
        if (!threadMap[threadId]) threadMap[threadId] = [];
        threadMap[threadId].push(entry);
      });
      var threadIds = Object.keys(threadMap);
      if (!threadIds.length) { logAutomation_('scanEmployerReplies','Completed',0,0,0,'',secondsSince_(started),'No sent queue threads to scan.'); return {checked:0,processed:0,errors:[]}; }
      var processedIds = getProcessedMessageIdSet_();
      threadIds.forEach(function (threadId) {
        try {
          var thread = Gmail.Users.Threads.get('me',threadId,{format:'full'}); var messages=thread.messages||[]; checked+=messages.length;
          messages.sort(function(a,b){return Number(a.internalDate||0)-Number(b.internalDate||0);});
          messages.forEach(function(message){
            if(!message.id||processedIds[message.id])return;
            var headers=getMimeHeaderMap_(message.payload&&message.payload.headers);var from=extractEmail_(headers.from||'');
            if(!from||from===NJCWWA.SENDER_EMAIL)return;
            var primary=threadMap[threadId][0];var sentAt=primary.record['Sent At'];var sentDate=sentAt instanceof Date?sentAt:new Date(sentAt||0);var receivedDate=message.internalDate?new Date(Number(message.internalDate)):new Date();
            if(!isNaN(sentDate.getTime())&&receivedDate<sentDate)return;
            try { processEmployerReply_({messageId:message.id,threadId:threadId,internalDate:message.internalDate,headers:headers,from:from,subject:headers.subject||'',originalBody:extractMessageBody_(message.payload),queueEntries:threadMap[threadId]}); processedIds[message.id]=true; changed++; }
            catch(replyError){errors.push(message.id+': '+replyError.message);}
          });
        } catch(threadError){errors.push(threadId+': '+threadError.message);}
      });
      logAutomation_('scanEmployerReplies',errors.length?'Completed with errors':'Completed',checked,changed,0,errors.join(' | '),secondsSince_(started),'Threads scanned: '+threadIds.length);
      return {checked:checked,processed:changed,errors:errors};
    } catch(error){logAutomation_('scanEmployerReplies','Failed',checked,changed,0,error.message,secondsSince_(started),'');throw error;}
  });
}

function getMimeHeaderMap_(headers){var map={};(headers||[]).forEach(function(header){map[safeString_(header.name).toLowerCase()]=safeString_(header.value);});return map;}
function extractMessageBody_(payload){if(!payload)return'';if(payload.mimeType==='text/plain'&&payload.body&&payload.body.data)return decodeBase64Url_(payload.body.data);var parts=payload.parts||[];for(var i=0;i<parts.length;i++){if(parts[i].mimeType==='text/plain'){var plain=extractMessageBody_(parts[i]);if(plain)return plain;}}for(var j=0;j<parts.length;j++){var nested=extractMessageBody_(parts[j]);if(nested)return nested;}if(payload.body&&payload.body.data){var decoded=decodeBase64Url_(payload.body.data);return payload.mimeType==='text/html'?stripHtml_(decoded):decoded;}return'';}
function decodeBase64Url_(value){if(!value)return'';return Utilities.newBlob(Utilities.base64DecodeWebSafe(value)).getDataAsString('UTF-8');}
function cleanReplyText_(text){var value=String(text||'').replace(/\r/g,'');var cutPatterns=[/^On .+wrote:$/m,/^From:\s.+$/m,/^-----Original Message-----$/m,/^_{5,}$/m];for(var i=0;i<cutPatterns.length;i++){var match=value.match(cutPatterns[i]);if(match&&match.index>0){value=value.slice(0,match.index);break;}}value=value.split('\n').filter(function(line){return!/^>/.test(line.trim());}).join('\n');return value.replace(/\n{3,}/g,'\n\n').trim();}
function stripHtml_(html){return String(html||'').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/[ \t]+/g,' ').trim();}
