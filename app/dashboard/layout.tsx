import type { ReactNode } from 'react';
import DayCompletionNotesPanel from '@/app/components/day-completion-notes-panel';
import PlannerDeliveryReconciler from '@/app/components/planner-delivery-reconciler';
import PlannerScheduleStartGuard from '@/app/components/planner-schedule-start-guard';
import OrientationAttendanceAlert from '@/app/orientation-attendance-alert';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlannerDeliveryReconciler />
      <PlannerScheduleStartGuard />
      <DayCompletionNotesPanel />
      <OrientationAttendanceAlert />
      {children}
    </>
  );
}
