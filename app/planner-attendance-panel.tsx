'use client';

import { useEffect, useState } from 'react';
import AttendanceWorkspace from './attendance/attendance-workspace';
import {
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export default function PlannerAttendancePanel({ pathname }: { pathname: string }) {
  const [sectionId, setSectionId] = useState<string | null>(() => readSelectedSectionId());
  const [attendanceDate, setAttendanceDate] = useState(localDate);

  useEffect(() => {
    if (pathname !== '/dashboard') return;

    setSectionId(readSelectedSectionId());
    setAttendanceDate(localDate());
    return subscribeSelectedSection((nextSectionId) => {
      setSectionId(nextSectionId);
      setAttendanceDate(localDate());
    });
  }, [pathname]);

  if (pathname !== '/dashboard' || !sectionId) return null;

  return (
    <section className="ltg-planner-attendance-slot" aria-label="Planner student attendance controls">
      <AttendanceWorkspace
        embedded
        lockedSectionId={sectionId}
        lockedDate={attendanceDate}
      />
    </section>
  );
}
