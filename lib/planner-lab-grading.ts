import type { Gradebook } from './gradebook';

// Resolve by section identity and catalog role, never a course-number allowlist.
export function plannerLabGradebook(books: Gradebook[], sectionId: string) {
  return books.find(book => book.section_id === sectionId &&
    book.course_role === 'lab' && book.section_status === 'active') ?? null;
}

export function nextPlannerLabSession(
  current: Gradebook | null, requested: Gradebook | null, saveBlocked: boolean,
) {
  return saveBlocked ? current : requested;
}
