import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migrationPath =
  'supabase/migrations/20260910191500_harden_connected_classroom_roles.sql';

describe('Connected Classroom role hardening', () => {
  it('limits class launch to Platform Owner, school management, or assigned section staff', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('public.can_review_instruction(target_school)');
    expect(migration).toContain(
      'public.is_section_instructor(target_school, p_section_id)'
    );
    expect(migration).toContain(
      "raise exception 'Assigned instructor or school management access required'"
    );
    expect(migration).not.toContain(
      'from public.current_teaching_sections\n    where section_id = p_section_id'
    );
  });

  it('requires a real teaching assignment or management role for answer keys', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('from public.school_memberships sm');
    expect(migration).toContain(
      "sm.role in ('school_admin','program_lead','lead_instructor')"
    );
    expect(migration).toContain('from public.section_instructors si');
    expect(migration).toContain('and si.active = true');
    expect(migration).toContain("sm.status = 'active'");
    expect(migration).toContain(
      "raise exception 'Active instructor assignment or school management access required'"
    );
    expect(migration).not.toContain(
      'not exists(select 1 from public.current_teaching_sections)'
    );
  });

  it('keeps privileged classroom RPCs unavailable to anonymous callers', () => {
    const migration = read(migrationPath);

    expect(migration).toContain(
      'revoke all on function public.start_classroom_session_v2(uuid, text, integer)\n  from public, anon;'
    );
    expect(migration).toContain(
      'revoke all on function public.get_assessment_answer_key(text)\n  from public, anon;'
    );
    expect(migration).toContain(
      'grant execute on function public.get_assessment_answer_key(text)\n  to authenticated;'
    );
  });
});
