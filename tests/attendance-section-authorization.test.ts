import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260910202000_scope_attendance_to_pair_authority.sql'),
  'utf8'
);

describe('attendance pair authorization hardening', () => {
  it('centralizes pair authority in a private helper', () => {
    expect(migration).toContain('create or replace function private.attendance_can_manage_pair');
    expect(migration).toContain("sm.role = 'instructor'::public.app_school_role");
    expect(migration).toContain('from public.section_instructors si');
    expect(migration).toContain('from public.planner_day_delivery pdd');
    expect(migration).toContain("pdd.delivery_status in ('in_progress','started')");
  });

  it('keeps school instructional management and Platform Owner oversight', () => {
    expect(migration).toContain('from public.platform_owners po');
    expect(migration).toContain("'school_admin'::public.app_school_role");
    expect(migration).toContain("'program_lead'::public.app_school_role");
    expect(migration).toContain("'lead_instructor'::public.app_school_role");
  });

  it('uses the pair-scoped check on every attendance mutation and completion gate', () => {
    const uses = migration.match(/private\.attendance_can_manage_pair\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(7);
    expect(migration).toContain('create or replace function public.open_attendance_session');
    expect(migration).toContain('create or replace function public.attendance_completion_requirement');
    expect(migration).toContain('create or replace function public.set_attendance_record');
    expect(migration).toContain('create or replace function public.mark_all_attendance');
    expect(migration).toContain('create or replace function public.reset_attendance_session');
    expect(migration).toContain('create or replace function public.finalize_attendance_session');
  });

  it('keeps browser attendance RPCs unavailable to anonymous callers', () => {
    expect(migration).toContain('from public,anon;');
    expect(migration).toContain('to authenticated,service_role;');
  });
});
