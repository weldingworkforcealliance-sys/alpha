'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

const SAFE_RESOURCE_TYPES = new Set([
  'student_display',
  'student_resource',
  'book_reference',
  'aws_reference',
  'print',
  'wps_swps',
  'assessment',
  'video',
  'handout',
  'resource',
]);

type Day = {
  id: string;
  course_id: string;
  planner_day_number: number;
  title: string | null;
  objective: string | null;
};

type Segment = {
  id: string;
  sequence_number: number;
  segment_title: string | null;
  student_actions: string | null;
  start_minute: number | null;
  end_minute: number | null;
  planned_minutes: number;
};

type Resource = {
  id: string;
  sequence_number: number;
  resource_type: string;
  resource_title: string;
  resource_url: string | null;
};

type MathLesson = {
  id: string;
  math_day_number: number;
  title: string;
  planned_minutes: number;
  book_connection: string | null;
  goal: string | null;
};

type MathSegment = {
  id: string;
  sequence_number: number;
  start_minute: number | null;
  end_minute: number | null;
  planned_minutes: number;
  activity: string;
};

function timeLabel(start: number | null, end: number | null, planned: number) {
  if (start !== null && end !== null) return `${start}–${end}`;
  return `${planned} min`;
}

export default function StudentDisplayPage() {
  const params = useParams<{ guideDayId: string }>();
  const guideDayId = params.guideDayId;
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [day, setDay] = useState<Day | null>(null);
  const [courseLabel, setCourseLabel] = useState('Course');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [mathLesson, setMathLesson] = useState<MathLesson | null>(null);
  const [mathSegments, setMathSegments] = useState<MathSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace('/login');
          return;
        }

        const [dayResult, segmentResult, resourceResult, mathResult] = await Promise.all([
          supabase
            .from('course_guide_days')
            .select('id,course_id,planner_day_number,title,objective')
            .eq('id', guideDayId)
            .maybeSingle(),
          supabase
            .from('course_guide_day_segments')
            .select('id,sequence_number,segment_title,student_actions,start_minute,end_minute,planned_minutes')
            .eq('guide_day_id', guideDayId)
            .order('sequence_number'),
          supabase
            .from('course_guide_day_resources')
            .select('id,sequence_number,resource_type,resource_title,resource_url')
            .eq('guide_day_id', guideDayId)
            .order('sequence_number'),
          supabase
            .from('course_guide_day_math')
            .select('id,math_day_number,title,planned_minutes,book_connection,goal')
            .eq('guide_day_id', guideDayId)
            .maybeSingle(),
        ]);

        const firstError = dayResult.error || segmentResult.error || resourceResult.error;
        if (firstError) throw firstError;
        if (!dayResult.data) throw new Error('This student display is not available.');

        const loadedDay = dayResult.data as Day;
        setDay(loadedDay);
        setSegments((segmentResult.data ?? []) as Segment[]);
        setResources(
          ((resourceResult.data ?? []) as Resource[]).filter((resource) =>
            SAFE_RESOURCE_TYPES.has(resource.resource_type)
          )
        );

        const { data: course } = await supabase
          .from('courses')
          .select('course_code,course_name')
          .eq('id', loadedDay.course_id)
          .maybeSingle();
        if (course) setCourseLabel(course.course_code || course.course_name || 'Course');

        if (!mathResult.error && mathResult.data) {
          const lesson = mathResult.data as MathLesson;
          setMathLesson(lesson);
          const { data: rows, error: mathSegmentError } = await supabase
            .from('course_guide_day_math_segments')
            .select('id,sequence_number,start_minute,end_minute,planned_minutes,activity')
            .eq('math_lesson_id', lesson.id)
            .order('sequence_number');
          if (mathSegmentError) throw mathSegmentError;
          setMathSegments((rows ?? []) as MathSegment[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [guideDayId, router, supabase]);

  const rows = useMemo(
    () => [
      ...segments.map((segment) => ({
        id: `core-${segment.id}`,
        time: timeLabel(segment.start_minute, segment.end_minute, segment.planned_minutes),
        text:
          segment.student_actions ||
          segment.segment_title ||
          'Complete the assigned activity and follow instructor direction.',
        math: false,
      })),
      ...mathSegments.map((segment) => ({
        id: `math-${segment.id}`,
        time: timeLabel(segment.start_minute, segment.end_minute, segment.planned_minutes),
        text: segment.activity,
        math: true,
      })),
    ],
    [segments, mathSegments]
  );

  const shellStyle = {
    minHeight: '100vh',
    background: 'var(--ltg-canvas)',
    color: 'var(--ltg-text)',
    padding: 30,
  } as const;

  if (loading) {
    return <main style={shellStyle}>Loading student display…</main>;
  }

  if (error || !day) {
    return <main style={{ ...shellStyle, color: 'var(--ltg-danger-text)' }}>{error || 'Student display unavailable.'}</main>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--ltg-canvas)',
        color: 'var(--ltg-text)',
        padding: 'clamp(22px,4vw,64px)',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid var(--ltg-border)', paddingBottom: 18, marginBottom: 24 }}>
          <div style={{ color: 'var(--ltg-accent)', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 900, fontSize: 15 }}>
            {courseLabel} · Day {day.planner_day_number}
          </div>
          <h1 style={{ margin: '8px 0 10px', color: 'var(--ltg-text)', fontSize: 'clamp(34px,5vw,64px)', lineHeight: 1.06 }}>
            {day.title || `Planner Day ${day.planner_day_number}`}
          </h1>
          <p style={{ margin: 0, maxWidth: 1100, color: 'var(--ltg-muted)', fontSize: 'clamp(20px,2.2vw,30px)', lineHeight: 1.38 }}>
            {day.objective || 'Follow the instructor plan and complete the assigned work.'}
          </p>
        </header>

        <section style={{ display: 'grid', gap: 12 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px minmax(0,1fr)',
                gap: 18,
                alignItems: 'start',
                border: row.math
                  ? '1px solid var(--ltg-accent)'
                  : '1px solid var(--ltg-border)',
                background: row.math
                  ? 'var(--ltg-accent-soft)'
                  : 'var(--ltg-surface)',
                color: 'var(--ltg-text)',
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div style={{ color: row.math ? 'var(--ltg-accent-text)' : 'var(--ltg-info-text)', fontWeight: 900, fontSize: 18 }}>{row.time}</div>
              <div style={{ fontSize: 'clamp(20px,2vw,29px)', lineHeight: 1.42 }}>{row.text}</div>
            </div>
          ))}
        </section>

        {mathLesson && (
          <section style={{ marginTop: 24, border: '1px solid var(--ltg-accent)', background: 'var(--ltg-accent-soft)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: 'var(--ltg-accent-text)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Welding Math · Day {mathLesson.math_day_number}
            </div>
            <h2 style={{ margin: '6px 0', color: 'var(--ltg-text)' }}>{mathLesson.title}</h2>
            {mathLesson.goal && <p style={{ color: 'var(--ltg-text)', fontSize: 20 }}>{mathLesson.goal}</p>}
            {mathLesson.book_connection && (
              <p style={{ color: 'var(--ltg-muted)', fontSize: 17 }}>
                <strong>Book / page reference:</strong> {mathLesson.book_connection}
              </p>
            )}
          </section>
        )}

        {resources.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ color: 'var(--ltg-accent)' }}>Student Resources</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {resources.map((resource) =>
                resource.resource_url ? (
                  <a
                    key={resource.id}
                    href={resource.resource_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      border: '1px solid var(--ltg-info)',
                      background: 'var(--ltg-info-soft)',
                      color: 'var(--ltg-info-text)',
                      borderRadius: 9,
                      padding: '11px 14px',
                      textDecoration: 'none',
                      fontWeight: 900,
                    }}
                  >
                    {resource.resource_title}
                  </a>
                ) : (
                  <span
                    key={resource.id}
                    style={{ border: '1px solid var(--ltg-border)', color: 'var(--ltg-muted)', background: 'var(--ltg-surface-2)', borderRadius: 9, padding: '11px 14px' }}
                  >
                    {resource.resource_title}
                  </span>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
