import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914234600_harden_reporting_analytics_search_paths.sql'
  ),
  'utf8'
);

describe('reporting and analytics SECURITY DEFINER hardening', () => {
  it('moves the final reporting, analytics, and synchronization functions to an empty search path', () => {
    for (const signature of [
      'can_view_ltg_reports(uuid)',
      'capture_ltg_table_analytics_event()',
      'finalize_ltg_report_snapshot(uuid)',
      'generate_ltg_report_snapshot(uuid, text, text, date, date)',
      'get_ltg_platform_reporting_summary(date, date)',
      'get_ltg_reporting_summary(uuid, date, date)',
      'ltg_reporting_summary_internal(uuid, date, date)',
      'mirror_audit_log_to_analytics_events()',
      'sync_completed_day_instructor_note()',
      'track_ltg_page_view(text)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(10);
  });

  it('does not redefine trigger/report behavior or grants', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
