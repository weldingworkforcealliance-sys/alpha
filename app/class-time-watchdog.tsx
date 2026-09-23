'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { publishSelectedSection } from '@/lib/section-selection';

type TeachingSection = {
  school_id: string;
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
  current_planner_day_number: number | null;
  planner_day_id: string | null;
  scheduled_date: string | null;
};

type WatchRow = {
  sectionId: string;
  plannerDayId: string;
  scheduledDate: string;
  dayNumber: number | null;
  sectionLabel: string;
  courseLabel: string;
  startTime: string;
  endTime: string;
  deliveryStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  requiresFinalAttendance: boolean;
  attendanceFinalized: boolean;
};

type WatchAlert = WatchRow & {
  severity: 'start' | 'end' | 'overdue';
  endMs: number;
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function localDateTime(date: string, time: string) {
  const normalized = time.length >= 8 ? time.slice(0, 8) : time;
  return new Date(`${date}T${normalized}`).getTime();
}

function formatTime(time: string) {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export default function ClassTimeWatchdog() {
  const [supabase] = useState(getSupabase);
  const [rows, setRows] = useState<WatchRow[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [audioReady, setAudioReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const unlock = async () => {
      try {
        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return;
        const context = audioContextRef.current ?? new AudioCtor();
        audioContextRef.current = context;
        if (context.state === 'suspended') await context.resume();
        setAudioReady(context.state === 'running');
      } catch {
        setAudioReady(false);
      }
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const today = localDate();
      const { data: teachingData, error: teachingError } = await supabase
        .from('current_teaching_sections')
        .select(
          'school_id,section_id,section_name,section_code,course_code,course_name,current_planner_day_number,planner_day_id,scheduled_date'
        );

      if (cancelled || teachingError) return;

      const todaySections = ((teachingData ?? []) as TeachingSection[]).filter(
        (section) => section.scheduled_date === today && Boolean(section.planner_day_id)
      );

      if (!todaySections.length) {
        setRows([]);
        return;
      }

      const sectionIds = todaySections.map((section) => section.section_id);
      const plannerDayIds = todaySections
        .map((section) => section.planner_day_id)
        .filter((value): value is string => Boolean(value));

      const [timingResult, deliveryResult, pairResult] = await Promise.all([
        supabase
          .from('sections')
          .select('id,start_time,end_time')
          .in('id', sectionIds),
        supabase
          .from('planner_day_delivery')
          .select('planner_day_id,delivery_status,started_at,completed_at')
          .in('planner_day_id', plannerDayIds),
        supabase
          .from('attendance_pairs')
          .select('id,completion_section_id')
          .eq('active', true)
          .in('completion_section_id', sectionIds),
      ]);

      if (cancelled || timingResult.error || deliveryResult.error || pairResult.error) return;

      type SectionTiming = { id: string; start_time: string | null; end_time: string | null };
      type DayDelivery = {
        planner_day_id: string;
        delivery_status: string | null;
        started_at: string | null;
        completed_at: string | null;
      };
      const timings = new Map<string, SectionTiming>(
        (timingResult.data ?? []).map((row: SectionTiming): [string, SectionTiming] => [
          row.id,
          row,
        ])
      );
      const deliveries = new Map<string, DayDelivery>(
        (deliveryResult.data ?? []).map(
          (row: DayDelivery): [string, DayDelivery] => [row.planner_day_id, row]
        )
      );

      const pairs = (pairResult.data ?? []) as Array<{ id: string; completion_section_id: string }>;
      const pairIds = pairs.map((pair) => pair.id);
      let sessions: Array<{ pair_id: string; status: string }> = [];

      if (pairIds.length) {
        const sessionResult = await supabase
          .from('attendance_sessions')
          .select('pair_id,status')
          .eq('attendance_date', today)
          .in('pair_id', pairIds);
        if (!sessionResult.error) sessions = (sessionResult.data ?? []) as typeof sessions;
      }

      if (cancelled) return;

      const pairBySection = new Map(pairs.map((pair) => [pair.completion_section_id, pair.id]));
      const sessionByPair = new Map(sessions.map((session) => [session.pair_id, session]));

      const nextRows: WatchRow[] = [];
      todaySections.forEach((section) => {
        if (!section.planner_day_id || !section.scheduled_date) return;
        const timing = timings.get(section.section_id);
        if (!timing?.start_time || !timing?.end_time) return;

        const delivery = deliveries.get(section.planner_day_id);
        const pairId = pairBySection.get(section.section_id);
        const attendanceSession = pairId ? sessionByPair.get(pairId) : null;

        nextRows.push({
          sectionId: section.section_id,
          plannerDayId: section.planner_day_id,
          scheduledDate: section.scheduled_date,
          dayNumber: section.current_planner_day_number,
          sectionLabel: section.section_name || section.section_code || 'Class',
          courseLabel: section.course_code || section.course_name || 'Course',
          startTime: timing.start_time,
          endTime: timing.end_time,
          deliveryStatus: delivery?.delivery_status ?? null,
          startedAt: delivery?.started_at ?? null,
          completedAt: delivery?.completed_at ?? null,
          requiresFinalAttendance: Boolean(pairId),
          attendanceFinalized: pairId ? attendanceSession?.status === 'finalized' : true,
        });
      });

      setRows(nextRows);
    };

    void load();
    const refresh = window.setInterval(() => void load(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [supabase]);

  const alerts = useMemo<WatchAlert[]>(() => {
    return rows
      .map((row): WatchAlert | null => {
        const startMs = localDateTime(row.scheduledDate, row.startTime);
        const endMs = localDateTime(row.scheduledDate, row.endTime);
        const completed = row.deliveryStatus === 'completed' || Boolean(row.completedAt);
        const needsCloseout = !completed || (row.requiresFinalAttendance && !row.attendanceFinalized);

        if (nowMs >= endMs + 30 * 60 * 1000 && needsCloseout) {
          return { ...row, severity: 'overdue', endMs };
        }
        if (nowMs >= endMs && needsCloseout) {
          return { ...row, severity: 'end', endMs };
        }
        if (nowMs >= startMs && !row.startedAt && !completed) {
          return { ...row, severity: 'start', endMs };
        }
        return null;
      })
      .filter((alert): alert is WatchAlert => Boolean(alert))
      .sort((a, b) => {
        const rank = { overdue: 0, end: 1, start: 2 };
        return rank[a.severity] - rank[b.severity] || a.endMs - b.endMs;
      });
  }, [rows, nowMs]);

  useEffect(() => {
    if (!audioReady) return;
    const overdue = alerts.filter((alert) => alert.severity === 'overdue');
    if (!overdue.length) return;

    const context = audioContextRef.current;
    if (!context || context.state !== 'running') return;

    overdue.forEach((alert) => {
      const key = `ltg-watchdog-alarm:${alert.plannerDayId}`;
      try {
        if (window.sessionStorage.getItem(key)) return;
      } catch {
        // Continue without session storage if the browser blocks it.
      }

      try {
        [0, 0.28, 0.56].forEach((offset) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.16);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(context.currentTime + offset);
          oscillator.stop(context.currentTime + offset + 0.18);
        });
        try {
          window.sessionStorage.setItem(key, '1');
        } catch {
          // Sound already played; storage is only a repeat guard.
        }
      } catch {
        // Visual and email alerts remain active if sound is unavailable.
      }
    });
  }, [alerts, audioReady]);

  if (!alerts.length) return null;

  return (
    <section
      aria-live={alerts.some((alert) => alert.severity === 'overdue') ? 'assertive' : 'polite'}
      aria-label="Class time alerts"
      style={{
        width: '100%',
        borderBottom: '1px solid var(--ltg-border-soft, #314657)',
        background: 'var(--ltg-surface-2, #1d3242)',
        color: 'var(--ltg-text, #f1f4f6)',
        padding: '10px 16px',
      }}
    >
      <div style={{ width: 'min(1500px, 100%)', margin: '0 auto', display: 'grid', gap: 8 }}>
        {alerts.map((alert) => {
          const isOverdue = alert.severity === 'overdue';
          const isEnd = alert.severity === 'end';
          const border = isOverdue
            ? 'var(--ltg-danger, #d95d5d)'
            : isEnd
              ? 'var(--ltg-warning, #d9a441)'
              : 'var(--ltg-info, #45d6e8)';
          const background = isOverdue
            ? 'var(--ltg-danger-bg, rgba(217,93,93,.12))'
            : isEnd
              ? 'var(--ltg-warning-bg, rgba(217,164,65,.12))'
              : 'var(--ltg-info-bg, rgba(69,214,232,.10))';

          const message =
            alert.severity === 'start'
              ? `Scheduled start · ${alert.courseLabel} should be started now.`
              : alert.severity === 'end'
                ? `Scheduled class time ended at ${formatTime(alert.endTime)}. Complete the class and attendance.`
                : `30 minutes overdue · ${alert.courseLabel} still needs class closeout or attendance. The instructor email reminder is active.`;

          return (
            <div
              key={alert.sectionId}
              style={{
                border: `1px solid ${border}`,
                borderLeft: `5px solid ${border}`,
                borderRadius: 9,
                background,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 14 }}>{message}</strong>
                <span style={{ fontSize: 12, color: 'var(--ltg-muted, #a9b7b3)' }}>
                  {alert.sectionLabel}
                  {alert.dayNumber ? ` · Day ${alert.dayNumber}` : ''}
                  {alert.severity === 'start'
                    ? ` · Scheduled ${formatTime(alert.startTime)}`
                    : ''}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href="/dashboard"
                  onClick={() => publishSelectedSection(alert.sectionId)}
                  style={{
                    border: '1px solid var(--ltg-border, #46606f)',
                    borderRadius: 7,
                    padding: '8px 10px',
                    color: 'var(--ltg-text, #f1f4f6)',
                    background: 'var(--ltg-surface, #172b3a)',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Open Class
                </a>
                {alert.severity !== 'start' && (
                  <a
                    href={`/attendance?section=${encodeURIComponent(alert.sectionId)}&date=${encodeURIComponent(
                      alert.scheduledDate
                    )}`}
                    onClick={() => publishSelectedSection(alert.sectionId)}
                    style={{
                      border: '1px solid var(--ltg-success, #4fa66c)',
                      borderRadius: 7,
                      padding: '8px 10px',
                      color: 'var(--ltg-success-text, #74eba0)',
                      background: 'var(--ltg-success-bg, #123c2a)',
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Attendance
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
