'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

type FutureDayBlock = {
  sectionId: string;
  scheduledDate: string;
  dayNumber: number | null;
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function PlannerScheduleStartGuard() {
  const [supabase] = useState(getSupabase);
  const [sectionId, setSectionId] = useState<string | null>(() => readSelectedSectionId());
  const [block, setBlock] = useState<FutureDayBlock | null>(null);

  useEffect(() => {
    return subscribeSelectedSection((nextSectionId) => setSectionId(nextSectionId));
  }, []);

  useEffect(() => {
    if (!sectionId) {
      setBlock(null);
      return;
    }

    let cancelled = false;

    const checkSchedule = async () => {
      const { data, error } = await supabase
        .from('current_teaching_sections')
        .select('section_id,current_planner_day_number,scheduled_date')
        .eq('section_id', sectionId)
        .maybeSingle();

      if (cancelled || error || !data) return;

      if (data.scheduled_date && data.scheduled_date > localDate()) {
        setBlock({
          sectionId,
          scheduledDate: data.scheduled_date,
          dayNumber: data.current_planner_day_number ?? null,
        });
      } else {
        setBlock(null);
      }
    };

    void checkSchedule();
    const interval = window.setInterval(() => void checkSchedule(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sectionId, supabase]);

  useEffect(() => {
    if (!block) return;

    const interceptFutureStart = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button');
      if (!button) return;
      if (button.textContent?.trim() !== 'Start Today') return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    document.addEventListener('click', interceptFutureStart, true);
    return () => document.removeEventListener('click', interceptFutureStart, true);
  }, [block]);

  if (!block) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        width: 'min(1500px, calc(100% - 20px))',
        margin: '10px auto 0',
        border: '1px solid rgba(69,214,232,.65)',
        borderRadius: 10,
        background: 'rgba(10,55,61,.94)',
        color: '#d7fbff',
        padding: '12px 14px',
      }}
    >
      <strong style={{ display: 'block', color: '#f2feff' }}>
        Next planner day is not scheduled for today
      </strong>
      <span style={{ fontSize: 13 }}>
        {block.dayNumber ? `Day ${block.dayNumber} is` : 'This day is'} scheduled for{' '}
        {displayDate(block.scheduledDate)}. Start Today is blocked until that date or until an
        administrator updates the class schedule.
      </span>
    </section>
  );
}
