import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914233500_harden_active_runtime_search_paths.sql'
  ),
  'utf8'
);

describe('active runtime SECURITY DEFINER hardening', () => {
  it('moves classroom, assignment, owner-agenda, and note-review RPCs to an empty search path', () => {
    for (const signature of [
      'end_classroom_session(uuid)',
      'get_classroom_submission_report(uuid)',
      'assign_section_instructor(uuid, uuid, text)',
      'deactivate_section_instructor(uuid, uuid)',
      'owner_assign_instructor_to_section(uuid, uuid, text, text)',
      'owner_remove_instructor_from_section(uuid, uuid, text)',
      'owner_decide_agenda_change(uuid, text, text)',
      'owner_move_guide_agenda_slot(uuid, integer)',
      'owner_move_math_agenda_slot(uuid, integer)',
      'review_day_completion_note(uuid, text, text)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(10);
  });

  it('does not redefine runtime behavior or grants', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
