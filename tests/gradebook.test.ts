import { describe, expect, it } from 'vitest';
import { Gradebook, linkedGradebook, scoreLabel, readGradebookRows } from '../lib/gradebook';

const theory: Gradebook = { id: 't', section_id: 'st', section_name: 'Class', section_status: 'active',
  course_pair_id: 'pair', course_code: 'WLD 105', course_role: 'theory', program_id: 'p', program_name: 'Welding',
  level_id: 'l', level_name: 'Level I', semester_id: 'sm', semester_number: 1, semester_name: 'Semester 1',
  cohort_id: 'cohort', term_id: 'term', pair_name: 'Theory / Lab' };
const lab = { ...theory, id: 'lab', course_role: 'lab', course_code: 'WLD 110' };
describe('linked course gradebooks', () => {
  it('keeps the course books separate and matches their cohort and term', () => {
    expect(linkedGradebook(theory, [theory, lab])?.id).toBe('lab');
    expect(linkedGradebook(theory, [theory, { ...lab, cohort_id: 'other' }])).toBeNull();
    expect(linkedGradebook(theory, [theory, { ...lab, term_id: 'other' }])).toBeNull();
  });
  it('does not guess when cohort or term is missing or multiple partners exist', () => {
    expect(linkedGradebook({ ...theory, cohort_id: null }, [lab])).toBeNull();
    expect(linkedGradebook({ ...theory, term_id: null }, [lab])).toBeNull();
    expect(linkedGradebook(theory, [lab, { ...lab, id: 'second' }])).toBeNull();
  });
  it('supports later semesters and courses without course-code rules', () => {
    const future = { ...theory, course_pair_id: 'future', semester_number: 8, course_code: 'NEW 800' };
    expect(linkedGradebook(future, [{ ...lab, course_pair_id: 'future', semester_number: 8 }])).not.toBeNull();
  });
  it('distinguishes an actual zero from an ungraded record', () => {
    expect(scoreLabel(0, 10)).toBe('0 / 10 (0%)');
    expect(scoreLabel(null, null)).toBe('—');
    expect(scoreLabel(0, 0)).toBe('—');
  });
  it('loads older attempts beyond the API row limit and propagates failures', async () => {
    const attempts = Array.from({ length: 1003 }, (_, id) => ({ id }));
    expect(await readGradebookRows(async (from, to) => ({ data: attempts.slice(from, to + 1), error: null }))).toEqual(attempts);
    await expect(readGradebookRows(async () => ({ data: null, error: new Error('offline') }))).rejects.toThrow('offline');
  });
});
