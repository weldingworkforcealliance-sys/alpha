import type { Gradebook } from './gradebook';

export type SavedCourseFinal = {
  id: string; gradebook_id: string; student_id: string; revision: number | string;
  snapshot: { grade: number; passingScore: number }; reason: string; finalized_at: string;
};

// Rows arrive in descending database revision order. Do not sort bigint IDs in JS.
export function courseFinalRecords(rows: SavedCourseFinal[], books: Gradebook[], studentId: string) {
  const directory = new Map(books.map(book => [book.id, book]));
  const seen = new Set<string>();
  return rows.map(row => {
    const book = directory.get(row.gradebook_id);
    if (!book || row.student_id !== studentId || !Number.isFinite(row.snapshot?.grade)
      || !Number.isFinite(row.snapshot?.passingScore)) throw new Error('The official course record could not be verified.');
    const latest = !seen.has(book.id);
    seen.add(book.id);
    return { id: row.id, bookId: book.id, course: book.course_code, section: book.section_name,
      role: book.course_role === 'lab' ? 'Shop' : 'Theory', grade: row.snapshot.grade,
      passingScore: row.snapshot.passingScore, finalizedAt: row.finalized_at, reason: row.reason, latest };
  });
}
