import type { Gradebook } from './gradebook';

export function plannerWld105FabricationGradebook(books: Gradebook[], sectionId: string) {
  return books.find(book =>
    book.section_id === sectionId &&
    book.course_role === 'theory' &&
    book.course_code === 'WLD 105' &&
    book.section_status === 'active'
  ) ?? null;
}

export function nextPlannerFabricationSession(
  current: Gradebook | null,
  requested: Gradebook | null,
  saveBlocked: boolean,
) {
  return saveBlocked ? current : requested;
}
