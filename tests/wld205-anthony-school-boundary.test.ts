import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANTHONY_WLD205_PCCC_SCHOOL_ID,
  ANTHONY_WLD205_PCCC_SECTION_ID,
  ANTHONY_WLD205_PCCC_SECTION_CODE,
  isAnthonyWld205PilotSection,
} from '../lib/wld205-anthony-view';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261009183000_wld205_anthony_pilot_school_scope.sql'),
  'utf8'
);

describe('PCCC-only Anthony presentation boundary', () => {
  it('matches both exact PCCC UUIDs in SQL and UI', () => {
    expect(migration).toContain(ANTHONY_WLD205_PCCC_SCHOOL_ID);
    expect(migration).toContain(ANTHONY_WLD205_PCCC_SECTION_ID);
    expect(migration).toContain(ANTHONY_WLD205_PCCC_SECTION_CODE);
    expect(migration).toContain('alter policy planner_view_revisions_read');
    expect(migration).toContain('alter policy planner_view_revisions_append');
    expect(migration).toContain('public.can_manage_memberships(school_id)');
    expect(migration).toContain('si.instructor_id = (select auth.uid())');
  });

  it('keeps FABTECH workspaces with duplicate course codes ineligible', () => {
    const base = {
      school_id: ANTHONY_WLD205_PCCC_SCHOOL_ID,
      section_id: ANTHONY_WLD205_PCCC_SECTION_ID,
      course_code: 'WLD 205',
      section_code: ANTHONY_WLD205_PCCC_SECTION_CODE,
    };
    expect(isAnthonyWld205PilotSection(base)).toBe(true);
    for (const [school_id, section_id] of [
      ['b905a2d8-4d5a-4f53-b052-0f69de04a7b6', 'f2a13fac-044b-4c72-96e4-a4811ecfb849'],
      ['39939e9a-4f2e-49d8-b5d4-f4c533249352', '0c280ed3-3cc7-429d-b48c-5ab82e6906f4'],
    ]) {
      expect(isAnthonyWld205PilotSection({ ...base, school_id, section_id })).toBe(false);
    }
    expect(isAnthonyWld205PilotSection({
      ...base, section_code: 'PVHS-A-WLD205-2627'
    })).toBe(false);
  });

  it('does not mix WLD 210 or other WLD205 sections', () => {
    const school_id = ANTHONY_WLD205_PCCC_SCHOOL_ID;
    const section_id = ANTHONY_WLD205_PCCC_SECTION_ID;
    expect(isAnthonyWld205PilotSection({
      school_id, section_id, course_code: 'WLD 210', section_code: ANTHONY_WLD205_PCCC_SECTION_CODE,
    })).toBe(false);
    expect(isAnthonyWld205PilotSection({
      school_id, section_id: '626cc735-7488-4926-b200-f7fa0eebcb23',
      course_code: 'WLD 205', section_code: 'PVHS-A-WLD205-2627',
    })).toBe(false);
  });
});
