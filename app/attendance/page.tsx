'use client';

import OrientationAttendanceAlert from '@/app/orientation-attendance-alert';
import AttendanceWorkspace from './attendance-workspace';

export default function AttendancePage() {
  return (
    <>
      <OrientationAttendanceAlert />
      <AttendanceWorkspace />
    </>
  );
}
