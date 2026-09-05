'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlannerTeachingConsole, {
  type PlannerDayOption,
  type PlannerLaunchResource,
  type PlannerPlanRow,
  type PlannerSupportItem,
} from '@/app/components/planner/PlannerTeachingConsole';
import { getSupabase } from '@/lib/supabase-browser';
import {
  publishSelectedSection,
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

interface TeachingSection {
  school_id: string;
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  current_planner_day_number: number | null;
  planner_day_id: string | null;
  scheduled_date: string | null;
  guide_day_id: string | null;
  planner_day_title: string | null;
  manual_hold: boolean;
  hold_reason: string | null;
  completed_at: string | null;
}

interface GuideDay {
  id: string;
  guide_id: string;
  planner_day_number: number;
  title: string | null;
  objective: string | null;
  instructor_prep: string | null;
  safety_focus: string | null;
  opening_review: string | null;
  demonstration: string | null;
  guided_practice: string | null;
  independent_practice: string | null;
  instructor_checks: string | null;
  assessment: string | null;
  teaching_tips: string | null;
  materials_equipment: string | null;
  corresponding_application: string | null;
  evidence_check_for_understanding: string | null;
  weekly_coaching_focus: string | null;
  coaching_focus: string | null;
  if_students_struggle: string | null;
  keep_momentum: string | null;
  aws_alignment: string | null;
  aws_key_indicators: string | null;
  record_link_expectation: string | null;
}

interface GuideSegment {
  id: string;
  sequence_number: number;
  segment_type: string;
  segment_title: string | null;
  planned_minutes: number;
  instructor_actions: string | null;
  student_actions: string | null;
  start_minute: number | null;
  end_minute: number | null;
}

interface GuideResource {
  id: string;
  sequence_number: number;
  resource_type: string;
  resource_title: string;
  resource_url: string | null;
  resource_notes: string | null;
  required: boolean;
}

interface MathLesson {
  id: string;
  math_day_number: number;
  title: string;
  planned_minutes: number;
  book_connection: string | null;
  goal: string | null;
  instructor_notes: string | null;
  answers_quick_check: string | null;
}

interface MathSegment {
  id: string;
  sequence_number: number;
  start_minute: number | null;
  end_minute: number | null;
  planned_minutes: number;
  activity: string;
  segment_type: string;
}

interface ProtectedOutcome {
  id: string;
  outcome_code: string;
  outcome_text: string;
}

interface CurrentDelivery {
  planner_day_id: string;
  delivery_status: string;
  actual_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  instructor_id: string | null;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function minuteRange(start: number | null, end: number | null, planned: number) {
  if (start !== null && end !== null) return `${start}–${end} min`;
  return `${planned} min`;
}

function elapsedClock(startedAt: string | null, nowMs: number) {
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

function combineTeachFields(day: GuideDay | null) {
  if (!day) return '';
  return [
    day.safety_focus ? `Safety focus: ${day.safety_focus}` : '',
    day.opening_review ? `Opening / retrieval: ${day.opening_review}` : '',
    day.demonstration ? `Demonstration / model: ${day.demonstration}` : '',
    day.guided_practice ? `Guided practice: ${day.guided_practice}` : '',
    day.independent_practice ? `Independent application: ${day.independent_practice}` : '',
    day.instructor_checks ? `Instructor checks: ${day.instructor_checks}` : '',
    day.assessment ? `Assessment: ${day.assessment}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default function PlannerPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TeachingSection | null>(null);
  const [guideDay, setGuideDay] = useState<GuideDay | null>(null);
  const [guideDayRefs, setGuideDayRefs] = useState<PlannerDayOption[]>([]);
  const [viewedGuideDayId, setViewedGuideDayId] = useState<string | null>(null);
  const [segments, setSegments] = useState<GuideSegment[]>([]);
  const [resources, setResources] = useState<GuideResource[]>([]);
  const [mathLesson, setMathLesson] = useState<MathLesson | null>(null);
  const [mathSegments, setMathSegments] = useState<MathSegment[]>([]);
  const [outcomes, setOutcomes] = useState<ProtectedOutcome[]>([]);
  const [delivery, setDelivery] = useState<CurrentDelivery | null>(null);
  const [actualDate, setActualDate] = useState(localDate);
  const [deviationSummary, setDeviationSummary] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [attendanceBlock, setAttendanceBlock] = useState('');
  const [loading, setLoading] = useState(true);
  const [guideLoading, setGuideLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [timerNow, setTimerNow] = useState(Date.now());

  const refreshSections = async (preferredSectionId?: string) => {
    const { data, error: queryError } = await supabase
      .from('current_teaching_sections')
      .select('*');

    if (queryError) throw queryError;
    const loaded = (data ?? []) as TeachingSection[];
    setSections(loaded);

    if (!loaded.length) {
      setSelectedSection(null);
      return null;
    }

    const saved = preferredSectionId || readSelectedSectionId();
    const chosen = loaded.find((section) => section.section_id === saved) ?? loaded[0];
    setSelectedSection(chosen);
    if (chosen.section_id !== readSelectedSectionId()) publishSelectedSection(chosen.section_id);
    return chosen;
  };

  const loadDelivery = async (section: TeachingSection | null) => {
    if (!section?.planner_day_id) {
      setDelivery(null);
      return;
    }
    const { data } = await supabase
      .from('planner_day_delivery')
      .select('planner_day_id,delivery_status,actual_date,started_at,completed_at,instructor_id')
      .eq('section_id', section.section_id)
      .eq('planner_day_id', section.planner_day_id)
      .maybeSingle();
    const next = (data ?? null) as CurrentDelivery | null;
    setDelivery(next);
    if (next?.actual_date) setActualDate(next.actual_date);
  };

  const loadGuide = async (guideDayId: string) => {
    setGuideLoading(true);
    setError('');
    try {
      const [dayResult, segmentResult, resourceResult, mathResult, outcomeLinks] = await Promise.all([
        supabase
          .from('course_guide_days')
          .select(
            'id,guide_id,planner_day_number,title,objective,instructor_prep,safety_focus,opening_review,demonstration,guided_practice,independent_practice,instructor_checks,assessment,teaching_tips,materials_equipment,corresponding_application,evidence_check_for_understanding,weekly_coaching_focus,coaching_focus,if_students_struggle,keep_momentum,aws_alignment,aws_key_indicators,record_link_expectation'
          )
          .eq('id', guideDayId)
          .maybeSingle(),
        supabase
          .from('course_guide_day_segments')
          .select(
            'id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,start_minute,end_minute'
          )
          .eq('guide_day_id', guideDayId)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_resources')
          .select(
            'id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required'
          )
          .eq('guide_day_id', guideDayId)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_math')
          .select(
            'id,math_day_number,title,planned_minutes,book_connection,goal,instructor_notes,answers_quick_check'
          )
          .eq('guide_day_id', guideDayId)
          .maybeSingle(),
        supabase
          .from('course_guide_day_outcomes')
          .select('outcome_id')
          .eq('guide_day_id', guideDayId),
      ]);

      const firstError =
        dayResult.error || segmentResult.error || resourceResult.error || outcomeLinks.error;
      if (firstError) throw firstError;

      const day = (dayResult.data ?? null) as GuideDay | null;
      setGuideDay(day);
      setSegments((segmentResult.data ?? []) as GuideSegment[]);
      setResources((resourceResult.data ?? []) as GuideResource[]);

      if (day) {
        const { data: refData, error: refError } = await supabase
          .from('course_guide_days')
          .select('id,planner_day_number,title')
          .eq('guide_id', day.guide_id)
          .order('planner_day_number');
        if (!refError) {
          setGuideDayRefs(
            (refData ?? []).map((row: { id: string; planner_day_number: number; title: string | null }) => ({
              id: row.id,
              dayNumber: row.planner_day_number,
              title: row.title,
            }))
          );
        }
      }

      if (!mathResult.error && mathResult.data) {
        const lesson = mathResult.data as MathLesson;
        setMathLesson(lesson);
        const { data: mathRows, error: mathError } = await supabase
          .from('course_guide_day_math_segments')
          .select('id,sequence_number,start_minute,end_minute,planned_minutes,activity,segment_type')
          .eq('math_lesson_id', lesson.id)
          .order('sequence_number');
        if (mathError) throw mathError;
        setMathSegments((mathRows ?? []) as MathSegment[]);
      } else {
        setMathLesson(null);
        setMathSegments([]);
      }

      const outcomeIds = (outcomeLinks.data ?? [])
        .map((row: { outcome_id: string | null }) => row.outcome_id)
        .filter((id): id is string => Boolean(id));
      if (outcomeIds.length) {
        const { data: outcomeRows } = await supabase
          .from('course_outcomes')
          .select('id,outcome_code,outcome_text')
          .in('id', outcomeIds)
          .order('outcome_code');
        setOutcomes((outcomeRows ?? []) as ProtectedOutcome[]);
      } else {
        setOutcomes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuideLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace('/login');
          return;
        }
        await refreshSections();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    return subscribeSelectedSection((sectionId) => {
      const next = sections.find((section) => section.section_id === sectionId);
      if (next) setSelectedSection(next);
    });
  }, [sections]);

  useEffect(() => {
    setAttendanceBlock('');
    setViewedGuideDayId(selectedSection?.guide_day_id ?? null);
    loadDelivery(selectedSection);
  }, [selectedSection?.section_id, selectedSection?.guide_day_id, selectedSection?.planner_day_id]);

  useEffect(() => {
    if (viewedGuideDayId) loadGuide(viewedGuideDayId);
    else {
      setGuideDay(null);
      setSegments([]);
      setResources([]);
      setMathLesson(null);
      setMathSegments([]);
      setOutcomes([]);
    }
  }, [viewedGuideDayId]);

  const currentDayInProgress = Boolean(
    delivery?.started_at &&
      !delivery.completed_at &&
      (delivery.delivery_status === 'in_progress' || delivery.delivery_status === 'started')
  );

  useEffect(() => {
    if (!currentDayInProgress) return;
    setTimerNow(Date.now());
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentDayInProgress, delivery?.started_at]);

  const isCurrentDay = Boolean(
    selectedSection?.guide_day_id && guideDay?.id === selectedSection.guide_day_id
  );

  const planRows = useMemo<PlannerPlanRow[]>(() => {
    const core = segments.map((segment) => ({
      id: `core-${segment.id}`,
      time: minuteRange(segment.start_minute, segment.end_minute, segment.planned_minutes),
      instructor: segment.instructor_actions || segment.segment_title || 'Assigned activity',
      students: segment.student_actions,
      kind: segment.segment_type?.toLowerCase().includes('assessment')
        ? ('assessment' as const)
        : ('core' as const),
    }));

    const math = mathSegments.map((segment) => ({
      id: `math-${segment.id}`,
      time: minuteRange(segment.start_minute, segment.end_minute, segment.planned_minutes),
      instructor: `Welding Math${mathLesson ? ` · Day ${mathLesson.math_day_number}` : ''}: ${segment.activity}`,
      students: segment.activity,
      kind: 'math' as const,
    }));

    return [...core, ...math].sort((a, b) => {
      const left = Number.parseInt(a.time, 10);
      const right = Number.parseInt(b.time, 10);
      if (Number.isNaN(left) || Number.isNaN(right)) return 0;
      return left - right;
    });
  }, [segments, mathSegments, mathLesson]);

  const resolvedResources = useMemo<PlannerLaunchResource[]>(() => {
    return resources.map((resource) => {
      let url = resource.resource_url;
      if (url?.startsWith('/classroom') && selectedSection?.section_id) {
        url = `${url}${url.includes('?') ? '&' : '?'}section=${encodeURIComponent(
          selectedSection.section_id
        )}`;
      }
      return {
        id: resource.id,
        title: resource.resource_title,
        url,
        type: resource.resource_type,
        notes: resource.resource_notes,
        required: resource.required,
      };
    });
  }, [resources, selectedSection?.section_id]);

  const bookAndAwsReferences = useMemo(() => {
    const lines = [
      guideDay?.aws_alignment ? `AWS alignment: ${guideDay.aws_alignment}` : '',
      guideDay?.aws_key_indicators ? `AWS key indicators: ${guideDay.aws_key_indicators}` : '',
      mathLesson?.book_connection ? `Math book: ${mathLesson.book_connection}` : '',
      ...resources
        .filter((resource) => ['book_reference', 'aws_reference'].includes(resource.resource_type))
        .map((resource) => `${resource.resource_title}${resource.resource_notes ? ` — ${resource.resource_notes}` : ''}`),
    ].filter(Boolean);
    return lines.join('\n\n');
  }, [guideDay, mathLesson, resources]);

  const supportItems = useMemo<PlannerSupportItem[]>(() => {
    const coaching = [guideDay?.weekly_coaching_focus, guideDay?.coaching_focus]
      .filter(Boolean)
      .join('\n\n');
    const mathInstructor = [
      mathLesson?.instructor_notes ? `Math instructor notes: ${mathLesson.instructor_notes}` : '',
      mathLesson?.answers_quick_check
        ? `Math answers / quick check: ${mathLesson.answers_quick_check}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    return [
      {
        key: 'before',
        label: 'Before Class',
        body: guideDay?.instructor_prep || guideDay?.materials_equipment,
      },
      { key: 'teach', label: 'Teach This Today', body: combineTeachFields(guideDay) },
      { key: 'refs', label: 'Book / AWS Page References', body: bookAndAwsReferences },
      { key: 'coach', label: 'Instructor Coaching', body: coaching || guideDay?.teaching_tips },
      { key: 'struggle', label: 'If Students Struggle', body: guideDay?.if_students_struggle },
      { key: 'momentum', label: 'Keep Momentum', body: guideDay?.keep_momentum },
      {
        key: 'paired',
        label: 'Paired-Course Coordination / Corresponding Application',
        body: guideDay?.corresponding_application,
      },
      {
        key: 'evidence',
        label: 'Evidence / Check for Understanding',
        body: guideDay?.evidence_check_for_understanding,
      },
      {
        key: 'after',
        label: 'After Class',
        body:
          guideDay?.record_link_expectation ||
          'Record evidence, deviations, follow-up needs, and any required instructor notes before closing the day.',
      },
      { key: 'instructor-only', label: 'Instructor Notes / Answer Keys', body: mathInstructor },
    ];
  }, [guideDay, mathLesson, bookAndAwsReferences]);

  const startToday = async () => {
    if (!selectedSection || !isCurrentDay) return;
    setActionLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('start_current_planner_day', {
        p_section_id: selectedSection.section_id,
        p_actual_date: actualDate,
      });
      if (rpcError) throw rpcError;
      const refreshed = await refreshSections(selectedSection.section_id);
      await loadDelivery(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const completeToday = async () => {
    if (!selectedSection || !isCurrentDay || !currentDayInProgress) return;
    setActionLoading(true);
    setError('');
    setAttendanceBlock('');
    try {
      const requirement = await supabase.rpc('attendance_completion_requirement', {
        p_section_id: selectedSection.section_id,
        p_attendance_date: actualDate,
      });

      if (requirement.error) throw requirement.error;
      const row = Array.isArray(requirement.data) ? requirement.data[0] : requirement.data;
      if (row?.attendance_required && !row?.finalized) {
        setAttendanceBlock(
          'Attendance confirmation is required before this paired class day can be completed.'
        );
        return;
      }

      const { error: rpcError } = await supabase.rpc('complete_current_planner_day', {
        p_section_id: selectedSection.section_id,
        p_actual_date: actualDate,
        p_actual_minutes: null,
        p_deviation_summary: deviationSummary.trim() || null,
        p_follow_up_needed: followUpNeeded,
        p_follow_up_notes: followUpNotes.trim() || null,
      });
      if (rpcError) throw rpcError;

      setDeviationSummary('');
      setFollowUpNeeded(false);
      setFollowUpNotes('');
      const refreshed = await refreshSections(selectedSection.section_id);
      setViewedGuideDayId(refreshed?.guide_day_id ?? null);
      await loadDelivery(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const viewDay = (dayNumber: number) => {
    const target = guideDayRefs.find((day) => day.dayNumber === dayNumber);
    if (target) setViewedGuideDayId(target.id);
  };

  const currentIndex = guideDayRefs.findIndex((day) => day.id === guideDay?.id);

  const actionPanel = selectedSection ? (
    <section
      style={{
        border: '1px solid #263c39',
        borderRadius: 12,
        background: '#091512',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#45d6e8', fontSize: 11, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Current Day Controls
          </div>
          <strong style={{ fontSize: 18 }}>
            {currentDayInProgress ? `Class in progress · ${elapsedClock(delivery?.started_at ?? null, timerNow)}` : 'Ready to teach'}
          </strong>
        </div>
        <a
          href={`/attendance?section=${encodeURIComponent(selectedSection.section_id)}&date=${encodeURIComponent(actualDate)}`}
          style={{
            alignSelf: 'center',
            border: '1px solid #50df92',
            background: 'rgba(80,223,146,.09)',
            color: '#b8ffd8',
            textDecoration: 'none',
            borderRadius: 8,
            padding: '9px 12px',
            fontWeight: 900,
          }}
        >
          Open Attendance
        </a>
      </div>

      {attendanceBlock && (
        <div style={{ border: '1px solid rgba(255,154,56,.55)', background: 'rgba(255,154,56,.08)', color: '#ffd0a1', borderRadius: 8, padding: 10 }}>
          {attendanceBlock}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0,1fr)', gap: 10 }}>
        <label style={{ display: 'grid', gap: 5, color: '#a9bdb9', fontSize: 12 }}>
          Actual date
          <input
            type="date"
            value={actualDate}
            onChange={(event) => setActualDate(event.target.value)}
            disabled={actionLoading || !isCurrentDay || currentDayInProgress}
            style={{ background: '#07100f', border: '1px solid #2c4742', color: '#e9f3f1', borderRadius: 7, padding: 9 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 5, color: '#a9bdb9', fontSize: 12 }}>
          Daily comments / deviation summary
          <textarea
            value={deviationSummary}
            onChange={(event) => setDeviationSummary(event.target.value)}
            disabled={actionLoading || !isCurrentDay}
            rows={2}
            style={{ resize: 'vertical', background: '#07100f', border: '1px solid #2c4742', color: '#e9f3f1', borderRadius: 7, padding: 9 }}
          />
        </label>
      </div>

      <label style={{ color: '#b7c9c5', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={followUpNeeded}
          onChange={(event) => setFollowUpNeeded(event.target.checked)}
          disabled={actionLoading || !isCurrentDay}
        />{' '}
        Follow-up needed
      </label>

      {followUpNeeded && (
        <textarea
          value={followUpNotes}
          onChange={(event) => setFollowUpNotes(event.target.value)}
          disabled={actionLoading || !isCurrentDay}
          placeholder="Describe follow-up needed"
          rows={2}
          style={{ resize: 'vertical', background: '#07100f', border: '1px solid #2c4742', color: '#e9f3f1', borderRadius: 7, padding: 9 }}
        />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!currentDayInProgress ? (
          <button
            type="button"
            onClick={startToday}
            disabled={actionLoading || !isCurrentDay || !actualDate}
            style={{ border: '1px solid #45d6e8', background: '#145d68', color: 'white', borderRadius: 8, padding: '10px 16px', fontWeight: 900, cursor: 'pointer' }}
          >
            {actionLoading ? 'Processing…' : 'Start Today'}
          </button>
        ) : (
          <button
            type="button"
            onClick={completeToday}
            disabled={actionLoading || !isCurrentDay || !actualDate}
            style={{ border: '1px solid #50df92', background: '#17663f', color: 'white', borderRadius: 8, padding: '10px 16px', fontWeight: 900, cursor: 'pointer' }}
          >
            {actionLoading ? 'Processing…' : 'Complete Day'}
          </button>
        )}
        {!isCurrentDay && (
          <span style={{ color: '#ffbf82', alignSelf: 'center', fontSize: 12 }}>
            Preview mode is read-only.
          </span>
        )}
      </div>
    </section>
  ) : null;

  if (loading) {
    return <main style={{ padding: 24, color: '#dceae7' }}>Loading planner…</main>;
  }

  if (!selectedSection) {
    return <main style={{ padding: 24, color: '#dceae7' }}>No teaching sections are available.</main>;
  }

  return (
    <main style={{ width: 'min(1500px, 100%)', margin: '0 auto', padding: '16px clamp(10px, 2vw, 24px) 40px' }}>
      {error && (
        <div style={{ marginBottom: 12, border: '1px solid #b85c5c', background: 'rgba(184,92,92,.09)', color: '#ffd0d0', borderRadius: 9, padding: 11 }}>
          {error}
        </div>
      )}

      {guideDay ? (
        <PlannerTeachingConsole
          courseLabel={selectedSection.course_code || selectedSection.course_name || 'Course'}
          sectionLabel={selectedSection.cohort_name || selectedSection.section_name || selectedSection.section_code}
          dayNumber={guideDay.planner_day_number}
          totalDays={guideDayRefs.length || null}
          title={guideDay.title || `Planner Day ${guideDay.planner_day_number}`}
          objective={guideDay.objective}
          formatLabel={
            mathLesson
              ? `${segments.reduce((sum, row) => sum + row.planned_minutes, 0)} min core + ${mathLesson.planned_minutes} min Welding Math`
              : `${segments.reduce((sum, row) => sum + row.planned_minutes, 0)} min plan`
          }
          protectedOutcomes={outcomes.map((outcome) => ({ id: outcome.id, code: outcome.outcome_code, text: outcome.outcome_text }))}
          rows={planRows}
          resources={resolvedResources}
          supportItems={supportItems}
          dayOptions={guideDayRefs}
          selectedGuideDayId={guideDay.id}
          isCurrentDay={isCurrentDay}
          loading={guideLoading}
          onPrevious={() => {
            if (currentIndex > 0) setViewedGuideDayId(guideDayRefs[currentIndex - 1].id);
          }}
          onNext={() => {
            if (currentIndex >= 0 && currentIndex < guideDayRefs.length - 1) {
              setViewedGuideDayId(guideDayRefs[currentIndex + 1].id);
            }
          }}
          onSelectDay={viewDay}
          onReturnCurrent={() => setViewedGuideDayId(selectedSection.guide_day_id)}
          studentDisplayUrl={`/student-display/${guideDay.id}`}
          actionPanel={actionPanel}
        />
      ) : (
        <section style={{ border: '1px solid #293c39', background: '#091512', color: '#cbdad7', borderRadius: 12, padding: 24 }}>
          {guideLoading ? 'Loading teacher guide…' : 'No teacher-guide content is mapped to this planner day.'}
        </section>
      )}
    </main>
  );
}
