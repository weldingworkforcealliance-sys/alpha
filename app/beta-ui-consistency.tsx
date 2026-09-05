'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type SectionContext = {
  section_id: string;
  course_code: string | null;
  course_name: string | null;
  planned_minutes_per_day: number | null;
};

const STORAGE_KEY = 'ltp_selected_section_id';
const SECTION_EVENT = 'ltp:section-change';

export default function BetaUiConsistency({ pathname }: { pathname: string }) {
  const [section, setSection] = useState<SectionContext | null>(null);
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    if (pathname !== '/dashboard') {
      setSection(null);
      return;
    }

    let cancelled = false;

    const load = async (sectionId?: string) => {
      const selectedId = sectionId || window.localStorage.getItem(STORAGE_KEY) || '';
      if (!selectedId) return;

      const { data, error } = await supabase
        .from('planner_workspace_sections')
        .select('section_id,course_code,course_name,planned_minutes_per_day')
        .eq('section_id', selectedId)
        .maybeSingle();

      if (!cancelled && !error) {
        setSection((data ?? null) as SectionContext | null);
      }
    };

    const onSectionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ sectionId?: string }>;
      load(customEvent.detail?.sectionId);
    };

    load();
    window.addEventListener(SECTION_EVENT, onSectionChange as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener(SECTION_EVENT, onSectionChange as EventListener);
    };
  }, [pathname, supabase]);

  useEffect(() => {
    if (pathname !== '/dashboard' || !section) return;

    const apply = () => {
      const course = section.course_code || section.course_name || 'Course';

      if (course === 'WLD 110') {
        const badge = document.querySelector<HTMLElement>('.guide-format-badge');
        const minutes = section.planned_minutes_per_day;
        const desired = `${minutes ?? ''}${minutes ? ' min ' : ''}${course}`;
        if (badge && badge.textContent?.trim() !== desired) {
          badge.textContent = desired;
        }
      }

      const calendarSubtitle = document.querySelector<HTMLElement>(
        '.calendar-title-row p'
      );
      const desiredSubtitle = 'Class schedule and no-class reminders.';
      if (calendarSubtitle && calendarSubtitle.textContent?.trim() !== desiredSubtitle) {
        calendarSubtitle.textContent = desiredSubtitle;
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { subtree: true, childList: true });

    return () => observer.disconnect();
  }, [pathname, section]);

  return null;
}
