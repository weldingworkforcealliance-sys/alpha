export type AttendanceCloseoutStatus = {
  attendance_required?: boolean | null;
  pair_id?: string | null;
  session_id?: string | null;
  finalized?: boolean | null;
  primary_section_id?: string | null;
  completion_section_id?: string | null;
  active_student_count?: number | null;
  initial_marked_count?: number | null;
  missing_initial_count?: number | null;
};

export type AttendanceCloseoutAction = {
  targetSectionId: string;
  stage: 'initial' | 'final';
  heading: string;
  message: string;
  actionLabel: string;
};

function nonNegativeCount(value: number | null | undefined) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export function attendanceCloseoutAction(
  status: AttendanceCloseoutStatus | null | undefined
): AttendanceCloseoutAction | null {
  if (!status?.attendance_required || status.finalized) return null;

  const active = nonNegativeCount(status.active_student_count);
  const missing = nonNegativeCount(status.missing_initial_count);
  const needsInitial = !status.session_id || missing > 0;
  const targetSectionId = needsInitial
    ? status.primary_section_id
    : status.completion_section_id;

  if (!targetSectionId) return null;

  if (needsInitial) {
    const countMessage = active > 0
      ? `${missing} of ${active} students still need Present, Absent, Late, or Excused.`
      : 'Open the primary-course attendance and enter each student’s status.';

    return {
      targetSectionId,
      stage: 'initial',
      heading: 'Initial attendance required before Complete Day',
      message: `${countMessage} Enter those statuses in the primary course first. LTG will then route you to final confirmation.`,
      actionLabel: 'Enter Initial Attendance',
    };
  }

  return {
    targetSectionId,
    stage: 'final',
    heading: 'Attendance confirmation required before Complete Day',
    message: 'Initial attendance is saved. Review final attendance and press Finalize Pair Attendance. Complete Day will work after attendance is finalized.',
    actionLabel: 'Review & Finalize Attendance',
  };
}
