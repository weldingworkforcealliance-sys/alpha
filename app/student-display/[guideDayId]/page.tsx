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

  if (loading) {
    return <main style={{ minHeight: '100vh', background: '#06100f', color: '#dce9e6', padding: 30 }}>Loading student display…</main>;
  }

  if (error || !day) {
    return <main style={{ minHeight: '100vh', background: '#06100f', color: '#ffd1d1', padding: 30 }}>{error || 'Student display unavailable.'}</main>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 80% 0%, rgba(32,107,111,.16), transparent 35%), #06100f',
        color: '#edf6f4',
        padding: 'clamp(22px,4vw,64px)',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid #29423e', paddingBottom: 18, marginBottom: 24 }}>
          <div style={{ color: '#45d6e8', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 900, fontSize: 15 }}>
            {courseLabel} · Day {day.planner_day_number}
          </div>
          <h1 style={{ margin: '8px 0 10px', fontSize: 'clamp(34px,5vw,64px)', lineHeight: 1.06 }}>
            {day.title || `Planner Day ${day.planner_day_number}`}
          </h1>
          <p style={{ margin: 0, maxWidth: 1100, color: '#c8dcd8', fontSize: 'clamp(20px,2.2vw,30px)', lineHeight: 1.38 }}>
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
                border: row.math ? '1px solid rgba(255,154,56,.42)' : '1px solid #28423d',
                background: row.math ? 'rgba(255,154,56,.055)' : '#0a1815',
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div style={{ color: row.math ? '#ffbd79' : '#6ce7f4', fontWeight: 900, fontSize: 18 }}>{row.time}</div>
              <div style={{ fontSize: 'clamp(20px,2vw,29px)', lineHeight: 1.42 }}>{row.text}</div>
            </div>
          ))}
        </section>

        {mathLesson && (
          <section style={{ marginTop: 24, border: '1px solid rgba(255,154,56,.35)', background: 'rgba(255,154,56,.045)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: '#ffbd79', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Welding Math · Day {mathLesson.math_day_number}
            </div>
            <h2 style={{ margin: '6px 0' }}>{mathLesson.title}</h2>
            {mathLesson.goal && <p style={{ color: '#d8e6e3', fontSize: 20 }}>{mathLesson.goal}</p>}
            {mathLesson.book_connection && (
              <p style={{ color: '#aebfbc', fontSize: 17 }}>
                <strong>Book / page reference:</strong> {mathLesson.book_connection}
              </p>
            )}
          </section>
        )}

        {resources.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ color: '#45d6e8' }}>Student Resources</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {resources.map((resource) =>
                resource.resource_url ? (
                  <a
                    key={resource.id}
                    href={resource.resource_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      border: '1px solid #3b625a',
                      background: '#0c1d19',
                      color: '#d8f1ec',
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
                    style={{ border: '1px solid #2a423e', color: '#9db2ae', borderRadius: 9, padding: '11px 14px' }}
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
