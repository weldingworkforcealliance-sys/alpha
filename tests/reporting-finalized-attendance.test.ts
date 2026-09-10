import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260910180000_reporting_finalized_attendance_only.sql'
  ),
  'utf8'
);

describe('LTG finalized attendance reporting', () => {
  it('keeps total and finalized session counts separate', () => {
    expect(migration).toContain("count(*) filter (where s.status = 'finalized')");
    expect(migration).toContain('v_attendance_sessions');
    expect(migration).toContain('v_attendance_finalized');
  });

  it('restricts official attendance records and status aggregation to finalized sessions', () => {
    const finalizedFilters = migration.match(/and s\.status = 'finalized'/g) ?? [];
    expect(finalizedFilters.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("coalesce(r.final_status, 'not_recorded')");
  });

  it('preserves draft attendance as a data-quality signal', () => {
    expect(migration).toContain("'unfinalized_attendance_sessions'");
    expect(migration).toContain('greatest(v_attendance_sessions-v_attendance_finalized,0)');
  });

  it('does not mutate or delete attendance sessions or records', () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.attendance_(sessions|records)/i);
    expect(migration).not.toMatch(/update\s+public\.attendance_(sessions|records)/i);
  });
});
