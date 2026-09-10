import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migrationPath =
  'supabase/migrations/20260910113000_stabilization_security_hardening.sql';

describe('LTG stabilization security hardening', () => {
  it('removes authenticated/anonymous direct access to internal helper RPCs', () => {
    const migration = read(migrationPath);

    for (const signature of [
      'public.build_training_report(uuid)',
      'public.queue_training_report_and_purge(uuid)',
      'public.recalculate_guide_day_times(uuid)',
      'public.recalculate_math_lesson_times(uuid)',
      'public.sync_auth_user_profile()',
      'public.sync_completed_day_instructor_note()',
    ]) {
      expect(migration).toContain(`revoke execute on function ${signature}`);
    }

    expect(migration).toContain('from public, anon, authenticated;');
  });

  it('keeps retired Connected Classroom v1 RPCs off the user-facing RPC surface', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('public.list_assessment_modules()');
    expect(migration).toContain('public.start_classroom_session(uuid, text)');
    expect(migration).toContain(
      'public.submit_classroom_assessment(text, text, text, jsonb)'
    );
  });

  it('removes only the two verified redundant non-unique indexes', () => {
    const migration = read(migrationPath);

    expect(migration).toContain(
      'drop index if exists public.attendance_sessions_pair_date_idx;'
    );
    expect(migration).toContain(
      'drop index if exists public.training_delivery_session_idx;'
    );
  });
});
