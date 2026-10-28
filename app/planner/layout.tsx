import Link from 'next/link';
import type { ReactNode } from 'react';
import DayCompletionNotesPanel from '@/app/components/day-completion-notes-panel';
import PlannerDeliveryReconciler from '@/app/components/planner-delivery-reconciler';
import PlannerScheduleStartGuard from '@/app/components/planner-schedule-start-guard';

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlannerDeliveryReconciler />
      <PlannerScheduleStartGuard />
      <DayCompletionNotesPanel />
      <nav aria-label="PVHS instructor resources" style={{padding: "12px 24px", display: "flex", gap: 24, flexWrap: "wrap"}}><Link href="/pvhs55/index.html">PVHS 55-day planners and calendar</Link><Link href="/signoffs">Instructor safety and QC signoffs</Link></nav>
      {children}
    </>
  );
}
