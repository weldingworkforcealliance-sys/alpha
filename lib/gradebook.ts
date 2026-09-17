export type Gradebook = {
  id: string; section_id: string; section_name: string; section_status: string;
  course_pair_id: string | null; course_code: string; course_role: string;
  program_id: string; program_name: string; level_id: string | null; level_name: string | null;
  semester_id: string | null; semester_name: string | null; semester_number: number | null;
  cohort_id: string | null; term_id: string | null; pair_name: string | null;
};

// A curriculum pair is not a teaching cohort. Never pair different cohorts/terms,
// or guess when the section has no cohort or more than one counterpart.
export function linkedGradebook(book: Gradebook, books: Gradebook[]) {
  if (!book.course_pair_id || !book.cohort_id || !book.term_id) return null;
  const matches = books.filter(candidate => candidate.id !== book.id &&
    candidate.course_pair_id === book.course_pair_id && candidate.cohort_id === book.cohort_id &&
    candidate.term_id === book.term_id && candidate.course_role !== book.course_role &&
    ['theory', 'lab'].includes(candidate.course_role));
  return matches.length === 1 ? matches[0] : null;
}

export function scoreLabel(score: number | null, possible: number | null) {
  if (score === null || possible === null || possible <= 0) return '—';
  return `${score} / ${possible} (${Math.round(score / possible * 100)}%)`;
}

// A semester can exceed the API's default row limit. Never silently omit older attempts.
export async function readGradebookRows<T>(readPage: (from: number, to: number) =>
  PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
