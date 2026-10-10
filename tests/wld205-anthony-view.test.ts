import { describe, expect, it } from 'vitest';
import {
  ANTHONY_WLD205_PRESET,
  ANTHONY_WLD205_PCCC_SCHOOL_ID,
  ANTHONY_WLD205_PCCC_SECTION_ID,
  anthonyDaySupport,
  anthonyMathDisplayText,
  isAnthonyWld205PilotSection,
  resolvePlannerViewPreset,
  usableMathBookReference,
  type PlannerViewRevision,
} from '../lib/wld205-anthony-view';

const section = {
  school_id: ANTHONY_WLD205_PCCC_SCHOOL_ID,
  section_id: ANTHONY_WLD205_PCCC_SECTION_ID,
  course_code: 'WLD 205',
  section_code: 'PCCC-DAY-L2-WLD205-2627',
};
const revision = (
  changes: Partial<PlannerViewRevision>
): PlannerViewRevision => ({
  id: '001',
  scope: 'school',
  instructor_id: null,
  preset: ANTHONY_WLD205_PRESET,
  changed_at: '2026-10-09T10:00:00Z',
  ...changes,
});

describe('Anthony WLD 205 view is isolated', () => {
  it('applies only to the PCCC 30-day section in production', () => {
    expect(isAnthonyWld205PilotSection(section)).toBe(true);
    expect(isAnthonyWld205PilotSection({ ...section, section_code: 'PVHS-A-WLD205-2627' })).toBe(false);
    expect(isAnthonyWld205PilotSection({ ...section, course_code: 'WLD 210' })).toBe(false);
    expect(isAnthonyWld205PilotSection({ ...section, section_code: 'SYNTHETIC' })).toBe(false);
    // FABTECH schools copy the same human-readable course and section codes.
    // Neither a matching name/code nor a matching UUID alone grants eligibility.
    expect(isAnthonyWld205PilotSection({
      ...section, school_id: 'b905a2d8-4d5a-4f53-b052-0f69de04a7b6',
    })).toBe(false);
    expect(isAnthonyWld205PilotSection({
      ...section, school_id: '39939e9a-4f2e-49d8-b5d4-f4c533249352',
    })).toBe(false);
    expect(isAnthonyWld205PilotSection({
      ...section, section_id: 'f2a13fac-044b-4c72-96e4-a4811ecfb849',
    })).toBe(false);
    expect(isAnthonyWld205PilotSection({
      ...section, section_id: '626cc735-7488-4926-b200-f7fa0eebcb23',
      section_code: 'PVHS-A-WLD205-2627',
    })).toBe(false);
  });

  it('uses inherited school view when no teacher override exists', () => {
    expect(resolvePlannerViewPreset([revision({})], 'teacher-1')).toEqual({
      preset: ANTHONY_WLD205_PRESET,
      source: 'school',
    });
  });

  it('prefers latest matching instructor revision over school preset', () => {
    const revisions = [
      revision({}),
      revision({ id: 'a', scope: 'instructor', instructor_id: 'teacher-1', preset: ANTHONY_WLD205_PRESET, changed_at: '2026-10-09T10:05:00Z' }),
      revision({ id: 'b', scope: 'instructor', instructor_id: 'teacher-1', preset: 'standard', changed_at: '2026-10-09T10:10:00Z' }),
      revision({ id: 'c', scope: 'instructor', instructor_id: 'teacher-2', preset: ANTHONY_WLD205_PRESET, changed_at: '2026-10-09T10:20:00Z' }),
    ];
    expect(resolvePlannerViewPreset(revisions, 'teacher-1')).toEqual({ preset: 'standard', source: 'instructor' });
    expect(resolvePlannerViewPreset(revisions, 'teacher-2')).toEqual({ preset: ANTHONY_WLD205_PRESET, source: 'instructor' });
  });

  it('allows an audited instructor inherit revision to follow school instead of pinning core', () => {
    const school = revision({ id: 'school', preset: ANTHONY_WLD205_PRESET });
    const teacher = revision({
      id: 'teacher',
      scope: 'instructor',
      instructor_id: 'teacher-1',
      preset: 'inherit',
      changed_at: '2026-10-09T10:15:00Z',
    });
    expect(resolvePlannerViewPreset([school, teacher], 'teacher-1')).toEqual({
      preset: ANTHONY_WLD205_PRESET,
      source: 'school',
    });
    expect(resolvePlannerViewPreset([teacher], 'teacher-1')).toEqual({
      preset: 'standard',
      source: 'core',
    });
  });

  it('defaults to protected core when no revisions exist', () => {
    expect(resolvePlannerViewPreset([], 'teacher-1')).toEqual({ preset: 'standard', source: 'core' });
  });

  it('filters empty book disclaimers without removing real references', () => {
    expect(usableMathBookReference('No textbook exercises reproduced; page references omitted.')).toBeNull();
    expect(usableMathBookReference('Chapter 2, welding dimensions')).toBe('Chapter 2, welding dimensions');
  });

  it('retains calculation accuracy on Days 10 and 11 only', () => {
    for (const day of [10, 11]) {
      const result = anthonyMathDisplayText('eep guard digits until the requested final precision', day);
      expect(result).toContain('round only the final result');
    }
    expect(anthonyMathDisplayText('Keep guard digits until the requested final precision', 9))
      .toBe('Keep guard digits until the requested final precision');
  });

  it('marks the Day 3 blueprint as pending approval rather than approved', () => {
    expect(anthonyDaySupport(1)).toEqual([]);
    expect(anthonyDaySupport(3)[0].body).toContain('only after school approval');
  });
});
