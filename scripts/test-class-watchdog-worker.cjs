const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/send-class-watchdog-reminders/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal((compiled.diagnostics || []).length, 0);

async function runWorker({ stillDue = true, dueError = null, authorized = true } = {}) {
  let handler;
  const sent = [], updates = [];
  const row = { queue_id: 'test-queue', school_id: 'test-school', section_id: 'test-section',
    planner_day_id: 'test-day', event_type: 'end_overdue', recipient_user_id: null,
    recipient_email: 'instructor@example.invalid', scheduled_end_at: '2026-09-18T16:30:00Z', attempts: 1 };
  const client = {
    rpc: async (name) => {
      const data = {
        verify_attendance_worker_secret: authorized,
        get_attendance_worker_config: { resend_api_key: 'fake-test-key', attendance_from_email: 'test@example.invalid' },
        enqueue_class_watchdog_reminders: 1,
        claim_due_class_watchdog_reminders: [row],
        class_watchdog_reminder_is_due: stillDue,
      };
      assert.ok(Object.hasOwn(data, name), name);
      return { data: data[name], error: name === 'class_watchdog_reminder_is_due' ? dueError : null };
    },
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; },
        update(value) { updates.push(value); return chain; },
        maybeSingle: async () => ({ data: {
          sections: { section_name: 'PVHS A', section_code: 'PVHS-A-WLD205', course_id: 'course' },
          planner_days: { planner_day_number: 7, scheduled_date: '2026-09-17' },
          courses: { course_code: 'WLD 205', course_name: 'Theory' },
        }[table], error: null }),
        then(resolve) { resolve({ error: null }); },
      };
      return chain;
    },
  };
  vm.runInNewContext(compiled.outputText, {
    exports: {}, require: () => ({ createClient: () => client }),
    Deno: { env: { get: () => 'fake-test-value' }, serve: (fn) => { handler = fn; } },
    Response, Request, Date, Intl, AbortSignal,
    fetch: async (url, init) => {
      assert.equal(url, 'https://api.resend.com/emails');
      sent.push(JSON.parse(init.body));
      return Response.json({ id: 'fake-email' });
    },
  });
  const response = await handler(new Request('https://worker.example.invalid', {
    method: 'POST', headers: { 'x-attendance-cron-secret': 'fake-test-secret' },
  }));
  return { response, sent, updates };
}

test('mismatched planner date uses the actual class date in the attendance link', async () => {
  const { response, sent, updates } = await runWorker();
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /date=2026-09-18/);
  assert.doesNotMatch(sent[0].html, /date=2026-09-17/);
  assert.equal(updates.at(-1).status, 'sent');
});
test('class resolved after claim is cancelled without sending', async () => {
  const { sent, updates } = await runWorker({ stillDue: false });
  assert.equal(sent.length, 0);
  assert.equal(updates.at(-1).status, 'cancelled');
});
test('failed revalidation does not send and records a retryable failure', async () => {
  const { sent, updates } = await runWorker({ dueError: 'database unavailable' });
  assert.equal(sent.length, 0);
  assert.equal(updates.at(-1).status, 'failed');
});
test('invalid worker secret is rejected before sending', async () => {
  const { response, sent, updates } = await runWorker({ authorized: false });
  assert.equal(response.status, 401);
  assert.equal(sent.length, 0);
  assert.equal(updates.length, 0);
});
