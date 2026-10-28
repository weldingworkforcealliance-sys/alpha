import type { ReactNode } from 'react';
import Link from 'next/link';
import DayCompletionNotesPanel from '@/app/components/day-completion-notes-panel';
import PlannerDeliveryReconciler from '@/app/components/planner-delivery-reconciler';
import PlannerScheduleStartGuard from '@/app/components/planner-schedule-start-guard';

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlannerDeliveryReconciler />
      <PlannerScheduleStartGuard />
      <DayCompletionNotesPanel />
      {process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://ezlvivmeneefiiwqwgqd.supabase.co' && (
        <p><a href="/pvhs-review/index.html">PVHS 55-day planners and proposed dates</a> · <Link href="/signoffs">Instructor safety and QC signoffs — staging review</Link></p>
      )}
      {children}
    </>
  );
}
