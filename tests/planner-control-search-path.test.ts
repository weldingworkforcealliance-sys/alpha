import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914233000_harden_planner_control_search_paths.sql'
  ),
  'utf8'
);

describe('planner/control SECURITY DEFINER hardening', () => {
  it('moves critical planner and agenda functions to an empty search path', () => {
    for (const signature of [
      'start_current_planner_day(uuid, date)',
      'complete_current_planner_day(uuid, date, integer, text, boolean, text)',
      'owner_clear_active_section_start(uuid, text)',
      'owner_move_section_to_day(uuid, integer, text)',
      'owner_reset_section_to_day(uuid, integer, text)',
      'owner_set_section_hold(uuid, boolean, text)',
      'save_my_agenda_slot_note(uuid, uuid, text, uuid, uuid, text)',
      'school_review_agenda_note_change(uuid, text, text, integer, text)',
      'owner_update_guide_agenda_slot(uuid, text, integer)',
      'owner_update_math_agenda_slot(uuid, text, integer)',
      'recalculate_guide_day_times(uuid)',
      'recalculate_math_lesson_times(uuid)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(12);
  });

  it('does not redefine planner behavior or grants', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
