import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260910210000_harden_anonymous_submission_limits.sql'
  ),
  'utf8'
);

describe('anonymous submission hardening', () => {
  it('bounds Live Classroom identity and response payloads', () => {
    expect(migration).toContain("char_length(btrim(p_student_name)) > 120");
    expect(migration).toContain("char_length(btrim(p_student_id)) > 80");
    expect(migration).toContain("octet_length(p_answers::text) > 65536");
    expect(migration).toContain("char_length(p_answers ->> q.question_key) > 2000");
  });

  it('locks the classroom session, deduplicates Student IDs, and applies an absolute public-write ceiling', () => {
    expect(migration).toContain('from public.classroom_sessions');
    expect(migration).toContain('for update;');
    expect(migration).toContain(
      'lower(btrim(sub.student_id)) = lower(btrim(p_student_id))'
    );
    expect(migration).toContain('if v_count >= 60 then');
    expect(migration).toContain(
      "raise exception 'This class session has reached its student capacity'"
    );
  });

  it('bounds persisted Live Job Card public input while preserving the 17-student capacity guard', () => {
    expect(migration).toContain("octet_length(p_start_check::text) > 8192");
    expect(migration).toContain("octet_length(p_quality_check::text) > 8192");
    expect(migration).toContain("octet_length(p_requirement_results::text) > 65536");
    expect(migration).toContain("char_length(coalesce(p_evidence_note, '')) > 2000");
    expect(migration).toContain(
      'if v_count >= v_session.expected_students or v_count >= 17 then'
    );
  });

  it('keeps only the two intended public write RPCs executable by anonymous callers', () => {
    expect(migration).toContain(
      'grant execute on function public.submit_classroom_assessment_v2(text, text, text, text, jsonb)\n  to anon, authenticated;'
    );
    expect(migration).toContain(
      'grant execute on function public.submit_job_card(text, text, text, jsonb, jsonb, jsonb, text, text)\n  to anon, authenticated;'
    );
  });
});
