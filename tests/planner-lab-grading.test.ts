import { describe, expect, it } from 'vitest';
import type { Gradebook } from '../lib/gradebook';
import { nextPlannerLabSession, plannerLabGradebook } from '../lib/planner-lab-grading';

const book = (section: string, code: string, role = 'lab', status = 'active') => ({
  id: `book-${section}`, section_id: section, course_code: code,
  course_role: role, section_status: status,
} as Gradebook);

describe('planner lab grading context', () => {
  const b110 = book('b-110', 'WLD 110');
  const c110 = book('c-110', 'WLD 110');
  const a210 = book('a-210', 'WLD 210');
  const future = book('future-lab', 'WLD 310');
  const theory = book('b-105', 'WLD 105', 'theory');
  const archived = book('old-110', 'WLD 110', 'lab', 'archived');
  const books = [b110, c110, a210, future, theory, archived];

  it('opens the selected section, including cohorts sharing the same course code', () => {
    expect(plannerLabGradebook(books, 'c-110')).toBe(c110);
    expect(plannerLabGradebook(books, 'a-210')).toBe(a210);
  });
  it('recognizes future labs from their catalog role', () => {
    expect(plannerLabGradebook(books, 'future-lab')).toBe(future);
  });
  it('never falls back to another class for theory, archived, or unauthorized sections', () => {
    for (const section of ['b-105', 'old-110', 'not-authorized', '']) {
      expect(plannerLabGradebook(books, section)).toBeNull();
    }
  });
  it('retains the original grading session through pending or failed saves', () => {
    expect(nextPlannerLabSession(b110, c110, true)).toBe(b110);
    expect(nextPlannerLabSession(b110, null, true)).toBe(b110);
  });
  it('follows the new class only after the save is acknowledged', () => {
    expect(nextPlannerLabSession(b110, c110, false)).toBe(c110);
    expect(nextPlannerLabSession(b110, null, false)).toBeNull();
  });
});
