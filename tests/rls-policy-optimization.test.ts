import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260910123500_optimize_rls_policies.sql'
  ),
  'utf8'
);

describe('LTG RLS policy optimization', () => {
  it('uses init-plan friendly auth uid checks', () => {
    expect(migration).toContain('(SELECT auth.uid())');
    expect(migration).not.toMatch(/=\s*auth\.uid\(\)/);
  });

  it('preserves all ten optimized policy names', () => {
    for (const policy of [
      'school_memberships_select',
      'platform_owners_select',
      'instructor_notes_select',
      'instructor_notes_insert',
      'instructor_notes_update',
      'instructor_notes_delete',
      'profiles_insert',
      'profiles_select',
      'profiles_update',
      'analytics_events_insert',
    ]) {
      expect(migration).toContain(`CREATE POLICY ${policy}`);
    }
  });

  it('replaces attendance FOR ALL management policies with write-only policies', () => {
    for (const base of [
      'attendance_enrollments',
      'attendance_pairs',
      'attendance_students',
    ]) {
      expect(migration).toContain(`CREATE POLICY ${base}_insert_manage_school`);
      expect(migration).toContain(`CREATE POLICY ${base}_update_manage_school`);
      expect(migration).toContain(`CREATE POLICY ${base}_delete_manage_school`);
    }

    expect(migration).not.toMatch(/CREATE POLICY\s+\w+_manage_school[\s\S]{0,160}FOR ALL/i);
  });
});
