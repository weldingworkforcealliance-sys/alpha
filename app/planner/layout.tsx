import type { ReactNode } from 'react';
import DayCompletionNotesPanel from '@/app/components/day-completion-notes-panel';

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DayCompletionNotesPanel />
      {children}
    </>
  );
}
