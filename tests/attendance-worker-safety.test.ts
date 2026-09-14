import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const worker = readFileSync(
  join(process.cwd(), 'supabase/functions/send-attendance-reports/index.ts'),
  'utf8'
);

describe('attendance report worker safety', () => {
  it('keeps privileged execution behind the cron secret check', () => {
    expect(worker).toContain("req.headers.get('x-attendance-cron-secret')");
    expect(worker).toContain("supabase.rpc(\n    'verify_attendance_worker_secret'");
    expect(worker).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
  });

  it('bounds outbound email fan-out and network wait time', () => {
    expect(worker).toContain('const MAX_REPORT_RECIPIENTS = 20;');
    expect(worker).toContain('const RESEND_TIMEOUT_MS = 15_000;');
    expect(worker).toContain('AbortSignal.timeout(RESEND_TIMEOUT_MS)');
    expect(worker).toContain('recipients.length > MAX_REPORT_RECIPIENTS');
  });

  it('sends independent recipients concurrently while preserving idempotency keys', () => {
    expect(worker).toContain('await Promise.all(');
    expect(worker).toContain('recipients.map((recipient, index) =>');
    expect(worker).toContain('delivery_generation');
    expect(worker).toContain('Idempotency-Key');
  });

  it('escapes attendance content before inserting it into report HTML', () => {
    expect(worker).toContain('function escapeHtml');
    expect(worker).toContain(".replaceAll('<', '&lt;')");
    expect(worker).toContain(".replaceAll('>', '&gt;')");
    expect(worker).toContain('escapeHtml(record.notes || \'\')');
  });
});
