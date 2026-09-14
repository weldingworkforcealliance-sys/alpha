import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914232500_harden_remaining_attendance_search_paths.sql'
  ),
  'utf8'
);

describe('remaining attendance SECURITY DEFINER hardening', () => {
  it('moves the three remaining attendance RPCs to an empty search path', () => {
    for (const signature of [
      'bulk_upsert_attendance_roster(uuid, text)',
      'request_attendance_report_resend(uuid)',
      'save_attendance_pair(uuid, uuid, uuid, text, text, text, integer, boolean)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(3);
  });

  it('does not alter attendance behavior or grants', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
