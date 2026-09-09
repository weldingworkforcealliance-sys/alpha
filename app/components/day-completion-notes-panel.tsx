'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

type DayNote = {
  id: string;
  planner_day_id: string;
  note_text: string;
  created_at: string;
};

type PlannerDay = {
  id: string;
  planner_day_number: number;
  scheduled_date: string;
  title: string | null;
};

export default function DayCompletionNotesPanel() {
  const [supabase] = useState(getSupabase);
  const [sectionId, setSectionId] = useState<string | null>(() => readSelectedSectionId());
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [days, setDays] = useState<Record<string, PlannerDay>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeSelectedSection((nextSectionId) => setSectionId(nextSectionId));
  }, []);

  useEffect(() => {
    if (!sectionId) {
      setNotes([]);
      setDays({});
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const { data: noteRows, error: noteError } = await supabase
          .from('instructor_notes')
          .select('id,planner_day_id,note_text,created_at')
          .eq('section_id', sectionId)
          .eq('note_type', 'day_completion')
          .eq('visibility', 'shared')
          .order('created_at', { ascending: false })
          .limit(5);

        if (noteError) throw noteError;
        const loadedNotes = (noteRows ?? []) as DayNote[];

        const dayIds = Array.from(new Set(loadedNotes.map((note) => note.planner_day_id)));
        const dayRows = dayIds.length
          ? await supabase
              .from('planner_days')
              .select('id,planner_day_number,scheduled_date,title')
              .in('id', dayIds)
          : { data: [], error: null };

        if (dayRows.error) throw dayRows.error;
        if (cancelled) return;

        setNotes(loadedNotes);
        setDays(
          Object.fromEntries(
            ((dayRows.data ?? []) as PlannerDay[]).map((day) => [day.id, day])
          )
        );
      } catch (error) {
        console.error('Failed to load day-completion notes', error);
        if (!cancelled) {
          setNotes([]);
          setDays({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sectionId, supabase]);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const aDay = days[a.planner_day_id]?.planner_day_number ?? 0;
        const bDay = days[b.planner_day_id]?.planner_day_number ?? 0;
        return bDay - aDay;
      }),
    [days, notes]
  );

  if (!sectionId || (!loading && sortedNotes.length === 0)) return null;

  return (
    <section
      aria-label="Recent instructor day notes"
      style={{
        width: 'min(1500px, calc(100% - 20px))',
        margin: '12px auto 6px',
        border: '1px solid rgba(69, 214, 232, .38)',
        borderRadius: 12,
        background: 'rgba(9, 21, 18, .94)',
        padding: 14,
        color: '#dceae7',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              color: '#45d6e8',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '.09em',
              textTransform: 'uppercase',
            }}
          >
            Saved Instructor Notes
          </div>
          <strong style={{ fontSize: 18 }}>Recent Day Completion Notes</strong>
        </div>
        <Link
          href="/review-queue"
          style={{
            border: '1px solid rgba(80,223,146,.5)',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#b8ffd8',
            textDecoration: 'none',
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          Open Review Queue
        </Link>
      </div>

      {loading ? (
        <div style={{ color: '#9fb2ae', fontSize: 13 }}>Loading saved notes…</div>
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          {sortedNotes.map((note) => {
            const day = days[note.planner_day_id];
            return (
              <article
                key={note.id}
                style={{
                  border: '1px solid #28413d',
                  borderRadius: 9,
                  background: '#07100f',
                  padding: 11,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ color: '#f1f7f5' }}>
                    Day {day?.planner_day_number ?? '?'}
                    {day?.title ? ` · ${day.title}` : ''}
                  </strong>
                  <span style={{ color: '#8fa8a3', fontSize: 12 }}>
                    {day?.scheduled_date
                      ? new Date(`${day.scheduled_date}T12:00:00`).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : ''}
                  </span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: 14 }}>
                  {note.note_text}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
