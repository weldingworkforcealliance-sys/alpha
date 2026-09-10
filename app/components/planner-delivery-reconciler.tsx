'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

type Snapshot = {
  plannerDayId: string | null;
  deliveryStatus: string | null;
  deliveryCompletedAt: string | null;
  sectionCompletedAt: string | null;
};

type AttendanceBlock = {
  sectionId: string;
  attendanceDate: string;
};

function storageKey(sectionId: string) {
  return `ltg:planner-delivery-snapshot:${sectionId}`;
}

function readStoredSnapshot(sectionId: string): Snapshot | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(sectionId));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function storeSnapshot(sectionId: string, snapshot: Snapshot) {
  try {
    window.sessionStorage.setItem(storageKey(sectionId), JSON.stringify(snapshot));
  } catch {
    // Session storage is optional. Live reconciliation still works in memory.
  }
}

function wasInProgress(snapshot: Snapshot | null) {
  return (
    snapshot?.deliveryStatus === 'in_progress' ||
    snapshot?.deliveryStatus === 'started'
  );
}

export default function PlannerDeliveryReconciler() {
  const [supabase] = useState(getSupabase);
  const [sectionId, setSectionId] = useState<string | null>(() => readSelectedSectionId());
  const [attendanceBlock, setAttendanceBlock] = useState<AttendanceBlock | null>(null);
  const previousRef = useRef<Snapshot | null>(null);
  const reloadingRef = useRef(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    previousRef.current = sectionId ? readStoredSnapshot(sectionId) : null;
    setAttendanceBlock(null);
  }, [sectionId]);

  useEffect(() => {
    return subscribeSelectedSection((nextSectionId) => setSectionId(nextSectionId));
  }, []);

  useEffect(() => {
    if (!sectionId) return;

    let cancelled = false;

    const reconcile = async () => {
      if (cancelled || reloadingRef.current || checkingRef.current) return;
      checkingRef.current = true;

      try {
        const { data: sectionRow, error: sectionError } = await supabase
          .from('current_teaching_sections')
          .select('planner_day_id,completed_at')
          .eq('section_id', sectionId)
          .maybeSingle();

        if (sectionError || !sectionRow || cancelled) return;

        let deliveryStatus: string | null = null;
        let deliveryCompletedAt: string | null = null;
        let deliveryActualDate: string | null = null;

        if (sectionRow.planner_day_id) {
          const { data: deliveryRow, error: deliveryError } = await supabase
            .from('planner_day_delivery')
            .select('delivery_status,completed_at,actual_date')
            .eq('section_id', sectionId)
            .eq('planner_day_id', sectionRow.planner_day_id)
            .maybeSingle();

          if (deliveryError || cancelled) return;
          deliveryStatus = deliveryRow?.delivery_status ?? null;
          deliveryCompletedAt = deliveryRow?.completed_at ?? null;
          deliveryActualDate = deliveryRow?.actual_date ?? null;
        }

        const inProgress =
          deliveryStatus === 'in_progress' || deliveryStatus === 'started';

        if (inProgress && deliveryActualDate) {
          const requirement = await supabase.rpc('attendance_completion_requirement', {
            p_section_id: sectionId,
            p_attendance_date: deliveryActualDate,
          });

          if (!requirement.error && !cancelled) {
            const row = Array.isArray(requirement.data)
              ? requirement.data[0]
              : requirement.data;
            if (row?.attendance_required && !row?.finalized) {
              setAttendanceBlock({
                sectionId,
                attendanceDate: deliveryActualDate,
              });
            } else {
              setAttendanceBlock(null);
            }
          }
        } else if (!cancelled) {
          setAttendanceBlock(null);
        }

        const next: Snapshot = {
          plannerDayId: sectionRow.planner_day_id ?? null,
          deliveryStatus,
          deliveryCompletedAt,
          sectionCompletedAt: sectionRow.completed_at ?? null,
        };

        const previous = previousRef.current;
        const completedTransition =
          wasInProgress(previous) &&
          (
            previous?.plannerDayId !== next.plannerDayId ||
            next.deliveryStatus === 'completed' ||
            Boolean(next.deliveryCompletedAt) ||
            Boolean(next.sectionCompletedAt)
          );

        previousRef.current = next;
        storeSnapshot(sectionId, next);

        if (completedTransition) {
          reloadingRef.current = true;
          window.location.reload();
        }
      } catch (error) {
        console.error('Planner delivery reconciliation failed', error);
      } finally {
        checkingRef.current = false;
      }
    };

    void reconcile();
    const interval = window.setInterval(() => void reconcile(), 3000);
    const handleFocus = () => void reconcile();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void reconcile();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sectionId, supabase]);

  if (!attendanceBlock) return null;

  const attendanceHref = `/attendance?section=${encodeURIComponent(
    attendanceBlock.sectionId
  )}&date=${encodeURIComponent(attendanceBlock.attendanceDate)}`;

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        width: 'min(1500px, calc(100% - 20px))',
        margin: '10px auto 0',
        border: '1px solid rgba(255,154,56,.7)',
        borderRadius: 10,
        background: 'rgba(92,50,12,.94)',
        color: '#ffe0bd',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <strong style={{ display: 'block', color: '#fff1df' }}>
          Attendance confirmation required before Complete Day
        </strong>
        <span style={{ fontSize: 13 }}>
          Review the paired-class attendance and press Finalize Pair Attendance. The class can then be completed normally.
        </span>
      </div>
      <a
        href={attendanceHref}
        style={{
          border: '1px solid #ffb76d',
          borderRadius: 8,
          background: '#7a4318',
          color: '#fff7ed',
          padding: '9px 12px',
          textDecoration: 'none',
          fontWeight: 900,
          whiteSpace: 'nowrap',
        }}
      >
        Open Attendance
      </a>
    </section>
  );
}
