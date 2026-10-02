'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  publishSelectedSection,
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';
import {
  attendanceCloseoutAction,
  type AttendanceCloseoutAction,
  type AttendanceCloseoutStatus,
} from '@/lib/attendance-closeout';

type Snapshot = {
  plannerDayId: string | null;
  deliveryStatus: string | null;
  deliveryCompletedAt: string | null;
  sectionCompletedAt: string | null;
};

type AttendanceBlock = AttendanceCloseoutAction & {
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

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? data[0] ?? null : data;
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
          const closeout = await supabase.rpc('attendance_closeout_status', {
            p_section_id: sectionId,
            p_attendance_date: deliveryActualDate,
          });

          if (!closeout.error && !cancelled) {
            const status = firstRow(closeout.data as AttendanceCloseoutStatus | AttendanceCloseoutStatus[] | null);
            const action = attendanceCloseoutAction(status);
            setAttendanceBlock(
              action ? { ...action, attendanceDate: deliveryActualDate } : null
            );
          } else if (!cancelled) {
            // Deployment-safe fallback while the new routing RPC reaches every environment.
            const requirement = await supabase.rpc('attendance_completion_requirement', {
              p_section_id: sectionId,
              p_attendance_date: deliveryActualDate,
            });
            const row = firstRow(requirement.data as {
              attendance_required?: boolean;
              finalized?: boolean;
            } | Array<{
              attendance_required?: boolean;
              finalized?: boolean;
            }> | null);

            if (!requirement.error && row?.attendance_required && !row.finalized) {
              setAttendanceBlock({
                targetSectionId: sectionId,
                attendanceDate: deliveryActualDate,
                stage: 'final',
                heading: 'Attendance confirmation required before Complete Day',
                message: 'Review the paired-class attendance and press Finalize Pair Attendance. Complete Day will work after attendance is finalized.',
                actionLabel: 'Open Attendance',
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
        const activeDeliveryChanged =
          wasInProgress(previous) &&
          (
            previous?.plannerDayId !== next.plannerDayId ||
            !inProgress ||
            next.deliveryStatus === 'completed' ||
            Boolean(next.deliveryCompletedAt) ||
            Boolean(next.sectionCompletedAt)
          );

        previousRef.current = next;
        storeSnapshot(sectionId, next);

        if (activeDeliveryChanged) {
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

  useEffect(() => {
    if (!attendanceBlock) return;

    const attendanceHref = `/attendance?section=${encodeURIComponent(
      attendanceBlock.targetSectionId
    )}&date=${encodeURIComponent(attendanceBlock.attendanceDate)}`;

    const interceptBlockedCloseout = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest('button');
      const anchor = target.closest('a[href]');
      const anchorHref = anchor?.getAttribute('href') ?? '';
      const isCompleteDay = button?.textContent?.trim() === 'Complete Day';
      const isAttendanceLink = anchorHref.startsWith('/attendance');

      if (!isCompleteDay && !isAttendanceLink) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      publishSelectedSection(attendanceBlock.targetSectionId);
      window.location.assign(attendanceHref);
    };

    document.addEventListener('click', interceptBlockedCloseout, true);
    return () => document.removeEventListener('click', interceptBlockedCloseout, true);
  }, [attendanceBlock]);

  if (!attendanceBlock) return null;

  const attendanceHref = `/attendance?section=${encodeURIComponent(
    attendanceBlock.targetSectionId
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
          {attendanceBlock.heading}
        </strong>
        <span style={{ fontSize: 13 }}>
          {attendanceBlock.message}
        </span>
      </div>
      <a
        href={attendanceHref}
        onClick={() => publishSelectedSection(attendanceBlock.targetSectionId)}
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
        {attendanceBlock.actionLabel}
      </a>
    </section>
  );
}
