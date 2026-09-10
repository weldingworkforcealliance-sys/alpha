import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260910133000_attendance_student_identity_repair.sql'
  ),
  'utf8'
);

describe('attendance student identity stabilization', () => {
  it('extracts a leading numeric Student ID from pasted roster lines', () => {
    expect(migration).toContain("'^([0-9]{3,})[[:space:]]+'");
    expect(migration).toContain('v_external_student_id');
    expect(migration).toContain('external_student_id = v_external_student_id');
  });

  it('prefers existing canonical/enrolled students rather than creating duplicates', () => {
    expect(migration).toContain('(s.external_student_id = v_external_student_id) desc');
    expect(migration).toContain('public.attendance_pair_enrollments e');
    expect(migration).toContain('and e.active');
    expect(migration).toContain('on conflict (pair_id, student_id)');
  });

  it('backfills learning links by exact school Student ID only', () => {
    expect(migration).toContain('update public.classroom_submissions sub');
    expect(migration).toContain('update public.job_card_submissions sub');
    expect(migration).toContain(
      'btrim(student.external_student_id) = btrim(sub.student_id)'
    );
    expect(migration).not.toMatch(/lower\([^\n]*student_name[^\n]*\)/i);
  });

  it('preserves historical duplicate rows instead of deleting attendance history', () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.attendance_students/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.attendance_records/i);
  });
});
