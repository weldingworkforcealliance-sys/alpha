import type { ReactNode } from 'react';
import DayCompletionNotesPanel from '@/app/components/day-completion-notes-panel';
import PlannerDeliveryReconciler from '@/app/components/planner-delivery-reconciler';

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlannerDeliveryReconciler />
      <DayCompletionNotesPanel />
      {children}
    </>
  );
}
