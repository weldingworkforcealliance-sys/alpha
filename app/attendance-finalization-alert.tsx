'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-browser';
import { subscribeAttendanceFinalized } from '@/lib/attendance-events';

type AttendanceAlert = {
  session_id: string;
  pair_id: string;
  pair_name: string;
  attendance_date: string;
  completion_section_id: string;
  attendance_mode: string;
  marked_count: number;
  student_count: number;
  is_overdue: boolean;
};

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

export default function AttendanceFinalizationAlert({ pathname }: { pathname: string }) {
  // Discard the previous dashboard's results while attendance is being edited.
  return pathname === '/dashboard' ? <DashboardAttendanceAlert /> : null;
}

function DashboardAttendanceAlert() {
  const [supabase] = useState(getSupabase);
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([]);
  const [checkFailed, setCheckFailed] = useState(false);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (version !== requestVersion.current) return;
      if (authError) throw authError;
      if (!auth.session) {
        setAlerts([]);
        setCheckFailed(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_unfinalized_attendance_alerts', {
        p_as_of: localDate(),
      });
      if (version !== requestVersion.current) return;
      if (error) throw error;
      setCheckFailed(false);
      setAlerts((data ?? []) as AttendanceAlert[]);
    } catch {
      if (version !== requestVersion.current) return;
      setCheckFailed(true);
    }
  }, [supabase]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const unsubscribe = subscribeAttendanceFinalized(() => void refresh());

    return () => {
      requestVersion.current += 1;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refresh]);

  if (checkFailed) {
    return (
      <section
        role="status"
        aria-live="polite"
        style={{
          margin: '12px 18px 0',
          padding: '10px 12px',
          border: '1px solid rgba(255, 154, 56, 0.45)',
          borderRadius: 8,
          background: 'rgba(255, 154, 56, 0.07)',
          color: '#ffd7ae',
          fontSize: 13,
        }}
      >
        Attendance finalization status could not be verified. Open Student Attendance before ending the day.
      </section>
    );
  }

  if (!alerts.length) return null;

  return (
    <section
      role="alert"
      aria-live="assertive"
      style={{
        margin: '12px 18px 0',
        padding: '14px 15px',
        border: '1px solid rgba(255, 154, 56, 0.72)',
        borderRadius: 10,
        background: 'rgba(255, 122, 26, 0.11)',
        boxShadow: '0 0 18px rgba(255, 122, 26, 0.08)',
        color: '#ffe1bf',
      }}
    >
      <strong style={{ display: 'block', color: '#fff0df', fontSize: 15, marginBottom: 5 }}>
        Attendance still needs final confirmation
      </strong>
      <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
        {alerts.length === 1
          ? 'Student statuses are saved, but this attendance session still needs Finalize Pair Attendance.'
          : `${alerts.length} attendance sessions have saved student statuses but still need Finalize Pair Attendance.`}
        {' '}Review the class and date below, then confirm the full course pair.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {alerts.map((alert) => (
          <div
            key={alert.session_id}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              padding: '9px 10px',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.18)',
            }}
          >
            <div>
              <strong style={{ color: '#fff' }}>{alert.pair_name}</strong>
              <div style={{ marginTop: 2, fontSize: 12, color: '#d6c0aa' }}>
                {alert.is_overdue ? 'OVERDUE · ' : ''}
                {displayDate(alert.attendance_date)} · {alert.marked_count}/{alert.student_count} students marked
              </div>
              {alert.attendance_mode === 'pvhs' && (
                <div style={{ marginTop: 2, fontSize: 12 }}>The final PVHS email is queued after pair finalization.</div>
              )}
            </div>
            <Link
              href={`/attendance?section=${encodeURIComponent(alert.completion_section_id)}&date=${encodeURIComponent(
                alert.attendance_date
              )}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 36,
                padding: '0 12px',
                border: '1px solid rgba(255, 176, 92, 0.72)',
                borderRadius: 7,
                color: '#ffe7cb',
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              Review &amp; Finalize
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
