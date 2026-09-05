'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import PlannerTeachingConsole, {
  type PlannerDayOption,
  type PlannerLaunchResource,
  type PlannerPlanRow,
  type PlannerSupportItem,
} from '@/app/components/planner/PlannerTeachingConsole';

interface TrainingSession {
  id: string;
  school_id: string;
  session_name: string;
  status: string;
  started_at: string;
  expires_at: string;
}

interface StateRow {
  id: string;
  training_session_id: string;
  school_id: string;
  source_section_id: string;
  simulated_current_day: number;
  manual_hold: boolean;
  hold_reason: string | null;
  active_timer_started_at: string | null;
  active_timer_started_by: string | null;
}

interface Section {
  id: string;
  school_id: string;
  course_id: string;
  section_name: string | null;
  section_code: string | null;
  planned_instructional_days: number | null;
}

interface Course {
  id: string;
  course_code: string | null;
  course_name: string | null;
}

interface Delivery {
  id: string;
  source_section_id: string;
  planner_day_number: number;
  delivery_status: string;
  started_at: string | null;
  completed_at: string | null;
  actual_minutes: number | null;
  instructor_id: string | null;
  deviation_summary: string | null;
  follow_up_needed: boolean;
  follow_up_notes: string | null;
}

interface Member {
  id: string;
  user_id: string;
  school_role: string;
  connected: boolean;
  joined_at: string;
  left_at: string | null;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
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
  materials_equipment: string | null;
  teaching_tips: string | null;
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

interface Segment {
  id: string;
  sequence_number: number;
  segment_type: string | null;
  segment_title: string | null;
  planned_minutes: number | null;
  instructor_actions: string | null;
  student_actions: string | null;
  notes: string | null;
  start_minute: number | null;
  end_minute: number | null;
}

interface Resource {
  id: string;
  sequence_number: number;
  resource_type: string | null;
  resource_title: string | null;
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

function sectionLabel(section: Section | null, fallback = 'Training Section') {
  return section?.section_name || section?.section_code || fallback;
}

function clock(start: string | null, nowMs: number) {
  if (!start) return '0:00';
  const seconds = Math.max(0, Math.floor((nowMs - new Date(start).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function minuteRange(start: number | null, end: number | null, planned: number | null) {
  if (start !== null && end !== null) return `${start}–${end} min`;
  return `${planned ?? 0} min`;
}

function teachSummary(guide: GuideDay | null) {
  if (!guide) return '';
  return [
    guide.safety_focus ? `Safety focus: ${guide.safety_focus}` : '',
    guide.opening_review ? `Opening / retrieval: ${guide.opening_review}` : '',
    guide.demonstration ? `Demonstration / model: ${guide.demonstration}` : '',
    guide.guided_practice ? `Guided practice: ${guide.guided_practice}` : '',
    guide.independent_practice ? `Independent application: ${guide.independent_practice}` : '',
    guide.instructor_checks ? `Instructor checks: ${guide.instructor_checks}` : '',
    guide.assessment ? `Assessment: ${guide.assessment}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default function TrainingTeacherPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [guideError, setGuideError] = useState('');
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [states, setStates] = useState<StateRow[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [viewingDay, setViewingDay] = useState(1);
  const [dayOptions, setDayOptions] = useState<PlannerDayOption[]>([]);
  const [guide, setGuide] = useState<GuideDay | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [mathLesson, setMathLesson] = useState<MathLesson | null>(null);
  const [mathSegments, setMathSegments] = useState<MathSegment[]>([]);
  const [outcomes, setOutcomes] = useState<ProtectedOutcome[]>([]);
  const [comment, setComment] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followNotes, setFollowNotes] = useState('');
  const [trainingNote, setTrainingNote] = useState('');
  const [timerNow, setTimerNow] = useState(Date.now());

  const sectionMap = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections]
  );
  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const selectedState =
    states.find((state) => state.source_section_id === sectionId) ?? states[0] ?? null;
  const selectedSection = selectedState
    ? sectionMap.get(selectedState.source_section_id) ?? null
    : null;
  const selectedCourse = selectedSection
    ? courseMap.get(selectedSection.course_id) ?? null
    : null;
  const currentDay = selectedState?.simulated_current_day ?? 1;
  const plannedDays = Math.max(selectedSection?.planned_instructional_days ?? 1, 1);
  const activeDelivery =
    deliveries.find(
      (delivery) =>
        delivery.source_section_id === selectedState?.source_section_id &&
        delivery.planner_day_number === currentDay &&
        delivery.delivery_status === 'in_progress'
    ) ?? null;

  const fetchMain = async () => {
    const [sessionResult, stateResult, deliveryResult, memberResult] = await Promise.all([
      supabase
        .from('training_sessions')
        .select('id,school_id,session_name,status,started_at,expires_at')
        .eq('id', sessionId)
        .maybeSingle(),
      supabase
        .from('training_section_state')
        .select(
          'id,training_session_id,school_id,source_section_id,simulated_current_day,manual_hold,hold_reason,active_timer_started_at,active_timer_started_by'
        )
        .eq('training_session_id', sessionId)
        .order('source_section_id'),
      supabase
        .from('training_day_delivery')
        .select(
          'id,source_section_id,planner_day_number,delivery_status,started_at,completed_at,actual_minutes,instructor_id,deviation_summary,follow_up_needed,follow_up_notes'
        )
        .eq('training_session_id', sessionId),
      supabase
        .from('training_session_members')
        .select('id,user_id,school_role,connected,joined_at,left_at')
        .eq('training_session_id', sessionId),
    ]);

    const firstError = [
      sessionResult.error,
      stateResult.error,
      deliveryResult.error,
      memberResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError?.message ?? 'Training session failed to load.');
    if (!sessionResult.data) throw new Error('Training session is no longer active.');

    const loadedStates = (stateResult.data ?? []) as StateRow[];
    const sourceIds = loadedStates.map((state) => state.source_section_id);
    let loadedSections: Section[] = [];
    let loadedCourses: Course[] = [];

    if (sourceIds.length) {
      const sectionResult = await supabase
        .from('sections')
        .select('id,school_id,course_id,section_name,section_code,planned_instructional_days')
        .in('id', sourceIds);
      if (sectionResult.error) throw sectionResult.error;
      loadedSections = (sectionResult.data ?? []) as Section[];

      const courseIds = Array.from(new Set(loadedSections.map((section) => section.course_id)));
      if (courseIds.length) {
        const courseResult = await supabase
          .from('courses')
          .select('id,course_code,course_name')
          .in('id', courseIds);
        if (courseResult.error) throw courseResult.error;
        loadedCourses = (courseResult.data ?? []) as Course[];
      }
    }

    const memberIds = ((memberResult.data ?? []) as Member[]).map((member) => member.user_id);
    let loadedProfiles: Profile[] = [];
    if (memberIds.length) {
      const profileResult = await supabase
        .from('profiles')
        .select('id,display_name,email')
        .in('id', memberIds);
      if (!profileResult.error) loadedProfiles = (profileResult.data ?? []) as Profile[];
    }

    setSession(sessionResult.data as TrainingSession);
    setStates(loadedStates);
    setSections(loadedSections);
    setCourses(loadedCourses);
    setDeliveries((deliveryResult.data ?? []) as Delivery[]);
    setMembers((memberResult.data ?? []) as Member[]);
    setProfiles(loadedProfiles);

    if (!sectionId && loadedStates[0]) {
      setSectionId(loadedStates[0].source_section_id);
      setViewingDay(loadedStates[0].simulated_current_day);
    }
  };

  const ensureJoined = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      router.replace('/training/login');
      return false;
    }

    const { data: member, error: memberError } = await supabase.rpc(
      'is_training_session_member',
      { check_training_session_id: sessionId }
    );
    if (memberError) throw memberError;

    if (!member) {
      const { error: joinError } = await supabase.rpc('join_training_session', {
        p_training_session_id: sessionId,
      });
      if (joinError) throw joinError;
    }
    return true;
  };

  useEffect(() => {
    (async () => {
      try {
        if (await ensureJoined()) await fetchMain();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`training-teacher-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_section_state', filter: `training_session_id=eq.${sessionId}` },
        () => fetchMain()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_day_delivery', filter: `training_session_id=eq.${sessionId}` },
        () => fetchMain()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_session_members', filter: `training_session_id=eq.${sessionId}` },
        () => fetchMain()
      )
      .subscribe();

    const heartbeat = window.setInterval(
      () => supabase.rpc('touch_training_session', { p_training_session_id: sessionId }),
      60000
    );

    return () => {
      window.clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (selectedState) setViewingDay(selectedState.simulated_current_day);
  }, [selectedState?.source_section_id, selectedState?.simulated_current_day]);

  useEffect(() => {
    if (!selectedSection) return;
    let cancelled = false;

    (async () => {
      setGuideError('');
      setGuide(null);
      setSegments([]);
      setResources([]);
      setMathLesson(null);
      setMathSegments([]);
      setOutcomes([]);

      const plannerIndex = await supabase
        .from('planner_days')
        .select('planner_day_number,guide_day_id')
        .eq('section_id', selectedSection.id)
        .order('planner_day_number');

      if (cancelled) return;
      if (plannerIndex.error) {
        setGuideError(`Unable to resolve this section's guide: ${plannerIndex.error.message}`);
        return;
      }

      const mapped = (plannerIndex.data ?? []) as Array<{
        planner_day_number: number;
        guide_day_id: string | null;
      }>;
      setDayOptions(
        mapped
          .filter((row) => Boolean(row.guide_day_id))
          .map((row) => ({
            id: row.guide_day_id as string,
            dayNumber: row.planner_day_number,
            title: null,
          }))
      );

      const mappedDay = mapped.find((row) => row.planner_day_number === viewingDay);
      const guideDayId = mappedDay?.guide_day_id;
      if (!guideDayId) {
        setGuideError(
          `No teacher-guide day is mapped to ${sectionLabel(selectedSection)} · Day ${viewingDay}.`
        );
        return;
      }

      const [dayResult, segmentResult, resourceResult, mathResult, outcomeLinks] = await Promise.all([
        supabase
          .from('course_guide_days')
          .select(
            'id,guide_id,planner_day_number,title,objective,instructor_prep,safety_focus,opening_review,demonstration,guided_practice,independent_practice,instructor_checks,assessment,materials_equipment,teaching_tips,corresponding_application,evidence_check_for_understanding,weekly_coaching_focus,coaching_focus,if_students_struggle,keep_momentum,aws_alignment,aws_key_indicators,record_link_expectation'
          )
          .eq('id', guideDayId)
          .maybeSingle(),
        supabase
          .from('course_guide_day_segments')
          .select(
            'id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute'
          )
          .eq('guide_day_id', guideDayId)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_resources')
          .select('id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required')
          .eq('guide_day_id', guideDayId)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_math')
          .select('id,math_day_number,title,planned_minutes,book_connection,goal,instructor_notes,answers_quick_check')
          .eq('guide_day_id', guideDayId)
          .maybeSingle(),
        supabase
          .from('course_guide_day_outcomes')
          .select('outcome_id')
          .eq('guide_day_id', guideDayId),
      ]);

      if (cancelled) return;
      const firstError = dayResult.error || segmentResult.error || resourceResult.error || outcomeLinks.error;
      if (firstError) {
        setGuideError(firstError.message);
        return;
      }

      const loadedGuide = (dayResult.data ?? null) as GuideDay | null;
      setGuide(loadedGuide);
      setSegments((segmentResult.data ?? []) as Segment[]);
      setResources((resourceResult.data ?? []) as Resource[]);

      if (!mathResult.error && mathResult.data) {
        const lesson = mathResult.data as MathLesson;
        setMathLesson(lesson);
        const { data: mathRows, error: mathError } = await supabase
          .from('course_guide_day_math_segments')
          .select('id,sequence_number,start_minute,end_minute,planned_minutes,activity,segment_type')
          .eq('math_lesson_id', lesson.id)
          .order('sequence_number');
        if (!mathError) setMathSegments((mathRows ?? []) as MathSegment[]);
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSection?.id, viewingDay, supabase]);

  useEffect(() => {
    const id = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const run = async (
    action: () => PromiseLike<{ error: unknown }>,
    message: string
  ) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      if (result.error) throw result.error;
      setNotice(message);
      await fetchMain();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startDay = () => {
    if (!selectedState) return;
    return run(
      () =>
        supabase.rpc('training_start_current_day', {
          p_training_session_id: sessionId,
          p_source_section_id: selectedState.source_section_id,
        }),
      'Training class started.'
    );
  };

  const completeDay = async () => {
    if (!selectedState) return;
    await run(
      () =>
        supabase.rpc('training_complete_current_day', {
          p_training_session_id: sessionId,
          p_source_section_id: selectedState.source_section_id,
          p_deviation_summary: comment.trim() || null,
          p_follow_up_needed: followUp,
          p_follow_up_notes: followNotes.trim() || null,
        }),
      'Training day completed.'
    );
    setComment('');
    setFollowUp(false);
    setFollowNotes('');
  };

  const addNote = async () => {
    if (!selectedState || !trainingNote.trim()) return;
    await run(
      () =>
        supabase.rpc('training_add_note', {
          p_training_session_id: sessionId,
          p_source_section_id: selectedState.source_section_id,
          p_planner_day_number: viewingDay,
          p_note_type: 'training_note',
          p_note_text: trainingNote.trim(),
          p_follow_up_needed: followUp,
        }),
      'Training note added.'
    );
    setTrainingNote('');
  };

  const leaveAndLogout = async () => {
    setBusy(true);
    try {
      await supabase.rpc('leave_training_session', { p_training_session_id: sessionId });
    } finally {
      await supabase.auth.signOut();
      router.push('/training/login');
    }
  };

  const planRows = useMemo<PlannerPlanRow[]>(() => {
    const core = segments.map((segment) => ({
      id: `core-${segment.id}`,
      time: minuteRange(segment.start_minute, segment.end_minute, segment.planned_minutes),
      instructor: segment.instructor_actions || segment.segment_title || 'Assigned training activity',
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
    return [...core, ...math].sort((a, b) => Number.parseInt(a.time, 10) - Number.parseInt(b.time, 10));
  }, [segments, mathSegments, mathLesson]);

  const launchResources = useMemo<PlannerLaunchResource[]>(() => {
    return resources.map((resource) => {
      const type = resource.resource_type || 'resource';
      const productionAssessment = type === 'assessment' || resource.resource_url?.startsWith('/classroom');
      return {
        id: resource.id,
        title: resource.resource_title || 'Resource',
        url: productionAssessment ? null : resource.resource_url,
        type,
        notes: productionAssessment
          ? 'Launch disabled in Training Mode to protect production assessment records.'
          : resource.resource_notes,
        required: resource.required,
      };
    });
  }, [resources]);

  const references = [
    guide?.aws_alignment ? `AWS alignment: ${guide.aws_alignment}` : '',
    guide?.aws_key_indicators ? `AWS key indicators: ${guide.aws_key_indicators}` : '',
    mathLesson?.book_connection ? `Math book: ${mathLesson.book_connection}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const supportItems = useMemo<PlannerSupportItem[]>(() => {
    const coaching = [guide?.weekly_coaching_focus, guide?.coaching_focus]
      .filter(Boolean)
      .join('\n\n');
    const mathInstructor = [
      mathLesson?.instructor_notes ? `Math instructor notes: ${mathLesson.instructor_notes}` : '',
      mathLesson?.answers_quick_check ? `Math answers / quick check: ${mathLesson.answers_quick_check}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    return [
      { key: 'before', label: 'Before Class', body: guide?.instructor_prep || guide?.materials_equipment },
      { key: 'teach', label: 'Teach This Today', body: teachSummary(guide) },
      { key: 'refs', label: 'Book / AWS Page References', body: references },
      { key: 'coach', label: 'Instructor Coaching', body: coaching || guide?.teaching_tips },
      { key: 'struggle', label: 'If Students Struggle', body: guide?.if_students_struggle },
      { key: 'momentum', label: 'Keep Momentum', body: guide?.keep_momentum },
      { key: 'paired', label: 'Paired-Course Coordination / Corresponding Application', body: guide?.corresponding_application },
      { key: 'evidence', label: 'Evidence / Check for Understanding', body: guide?.evidence_check_for_understanding },
      { key: 'after', label: 'After Class', body: guide?.record_link_expectation || 'Record the training-only delivery reflection before moving on.' },
      { key: 'instructor-only', label: 'Instructor Notes / Answer Keys', body: mathInstructor },
    ];
  }, [guide, mathLesson, references]);

  const connectedCount = members.filter((member) => member.connected).length;
  const isCurrentDay = viewingDay === currentDay;
  const currentGuideOption = dayOptions.find((option) => option.dayNumber === viewingDay);
  const guideIndex = dayOptions.findIndex((option) => option.dayNumber === viewingDay);

  const trainingControls = (
    <section
      style={{
        border: '1px solid #2d4540',
        borderRadius: 12,
        background: '#091512',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#ff9a38', fontWeight: 900, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Training Mode · Shared Sandbox
          </div>
          <strong style={{ fontSize: 18 }}>
            {activeDelivery
              ? `Training class in progress · ${clock(selectedState?.active_timer_started_at ?? null, timerNow)}`
              : selectedState?.manual_hold
              ? `Training hold · ${selectedState.hold_reason ?? 'No reason recorded'}`
              : 'Ready to practice the teaching workflow'}
          </strong>
        </div>
        <div style={{ color: '#91a6a1', fontSize: 12 }}>
          {connectedCount} participant{connectedCount === 1 ? '' : 's'} connected
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          value={selectedState?.source_section_id ?? ''}
          onChange={(event) => setSectionId(event.target.value)}
          style={{ background: '#06100e', border: '1px solid #2e4842', color: '#e8f2ef', borderRadius: 8, padding: 9 }}
        >
          {states.map((state) => {
            const section = sectionMap.get(state.source_section_id) ?? null;
            const course = section ? courseMap.get(section.course_id) : null;
            return (
              <option key={state.id} value={state.source_section_id}>
                {sectionLabel(section)} · {course?.course_code ?? 'Course'}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={() => router.push(`/training/session/${sessionId}/school`)}
          style={{ border: '1px solid #35534d', background: '#0d1b18', color: '#d8e7e4', borderRadius: 8, padding: '9px 12px', fontWeight: 850 }}
        >
          School Training View
        </button>
        <button
          type="button"
          onClick={() => router.push('/training')}
          style={{ border: '1px solid #35534d', background: '#0d1b18', color: '#d8e7e4', borderRadius: 8, padding: '9px 12px', fontWeight: 850 }}
        >
          Training Center
        </button>
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Training-only daily comment"
        rows={2}
        style={{ background: '#06100e', border: '1px solid #2e4842', color: '#e8f2ef', borderRadius: 8, padding: 9, resize: 'vertical' }}
      />
      <label style={{ color: '#a8bbb7', fontSize: 12 }}>
        <input type="checkbox" checked={followUp} onChange={(event) => setFollowUp(event.target.checked)} /> Follow-up needed
      </label>
      {followUp && (
        <input
          value={followNotes}
          onChange={(event) => setFollowNotes(event.target.value)}
          placeholder="What should be revisited?"
          style={{ background: '#06100e', border: '1px solid #2e4842', color: '#e8f2ef', borderRadius: 8, padding: 9 }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!activeDelivery ? (
          <button
            type="button"
            disabled={busy || !selectedState || Boolean(selectedState?.manual_hold) || !isCurrentDay}
            onClick={startDay}
            style={{ border: '1px solid #45d6e8', background: '#145b65', color: 'white', borderRadius: 8, padding: '10px 14px', fontWeight: 900 }}
          >
            Start Current Training Day
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !selectedState || !isCurrentDay}
            onClick={completeDay}
            style={{ border: '1px solid #50df92', background: '#17633f', color: 'white', borderRadius: 8, padding: '10px 14px', fontWeight: 900 }}
          >
            Complete Current Training Day
          </button>
        )}
      </div>

      <div style={{ borderTop: '1px solid #243a35', paddingTop: 11, display: 'grid', gap: 7 }}>
        <div style={{ color: '#45d6e8', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Training-Only Note
        </div>
        <textarea
          value={trainingNote}
          onChange={(event) => setTrainingNote(event.target.value)}
          placeholder={`Training note for Day ${viewingDay}`}
          rows={2}
          style={{ background: '#06100e', border: '1px solid #2e4842', color: '#e8f2ef', borderRadius: 8, padding: 9, resize: 'vertical' }}
        />
        <button
          type="button"
          disabled={busy || !trainingNote.trim() || !selectedState}
          onClick={addNote}
          style={{ justifySelf: 'start', border: '1px solid #45d6e8', background: 'rgba(69,214,232,.08)', color: '#bdf6fb', borderRadius: 8, padding: '8px 11px', fontWeight: 850 }}
        >
          Add Training Note
        </button>
      </div>

      <details style={{ borderTop: '1px solid #243a35', paddingTop: 10 }}>
        <summary style={{ cursor: 'pointer', color: '#b7c8c4', fontWeight: 850 }}>Connected participants</summary>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {members.map((member) => (
            <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: '1px solid #263c37', borderRadius: 7, padding: '7px 9px' }}>
              <span>{profileMap.get(member.user_id)?.display_name ?? `Participant ${member.user_id.slice(0, 8)}`}</span>
              <span style={{ color: member.connected ? '#70dba0' : '#778b86', fontSize: 11 }}>
                {member.connected ? 'Connected' : 'Offline'} · {member.school_role.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </details>

      <button
        type="button"
        disabled={busy}
        onClick={leaveAndLogout}
        style={{ justifySelf: 'start', border: '1px solid #8d514c', background: 'rgba(141,81,76,.08)', color: '#f2aaa3', borderRadius: 8, padding: '8px 11px', fontWeight: 850 }}
      >
        Leave Training & Log Out
      </button>
    </section>
  );

  if (loading) {
    return <main style={{ minHeight: '100vh', padding: 30, background: '#07100f', color: '#aebfbb' }}>Opening shared training classroom…</main>;
  }

  return (
    <main style={{ width: 'min(1500px,100%)', margin: '0 auto', padding: '14px clamp(10px,2vw,24px) 46px' }}>
      <div style={{ marginBottom: 12, border: '1px solid rgba(255,154,56,.5)', background: 'rgba(255,154,56,.08)', color: '#ffd0a1', borderRadius: 9, padding: '9px 12px', textAlign: 'center', fontWeight: 900, fontSize: 11, letterSpacing: '.06em' }}>
        TRAINING MODE · SHARED SANDBOX · PRODUCTION CLASS RECORDS ARE NOT CHANGED
      </div>
      {error && <div style={{ marginBottom: 10, border: '1px solid #965b55', color: '#ffd1cd', padding: 10, borderRadius: 8 }}>{error}</div>}
      {notice && <div style={{ marginBottom: 10, border: '1px solid #3e765b', color: '#b8f4d3', padding: 10, borderRadius: 8 }}>{notice}</div>}
      {guideError && <div style={{ marginBottom: 10, border: '1px solid #965b55', color: '#ffd1cd', padding: 10, borderRadius: 8 }}>{guideError}</div>}

      {guide ? (
        <PlannerTeachingConsole
          courseLabel={selectedCourse?.course_code || selectedCourse?.course_name || 'Course'}
          sectionLabel={`${session?.session_name ?? 'Training'} · ${sectionLabel(selectedSection)}`}
          dayNumber={viewingDay}
          totalDays={plannedDays}
          title={guide.title || `Training Day ${viewingDay}`}
          objective={guide.objective}
          formatLabel={
            mathLesson
              ? `${segments.reduce((sum, row) => sum + (row.planned_minutes ?? 0), 0)} min core + ${mathLesson.planned_minutes} min Welding Math`
              : `${segments.reduce((sum, row) => sum + (row.planned_minutes ?? 0), 0)} min plan`
          }
          protectedOutcomes={outcomes.map((outcome) => ({ id: outcome.id, code: outcome.outcome_code, text: outcome.outcome_text }))}
          rows={planRows}
          resources={launchResources}
          supportItems={supportItems}
          dayOptions={dayOptions}
          selectedGuideDayId={currentGuideOption?.id ?? guide.id}
          isCurrentDay={isCurrentDay}
          onPrevious={() => {
            if (guideIndex > 0) setViewingDay(dayOptions[guideIndex - 1].dayNumber);
          }}
          onNext={() => {
            if (guideIndex >= 0 && guideIndex < dayOptions.length - 1) setViewingDay(dayOptions[guideIndex + 1].dayNumber);
          }}
          onSelectDay={setViewingDay}
          onReturnCurrent={() => setViewingDay(currentDay)}
          studentDisplayUrl={`/student-display/${guide.id}`}
          actionPanel={trainingControls}
        />
      ) : (
        <section style={{ border: '1px solid #2d4540', background: '#091512', color: '#a9bbb7', borderRadius: 12, padding: 24 }}>
          No mapped teacher guide is available for this training day.
        </section>
      )}
    </main>
  );
}
