import { describe, expect, it } from 'vitest';
import { courseFinalRecords, type SavedCourseFinal } from '../lib/course-final-records';
import type { Gradebook } from '../lib/gradebook';

const book = { id: 'shop', course_code: 'WLD 110', section_name: 'Synthetic shop', course_role: 'lab' } as Gradebook;
const theory = { ...book, id: 'theory', course_code: 'WLD 105', course_role: 'theory' };
const final = { id: 'new', gradebook_id: 'shop', student_id: 'student', revision: '9007199254740994',
  snapshot: { grade: 65, passingScore: 65 }, reason: 'Reviewed correction', finalized_at: '2026-09-19T15:00:00Z' } satisfies SavedCourseFinal;
describe('official student course records', () => {
  it('preserves both linked courses and earlier finals in database order', () => {
    const result = courseFinalRecords([final, { ...final, id: 'theory-final', gradebook_id: 'theory' },
      { ...final, id: 'older', revision: '9007199254740993', snapshot: { grade: 0, passingScore: 65 } }], [book, theory], 'student');
    expect(result.map(row => row.latest)).toEqual([true, true, false]);
    expect(result.map(row => row.grade)).toEqual([65, 65, 0]);
    expect(result.map(row => row.role)).toEqual(['Shop', 'Theory', 'Shop']);
  });
  it('rejects another student, unavailable course metadata and malformed grades', () => {
    expect(() => courseFinalRecords([final], [book], 'other')).toThrow();
    expect(() => courseFinalRecords([final], [], 'student')).toThrow();
    expect(() => courseFinalRecords([{ ...final, snapshot: { grade: NaN, passingScore: 65 } }], [book], 'student')).toThrow();
  });
});
