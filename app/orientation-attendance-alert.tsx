'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type OrientationAlert = {
  attendanceDate: string;
  pairName: string;
  completionSectionId: string;
  status: string;
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

export default function OrientationAttendanceAlert() {
  const [supabase] = useState(getSupabase);
  const [orientation, setOrientation] = useState<OrientationAlert | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const today = localDate();
      const { data: sessions, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id,pair_id,attendance_date,status,session_type,counts_toward_attendance')
        .eq('session_type', 'orientation')
        .eq('counts_toward_attendance', false)
        .eq('attendance_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionError || cancelled || !sessions?.length) return;

      const session = sessions[0] as {
        pair_id: string;
        attendance_date: string;
        status: string;
      };

      const { data: pair, error: pairError } = await supabase
        .from('attendance_pairs')
        .select('pair_name,completion_section_id')
        .eq('id', session.pair_id)
        .maybeSingle();

      if (pairError || cancelled || !pair) return;

      setOrientation({
        attendanceDate: session.attendance_date,
        pairName: pair.pair_name,
        completionSectionId: pair.completion_section_id,
        status: session.status,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!orientation) return null;

  const href = `/attendance?section=${encodeURIComponent(
    orientation.completionSectionId
  )}&date=${encodeURIComponent(orientation.attendanceDate)}`;

  return (
    <section
      aria-label="Orientation attendance"
      style={{
        maxWidth: 1180,
        margin: '16px auto 0',
        padding: '16px 18px',
        border: '2px solid #b99239',
        borderRadius: 16,
        background: 'rgba(185, 146, 57, 0.12)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Tonight · Orientation · Non-Instructional
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Night Level 1 Orientation Attendance</div>
          <div style={{ marginTop: 4, opacity: 0.82 }}>
            {orientation.pairName} · {displayDate(orientation.attendanceDate)} ·{' '}
            {orientation.status === 'finalized' ? 'Finalized' : 'Ready to take attendance'}
          </div>
          <div style={{ marginTop: 5, fontSize: 13, opacity: 0.72 }}>
            This orientation record does not count toward course attendance. Official Night Level 1 attendance begins September 22, 2026.
          </div>
        </div>
        <a
          href={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            padding: '0 18px',
            borderRadius: 10,
            border: '1px solid currentColor',
            fontWeight: 800,
            textDecoration: 'none',
            color: 'inherit',
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          Open Orientation Attendance
        </a>
      </div>
    </section>
  );
}
