import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914234100_harden_training_runtime_search_paths.sql'
  ),
  'utf8'
);

describe('training runtime SECURITY DEFINER hardening', () => {
  it('moves training and training-report functions to an empty search path', () => {
    for (const signature of [
      'acknowledge_training_report(uuid)',
      'build_training_report(uuid)',
      'can_manage_training_session(uuid)',
      'can_receive_training_report(uuid)',
      'create_training_session(uuid, text)',
      'end_training_session(uuid, text)',
      'get_pending_training_reports()',
      'get_training_report(uuid)',
      'is_training_session_member(uuid)',
      'join_training_session(uuid)',
      'leave_training_session(uuid)',
      'queue_training_report_and_purge(uuid)',
      'touch_training_session(uuid)',
      'training_add_note(uuid, uuid, integer, text, text, boolean)',
      'training_complete_current_day(uuid, uuid, text, boolean, text)',
      'training_set_section_hold(uuid, uuid, boolean, text)',
      'training_start_current_day(uuid, uuid)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(17);
  });

  it('does not redefine training behavior or grants', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
