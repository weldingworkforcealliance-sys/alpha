'use client';

import { useEffect, useState } from 'react';
import AttendanceWorkspace from './attendance/attendance-workspace';
import { getSupabase } from '@/lib/supabase-browser';
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
  const [supabase] = useState(getSupabase);
  const [sectionId, setSectionId] = useState<string | null>(() => readSelectedSectionId());
  const [attendanceDate, setAttendanceDate] = useState(localDate);

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    let cancelled = false;

    const selectSection = async (nextSectionId: string | null) => {
      if (cancelled) return;
      setSectionId(nextSectionId);
      if (!nextSectionId) {
        setAttendanceDate(localDate());
        return;
      }

      const { data } = await supabase
        .from('current_teaching_sections')
        .select('scheduled_date')
        .eq('section_id', nextSectionId)
        .maybeSingle();

      if (!cancelled) {
        setAttendanceDate(data?.scheduled_date || localDate());
      }
    };

    void selectSection(readSelectedSectionId());
    const unsubscribe = subscribeSelectedSection((nextSectionId) => {
      void selectSection(nextSectionId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pathname, supabase]);

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
