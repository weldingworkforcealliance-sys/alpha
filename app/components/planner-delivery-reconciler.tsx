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
  const previousRef = useRef<Snapshot | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    previousRef.current = sectionId ? readStoredSnapshot(sectionId) : null;
  }, [sectionId]);

  useEffect(() => {
    return subscribeSelectedSection((nextSectionId) => setSectionId(nextSectionId));
  }, []);

  useEffect(() => {
    if (!sectionId) return;

    let cancelled = false;

    const reconcile = async () => {
      if (cancelled || reloadingRef.current) return;

      const { data: sectionRow, error: sectionError } = await supabase
        .from('current_teaching_sections')
        .select('planner_day_id,completed_at')
        .eq('section_id', sectionId)
        .maybeSingle();

      if (sectionError || !sectionRow || cancelled) return;

      let deliveryStatus: string | null = null;
      let deliveryCompletedAt: string | null = null;

      if (sectionRow.planner_day_id) {
        const { data: deliveryRow, error: deliveryError } = await supabase
          .from('planner_day_delivery')
          .select('delivery_status,completed_at')
          .eq('planner_day_id', sectionRow.planner_day_id)
          .maybeSingle();

        if (deliveryError || cancelled) return;
        deliveryStatus = deliveryRow?.delivery_status ?? null;
        deliveryCompletedAt = deliveryRow?.completed_at ?? null;
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

  return null;
}
