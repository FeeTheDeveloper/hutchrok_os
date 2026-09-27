/**
 * Hutchrok OS — Mailbox Forwarder (Google Apps Script)
 *
 * Use this when the OS mailbox (repo_addy@hutchrok.com) lives in Google
 * Workspace instead of Resend inbound. It forwards every new inbox message
 * to Hutchrok OS as a signed JSON payload:
 *
 *   POST {OS_API_URL}/webhooks/email/inbound
 *   x-hutchrok-timestamp: <unix seconds>
 *   x-hutchrok-signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<body>">
 *
 * Setup (signed in as the OS mailbox account):
 *   1. script.google.com → New project → paste this file.
 *   2. Project Settings → Script properties:
 *        OS_API_URL            https://os.hutchrok.com   (your OS API base URL)
 *        EMAIL_INBOUND_SECRET  same value as the OS API env var
 *   3. Run `install` once and grant Gmail + external request scopes.
 *      It creates a 1-minute trigger for `forwardNewMail`.
 *
 * Messages are labeled `hutchrok-os/forwarded` after a 2xx response, so they
 * are never sent twice. The OS also dedupes by Message-ID.
 */

var LABEL_NAME = 'hutchrok-os/forwarded';
var FAILED_LABEL_NAME = 'hutchrok-os/failed';
var MAX_THREADS_PER_RUN = 25;

function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'forwardNewMail') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('forwardNewMail').timeBased().everyMinutes(1).create();
  getOrCreateLabel_(LABEL_NAME);
  getOrCreateLabel_(FAILED_LABEL_NAME);
}

function forwardNewMail() {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = props.getProperty('OS_API_URL');
  var secret = props.getProperty('EMAIL_INBOUND_SECRET');
  if (!apiUrl || !secret) throw new Error('Set OS_API_URL and EMAIL_INBOUND_SECRET script properties.');

  var forwarded = getOrCreateLabel_(LABEL_NAME);
  var failed = getOrCreateLabel_(FAILED_LABEL_NAME);
  var me = Session.getEffectiveUser().getEmail().toLowerCase();
  var threads = GmailApp.search('in:inbox -label:' + LABEL_NAME + ' newer_than:2d', 0, MAX_THREADS_PER_RUN);

  threads.forEach(function (thread) {
    var allOk = true;
    thread.getMessages().forEach(function (message) {
      var from = message.getFrom();
      if (extractEmail_(from) === me) return; // our own outbound copies

      var payload = {
        providerMessageId: message.getId(),
        internetMessageId: message.getHeader('Message-ID') || undefined,
        inReplyTo: message.getHeader('In-Reply-To') || undefined,
        references: splitRefs_(message.getHeader('References')),
        from: extractEmail_(from),
        fromName: extractName_(from),
        to: splitAddresses_(message.getTo()),
        cc: splitAddresses_(message.getCc()),
        subject: message.getSubject() || '(no subject)',
        text: message.getPlainBody() || '',
        headers: pickHeaders_(message),
        receivedAt: message.getDate().toISOString(),
        provider: 'gmail',
      };

      var body = JSON.stringify(payload);
      var ts = String(Math.floor(Date.now() / 1000));
      var res = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/webhooks/email/inbound', {
        method: 'post',
        contentType: 'application/json',
        payload: body,
        muteHttpExceptions: true,
        headers: {
          'x-hutchrok-timestamp': ts,
          'x-hutchrok-signature': 'sha256=' + hmacHex_(ts + '.' + body, secret),
        },
      });
      if (res.getResponseCode() >= 300) {
        allOk = false;
        console.error('Hutchrok OS rejected ' + message.getId() + ': HTTP ' + res.getResponseCode());
      }
    });
    thread.addLabel(allOk ? forwarded : failed);
  });
}

function hmacHex_(value, key) {
  var bytes = Utilities.computeHmacSha256Signature(value, key, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

function pickHeaders_(message) {
  var names = ['Auto-Submitted', 'Precedence', 'List-Id', 'List-Unsubscribe', 'X-Autoreply', 'X-Autorespond'];
  var out = {};
  names.forEach(function (n) {
    var v = message.getHeader(n);
    if (v) out[n.toLowerCase()] = v;
  });
  return out;
}

function extractEmail_(raw) {
  var m = String(raw || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(raw || '')).trim().toLowerCase();
}

function extractName_(raw) {
  var m = String(raw || '').match(/^\s*"?([^"<]*?)"?\s*</);
  return m && m[1] ? m[1].trim() : undefined;
}

function splitAddresses_(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(extractEmail_).filter(function (x) { return x; });
}

function splitRefs_(raw) {
  if (!raw) return [];
  return String(raw).split(/\s+/).filter(function (x) { return x; });
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
