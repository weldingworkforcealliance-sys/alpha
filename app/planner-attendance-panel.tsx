'use client';

import { useEffect, useRef, useState } from 'react';
import AttendanceWorkspace from './attendance/attendance-workspace';
import { getSupabase } from '@/lib/supabase-browser';

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${month}/${day}/${year}` : value;
}

export default function PlannerAttendancePanel({
  sectionId, attendanceDate,
}: { sectionId: string; attendanceDate: string }) {
  const [supabase] = useState(getSupabase);
  const [completionNotice, setCompletionNotice] = useState('');
  const completionBypassRef = useRef(false);

  useEffect(() => {
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
            `Unable to verify attendance for ${displayDate(completionDate)} before completing the day: ${requirement.error.message}`
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
            `Attendance for ${displayDate(completionDate)} must be finalized before this class day can be completed. Review the paired-class attendance below and select Finalize Pair Attendance. Then tap Complete Day again.`
          );

          window.setTimeout(() => {
            const panel = document.getElementById('ltg-planner-attendance-slot');
            const details = panel?.querySelector('details');
            if (details instanceof HTMLDetailsElement) details.open = true;
            panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 0);
          return;
        }

        setCompletionNotice('');
        completionBypassRef.current = true;
        button.click();
      })();
    };

    document.addEventListener('click', handleCompleteDayClick, true);
    return () => document.removeEventListener('click', handleCompleteDayClick, true);
  }, [attendanceDate, sectionId, supabase]);

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
