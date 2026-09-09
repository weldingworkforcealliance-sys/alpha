import type { ReactNode } from 'react';
import DayCompletionNotesPanel from '@/app/components/day-completion-notes-panel';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DayCompletionNotesPanel />
      {children}
    </>
  );
}
