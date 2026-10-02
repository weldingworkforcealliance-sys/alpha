'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-browser';

type AttendanceAlert = {
  alert_type: 'missing' | 'unfinalized';
  session_id: string | null;
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
  const [supabase] = useState(getSupabase);
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([]);
  const [checkFailed, setCheckFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (pathname !== '/dashboard') return;

    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      setAlerts([]);
      setCheckFailed(false);
      return;
    }

    const { data, error } = await supabase.rpc('get_attendance_action_alerts', {
      p_as_of: localDate(),
    });

    if (error) {
      setCheckFailed(true);
      return;
    }

    setCheckFailed(false);
    setAlerts((data ?? []) as AttendanceAlert[]);
  }, [pathname, supabase]);

  useEffect(() => {
    if (pathname !== '/dashboard') return;

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'hidden') void refresh();
    };

    void refresh();
    const interval = window.setInterval(refreshIfVisible, 120_000);
    const onFocus = () => void refresh();
    const onVisibilityChange = () => refreshIfVisible();
    const onAttendanceFinalized = () => void refresh();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('ltg:attendance-finalized', onAttendanceFinalized);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('ltg:attendance-finalized', onAttendanceFinalized);
    };
  }, [pathname, refresh]);

  if (pathname !== '/dashboard') return null;

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
        Attendance status could not be verified. Open Student Attendance before ending the day.
      </section>
    );
  }

  if (!alerts.length) return null;

  const missingCount = alerts.filter((alert) => alert.alert_type === 'missing').length;
  const unfinalizedCount = alerts.length - missingCount;

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
        Attendance action required
      </strong>
      <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
        {missingCount > 0 && (
          <span>
            {missingCount} {missingCount === 1 ? 'class has' : 'classes have'} no recorded attendance.
          </span>
        )}{' '}
        {unfinalizedCount > 0 && (
          <span>
            {unfinalizedCount} {unfinalizedCount === 1 ? 'session is' : 'sessions are'} recorded but not finalized.
          </span>
        )}{' '}
        These are attendance-record problems, not email-delivery failures.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {alerts.map((alert) => {
          const isMissing = alert.alert_type === 'missing';
          return (
            <div
              key={`${alert.alert_type}:${alert.pair_id}:${alert.attendance_date}`}
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
                  {displayDate(alert.attendance_date)} ·{' '}
                  {isMissing
                    ? `Attendance not recorded for ${alert.student_count} students`
                    : `${alert.marked_count}/${alert.student_count} students marked; final confirmation pending`}
                </div>
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
                {isMissing ? 'Enter Attendance' : 'Review & Finalize'}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
