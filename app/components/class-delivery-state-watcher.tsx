'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

type TeachingSectionState = {
  section_id: string;
  planner_day_id: string | null;
  current_planner_day_number: number | null;
};

type DeliveryState = {
  delivery_status: string | null;
  started_at: string | null;
  completed_at: string | null;
};

function signature(section: TeachingSectionState, delivery: DeliveryState | null) {
  return [
    section.planner_day_id ?? 'no-day',
    section.current_planner_day_number ?? 'no-number',
    delivery?.delivery_status ?? 'not-started',
    delivery?.started_at ?? 'no-start',
    delivery?.completed_at ?? 'no-complete',
  ].join('|');
}

/**
 * Keeps long-lived Planner/Dashboard tabs from displaying stale class timers.
 * The teaching pages maintain local client state, so a completion made in the
 * same tab, another tab, or another authorized device can otherwise leave an
 * old `in_progress` timer visible after Supabase is already authoritative.
 */
export default function ClassDeliveryStateWatcher() {
  const [supabase] = useState(getSupabase);
  const [sectionId, setSectionId] = useState<string | null>(() => readSelectedSectionId());
  const lastSignature = useRef<string | null>(null);
  const checking = useRef(false);

  useEffect(() => {
    return subscribeSelectedSection((nextSectionId) => setSectionId(nextSectionId));
  }, []);

  useEffect(() => {
    lastSignature.current = null;
    if (!sectionId) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || checking.current) return;
      checking.current = true;

      try {
        const { data: sectionRow, error: sectionError } = await supabase
          .from('current_teaching_sections')
          .select('section_id,planner_day_id,current_planner_day_number')
          .eq('section_id', sectionId)
          .maybeSingle();

        if (sectionError || !sectionRow || cancelled) return;
        const section = sectionRow as TeachingSectionState;

        let delivery: DeliveryState | null = null;
        if (section.planner_day_id) {
          const { data: deliveryRow, error: deliveryError } = await supabase
            .from('planner_day_delivery')
            .select('delivery_status,started_at,completed_at')
            .eq('section_id', sectionId)
            .eq('planner_day_id', section.planner_day_id)
            .maybeSingle();

          if (deliveryError || cancelled) return;
          delivery = (deliveryRow ?? null) as DeliveryState | null;
        }

        const nextSignature = signature(section, delivery);
        if (lastSignature.current === null) {
          lastSignature.current = nextSignature;
          return;
        }

        if (lastSignature.current !== nextSignature) {
          // Production state changed underneath this client. A hard refresh is
          // intentional here because both legacy Planner surfaces keep several
          // interdependent pieces of local state (section, guide, calendar,
          // delivery and timer) that must advance together.
          window.location.reload();
        }
      } catch (error) {
        console.error('Class state revalidation failed', error);
      } finally {
        checking.current = false;
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), 5000);

    const onFocus = () => void check();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sectionId, supabase]);

  return null;
}
