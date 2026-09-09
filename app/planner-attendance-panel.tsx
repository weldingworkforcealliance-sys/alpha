'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [completionNotice, setCompletionNotice] = useState('');
  const completionBypassRef = useRef(false);

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    let cancelled = false;

    const selectSection = async (nextSectionId: string | null) => {
      if (cancelled) return;
      setSectionId(nextSectionId);
      setCompletionNotice('');
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

  useEffect(() => {
    if (pathname !== '/dashboard' || !sectionId) return;

    const handleCompleteDayClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('button.complete-button') as HTMLButtonElement | null;
      if (!button || button.disabled) return;

      if (completionBypassRef.current) {
        completionBypassRef.current = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void (async () => {
        const actualDateInput = document.getElementById('actual-date') as HTMLInputElement | null;
        const completionDate = actualDateInput?.value || attendanceDate || localDate();

        const requirement = await supabase.rpc('attendance_completion_requirement', {
          p_section_id: sectionId,
          p_attendance_date: completionDate,
        });

        if (requirement.error) {
          setCompletionNotice(
            `Unable to verify attendance before completing the day: ${requirement.error.message}`
          );
          const panel = document.getElementById('ltg-planner-attendance-slot');
          panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        const row = Array.isArray(requirement.data)
          ? requirement.data[0]
          : requirement.data;

        if (row?.attendance_required && !row?.finalized) {
          setCompletionNotice(
            'Complete Day is waiting for the required end-of-day attendance confirmation. Review the paired-class attendance below and select Finalize Pair Attendance. Then tap Complete Day again.'
          );

          const panel = document.getElementById('ltg-planner-attendance-slot');
          const details = panel?.querySelector('details');
          if (details instanceof HTMLDetailsElement) details.open = true;
          panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        setCompletionNotice('');
        completionBypassRef.current = true;
        button.click();
      })();
    };

    document.addEventListener('click', handleCompleteDayClick, true);
    return () => document.removeEventListener('click', handleCompleteDayClick, true);
  }, [attendanceDate, pathname, sectionId, supabase]);

  if (pathname !== '/dashboard' || !sectionId) return null;

  return (
    <section
      id="ltg-planner-attendance-slot"
      className="ltg-planner-attendance-slot"
      aria-label="Planner student attendance controls"
    >
      {completionNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 10,
            padding: '11px 12px',
            border: '1px solid rgba(255, 154, 56, 0.58)',
            borderRadius: 8,
            background: 'rgba(255, 154, 56, 0.09)',
            color: '#ffd7ae',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 3, color: '#ffe7cb' }}>
            Attendance confirmation required
          </strong>
          {completionNotice}
        </div>
      )}

      <AttendanceWorkspace
        embedded
        lockedSectionId={sectionId}
        lockedDate={attendanceDate}
      />
    </section>
  );
}
