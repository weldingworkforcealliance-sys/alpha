import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261119133000_validate_classroom_student_identity.sql'),
  'utf8',
);

describe('Live Classroom student identity preflight security', () => {
  it('only returns a boolean from an active, unexpired join-code session', () => {
    expect(migration).toContain('returns boolean');
    expect(migration).toContain("cs.status = 'active'");
    expect(migration).toContain('cs.expires_at > clock_timestamp()');
    expect(migration).toContain('upper(btrim(p_join_code))');
    expect(migration).not.toMatch(/returns\s+(table|jsonb)/i);
  });

  it('uses the existing pair-scoped roster checks rather than exposing student records', () => {
    expect(migration).toContain('ap.school_id = v_school_id');
    expect(migration).toContain('en.pair_id = v_pair_id and en.active = true and st.active = true');
    expect(migration).toContain('v_candidate_count <> 1');
    expect(migration).toContain('sub.student_uuid = v_match');
  });

  it('locks down anonymous access to one narrow function with an empty search path', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      'revoke all on function public.validate_classroom_student_identity(text, text, text)\n  from public, anon, authenticated;'
    );
    expect(migration).toContain(
      'grant execute on function public.validate_classroom_student_identity(text, text, text)\n  to anon, authenticated;'
    );
    expect(migration).not.toContain('grant select on public.attendance_students');
  });
});
