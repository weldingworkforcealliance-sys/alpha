import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migration = read(
  'supabase/migrations/20260911154142_manager_historical_attendance_corrections.sql'
);
const upsertFix = read(
  'supabase/migrations/20260911154318_fix_manager_attendance_correction_upsert.sql'
);
const page = read('app/attendance/corrections/page.tsx');
const nav = read('app/attendance/attendance-nav.tsx');

describe('manager historical attendance corrections', () => {
  it('limits corrections to school management or Platform Owner authority', () => {
    expect(migration).toContain('public.can_manage_school(v_session.school_id)');
    expect(migration).toContain('public.can_manage_school(v_pair.school_id)');
    expect(migration).toContain('School administration or Platform Owner access required');
  });

  it('requires an audit reason and records previous and corrected values', () => {
    expect(migration).toContain('A correction reason is required');
    expect(migration).toContain("'attendance_record_corrected'");
    expect(migration).toContain("'old'");
    expect(migration).toContain("'new'");
    expect(migration).toContain("'report_already_sent'");
  });

  it('does not automatically resend an already delivered PVHS report', () => {
    expect(migration).toContain('Intentionally do not alter a sent PVHS report queue row');
    expect(page).toContain('does not automatically send a duplicate email');
  });

  it('supports missing historical sessions and finalized record correction', () => {
    expect(migration).toContain('manager_create_attendance_session');
    expect(migration).toContain("v_session.status = 'finalized'");
    expect(page).toContain('Create Past Attendance Session');
    expect(page).toContain('Save Correction');
  });

  it('keeps the ON CONFLICT correction path on the target alias', () => {
    expect(upsertFix).toContain('else ar.completion_confirmed');
    expect(upsertFix).toContain('ar_existing.session_id = p_session_id');
  });

  it('exposes the correction workspace only to owner or school management navigation', () => {
    expect(nav).toContain(".in('role', ['school_admin', 'program_lead'])");
    expect(nav).toContain("label: 'Correct Attendance'");
    expect(page).toContain('School administration or Platform Owner access is required.');
  });
});
