import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

async function runWorker(generation: number, finalized = true, secret = 'synthetic-secret') {
  let handler!: (request: Request) => Promise<Response>;
  const fetch = vi.fn(async () => new Response('{"id":"synthetic"}', { status: 200 }));
  const updates: unknown[] = [];
  const client = {
    rpc: async (name: string) => ({ data: name === 'verify_attendance_worker_secret' ? true : name === 'get_attendance_worker_config'
      ? { resend_api_key: 'synthetic-key', attendance_from_email: 'test@example.invalid' }
      : [{ queue_id: 'queue', session_id: 'session', recipient_email: 'one@example.invalid;two@example.invalid', delivery_generation: generation }], error: null }),
    from: (name: string) => {
      const data = name === 'attendance_sessions' ? { id: 'session', pair_id: 'pair', attendance_date: '2026-10-24', finalized_at: finalized ? '2026-10-24' : null }
        : name === 'attendance_pairs' ? { id: 'pair', pair_name: '<Synthetic>', attendance_mode: 'pvhs' } : [];
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data, error: null }),
        update: (value: unknown) => { updates.push(value); return query; },
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
      return query;
    },
  };
  const source = readFileSync('supabase/functions/send-attendance-reports/index.ts', 'utf8').replace(/^import [^\n]*\n/, '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  runInNewContext(code, { exports: {}, createClient: () => client, fetch, Response, Deno: {
    env: { get: () => 'synthetic-config' }, serve: (fn: typeof handler) => { handler = fn; },
  } });
  const response = await handler(new Request('https://example.invalid', { method: 'POST', headers: secret ? { 'x-attendance-cron-secret': secret } : {} }));
  return { fetch, response, updates };
}

it('uses stable per-recipient keys for retries and fresh keys for requested resends', async () => {
  const first = await runWorker(1), retry = await runWorker(1), resend = await runWorker(2);
  const keys = (run: typeof first) => run.fetch.mock.calls.map(call => (call as unknown as [string, RequestInit])[1].headers as Record<string, string>).map(h => h['Idempotency-Key']);
  expect(keys(first)).toEqual(['attendance-report/queue/g1/r0', 'attendance-report/queue/g1/r1']);
  expect(keys(retry)).toEqual(keys(first));
  expect(keys(resend)).toEqual(['attendance-report/queue/g2/r0', 'attendance-report/queue/g2/r1']);
  expect(first.updates).toContainEqual(expect.objectContaining({ status: 'sent' }));
});

it('does not send an unfinalized attendance record', async () => {
  const run = await runWorker(1, false);
  expect(run.fetch).not.toHaveBeenCalled();
  expect(run.updates).toContainEqual(expect.objectContaining({ status: 'failed' }));
});

it('rejects unauthenticated worker requests before sending', async () => {
  const run = await runWorker(1, true, '');
  expect(run.response.status).toBe(401);
  expect(run.fetch).not.toHaveBeenCalled();
});
