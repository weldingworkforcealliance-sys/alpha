'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

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
  coaching_focus: string | null;
  if_students_struggle: string | null;
  keep_momentum: string | null;
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

function clock(start: string | null) {
  if (!start) return '0:00';
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(start).getTime()) / 1000)
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function sectionLabel(section: Section | null, fallback = 'Training Section') {
  return section?.section_name || section?.section_code || fallback;
}

export default function TrainingTeacherPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();
  const [supabase] = useState(getSupabase);

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
  const [guide, setGuide] = useState<GuideDay | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [comment, setComment] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followNotes, setFollowNotes] = useState('');
  const [trainingNote, setTrainingNote] = useState('');
  const [, setTick] = useState(0);

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
    const [sessionResult, stateResult, deliveryResult, memberResult] =
      await Promise.all([
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

    if (firstError) {
      throw new Error(firstError?.message ?? 'Training session failed to load.');
    }
    if (!sessionResult.data) {
      throw new Error('Training session is no longer active.');
    }

    const loadedStates = (stateResult.data ?? []) as StateRow[];
    const sourceIds = loadedStates.map((state) => state.source_section_id);

    let loadedSections: Section[] = [];
    let loadedCourses: Course[] = [];

    if (sourceIds.length) {
      const sectionResult = await supabase
        .from('sections')
        .select(
          'id,school_id,course_id,section_name,section_code,planned_instructional_days'
        )
        .in('id', sourceIds);
      if (sectionResult.error) throw sectionResult.error;
      loadedSections = (sectionResult.data ?? []) as Section[];

      const courseIds = Array.from(
        new Set(loadedSections.map((section) => section.course_id))
      );
      if (courseIds.length) {
        const courseResult = await supabase
          .from('courses')
          .select('id,course_code,course_name')
          .in('id', courseIds);
        if (courseResult.error) throw courseResult.error;
        loadedCourses = (courseResult.data ?? []) as Course[];
      }
    }

    const memberIds = ((memberResult.data ?? []) as Member[]).map(
      (member) => member.user_id
    );
    let loadedProfiles: Profile[] = [];
    if (memberIds.length) {
      const profileResult = await supabase
        .from('profiles')
        .select('id,display_name,email')
        .in('id', memberIds);
      if (!profileResult.error) {
        loadedProfiles = (profileResult.data ?? []) as Profile[];
      }
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
        {
          event: '*',
          schema: 'public',
          table: 'training_section_state',
          filter: `training_session_id=eq.${sessionId}`,
        },
        () => fetchMain()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_day_delivery',
          filter: `training_session_id=eq.${sessionId}`,
        },
        () => fetchMain()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_session_members',
          filter: `training_session_id=eq.${sessionId}`,
        },
        () => fetchMain()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_notes',
          filter: `training_session_id=eq.${sessionId}`,
        },
        () => fetchMain()
      )
      .subscribe();

    const heartbeat = window.setInterval(
      () =>
        supabase.rpc('touch_training_session', {
          p_training_session_id: sessionId,
        }),
      60000
    );

    return () => {
      window.clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (selectedState) {
      setViewingDay(selectedState.simulated_current_day);
    }
  }, [selectedState?.source_section_id, selectedState?.simulated_current_day]);

  useEffect(() => {
    if (!selectedSection) return;

    let cancelled = false;

    (async () => {
      setGuideError('');
      setGuide(null);
      setSegments([]);
      setResources([]);

      /*
        A course can have several guide variants (PVHS, college day/night, legacy).
        Training must follow the guide already mapped to this exact section's planner day.
        Looking up by course_id + day number is ambiguous and can return multiple guides.
      */
      const plannerDayResult = await supabase
        .from('planner_days')
        .select('guide_day_id')
        .eq('section_id', selectedSection.id)
        .eq('planner_day_number', viewingDay)
        .maybeSingle();

      if (cancelled) return;

      if (plannerDayResult.error) {
        setGuideError(`Unable to resolve this section's guide: ${plannerDayResult.error.message}`);
        return;
      }

      const guideDayId = plannerDayResult.data?.guide_day_id as string | null | undefined;
      if (!guideDayId) {
        setGuideError(
          `No teacher-guide day is mapped to ${sectionLabel(selectedSection)} · Day ${viewingDay}.`
        );
        return;
      }

      const dayResult = await supabase
        .from('course_guide_days')
        .select(
          'id,guide_id,planner_day_number,title,objective,safety_focus,opening_review,demonstration,guided_practice,independent_practice,instructor_checks,assessment,materials_equipment,teaching_tips,corresponding_application,evidence_check_for_understanding,coaching_focus,if_students_struggle,keep_momentum'
        )
        .eq('id', guideDayId)
        .maybeSingle();

      if (cancelled) return;

      if (dayResult.error) {
        setGuideError(`Unable to load the mapped teacher guide: ${dayResult.error.message}`);
        return;
      }

      const day = (dayResult.data ?? null) as GuideDay | null;
      setGuide(day);
      if (!day) {
        setGuideError('The mapped teacher-guide day could not be found.');
        return;
      }

      const [segmentResult, resourceResult] = await Promise.all([
        supabase
          .from('course_guide_day_segments')
          .select(
            'id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute'
          )
          .eq('guide_day_id', day.id)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_resources')
          .select(
            'id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required'
          )
          .eq('guide_day_id', day.id)
          .order('sequence_number'),
      ]);

      if (cancelled) return;

      if (segmentResult.error || resourceResult.error) {
        setGuideError(
          `Teacher-guide details failed to load: ${
            segmentResult.error?.message || resourceResult.error?.message || 'Unknown error'
          }`
        );
        return;
      }

      setSegments((segmentResult.data ?? []) as Segment[]);
      setResources((resourceResult.data ?? []) as Resource[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSection?.id, viewingDay, supabase]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
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
      await supabase.rpc('leave_training_session', {
        p_training_session_id: sessionId,
      });
    } finally {
      await supabase.auth.signOut();
      router.push('/training/login');
    }
  };

  if (loading) {
    return <main className="loading">Opening shared training classroom…</main>;
  }

  const connectedCount = members.filter((member) => member.connected).length;
  const dayOptions = Array.from({ length: plannedDays }, (_, index) => index + 1);

  return (
    <div className="shell">
      <div className="banner">
        TRAINING MODE · SHARED SANDBOX · PRODUCTION CLASS RECORDS ARE NOT CHANGED
      </div>

      <header>
        <div>
          <div className="eyebrow">Living Teacher Planner · Training</div>
          <h1>{session?.session_name ?? 'Training Session'}</h1>
        </div>
        <div className="actions">
          <button onClick={() => router.push(`/training/session/${sessionId}/school`)}>
            School Training View
          </button>
          <button onClick={() => router.push('/training')}>Training Center</button>
          <button className="danger" disabled={busy} onClick={leaveAndLogout}>
            Leave &amp; Log Out
          </button>
        </div>
      </header>

      <main>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        <div className="top-grid">
          <section className="panel control-panel">
            <div className="eyebrow">Teacher Training Dashboard</div>
            <div className="section-title-row">
              <div>
                <h2>{sectionLabel(selectedSection)}</h2>
                <p>{selectedCourse?.course_code ?? 'Course'} · simulated practice only</p>
              </div>
              <label className="section-picker">
                Training Section
                <select
                  value={selectedState?.source_section_id ?? ''}
                  onChange={(event) => setSectionId(event.target.value)}
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
              </label>
            </div>

            <div className="metrics">
              <Metric label="Course" value={selectedCourse?.course_code ?? '—'} />
              <Metric label="Current Day" value={`Day ${currentDay}`} />
              <Metric
                label="Status"
                value={
                  activeDelivery
                    ? 'In Progress'
                    : selectedState?.manual_hold
                    ? 'On Hold'
                    : 'Ready'
                }
              />
              <Metric
                label="Timer"
                value={clock(selectedState?.active_timer_started_at ?? null)}
              />
              <Metric label="Connected" value={String(connectedCount)} />
            </div>

            <div className="controls">
              <button
                className="primary"
                disabled={
                  busy ||
                  !selectedState ||
                  Boolean(activeDelivery) ||
                  Boolean(selectedState.manual_hold)
                }
                onClick={startDay}
              >
                Start Current Training Day
              </button>
              <button
                disabled={busy || !activeDelivery || !selectedState}
                onClick={completeDay}
              >
                Complete Current Training Day
              </button>
            </div>

            {selectedState?.manual_hold && (
              <div className="hold">
                Training hold: {selectedState.hold_reason ?? 'No reason recorded'}
              </div>
            )}

            <div className="completion-fields">
              <label>
                Daily Comment
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Training-only delivery comment"
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={followUp}
                  onChange={(event) => setFollowUp(event.target.checked)}
                />
                Follow-up needed
              </label>
              {followUp && (
                <label>
                  Follow-up Notes
                  <input
                    value={followNotes}
                    onChange={(event) => setFollowNotes(event.target.value)}
                    placeholder="What should be revisited?"
                  />
                </label>
              )}
            </div>
          </section>

          <section className="panel participant-panel">
            <div className="eyebrow">Shared Participants</div>
            <h2>Live Training Room</h2>
            <p>Each participant uses their own authorized school account.</p>
            <div className="people">
              {members.map((member) => (
                <div key={member.id}>
                  <span className={member.connected ? 'dot on' : 'dot'} />
                  <strong>
                    {profileMap.get(member.user_id)?.display_name ??
                      `Participant ${member.user_id.slice(0, 8)}`}
                  </strong>
                  <small>{member.school_role.replace(/_/g, ' ')}</small>
                </div>
              ))}
              {members.length === 0 && <div className="empty">No participants connected.</div>}
            </div>
          </section>
        </div>

        <section className="panel guide-panel">
          <div className="guide-head">
            <div>
              <div className="eyebrow">Mapped Section Guide</div>
              <h2>
                {selectedCourse?.course_code ?? 'Course'} · Viewing Day {viewingDay}
              </h2>
              <p>
                Training follows the exact guide mapped to this section, not a generic course guide.
              </p>
            </div>
            <div className="guide-nav">
              <button
                disabled={viewingDay <= 1}
                onClick={() => setViewingDay((day) => Math.max(1, day - 1))}
              >
                Previous
              </button>
              <label>
                Day
                <select
                  value={viewingDay}
                  onChange={(event) => setViewingDay(Number(event.target.value))}
                >
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>Day {day}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={viewingDay >= plannedDays}
                onClick={() =>
                  setViewingDay((day) => Math.min(plannedDays, day + 1))
                }
              >
                Next
              </button>
              {viewingDay !== currentDay && (
                <button className="current" onClick={() => setViewingDay(currentDay)}>
                  Current Day
                </button>
              )}
            </div>
          </div>

          {guideError && <div className="error guide-error">{guideError}</div>}

          {guide && (
            <>
              <div className="guide-title">
                <span>DAY {guide.planner_day_number}</span>
                <h3>{guide.title ?? 'Teacher Guide Day'}</h3>
                {guide.objective && <p>{guide.objective}</p>}
              </div>

              <div className="guide-cards">
                <GuideCard title="Safety Focus" value={guide.safety_focus} />
                <GuideCard title="Opening / Review" value={guide.opening_review} />
                <GuideCard title="Demonstration" value={guide.demonstration} />
                <GuideCard title="Guided Practice" value={guide.guided_practice} />
                <GuideCard title="Independent Practice" value={guide.independent_practice} />
                <GuideCard title="Instructor Checks" value={guide.instructor_checks} />
                <GuideCard title="Assessment" value={guide.assessment} />
                <GuideCard title="Materials & Equipment" value={guide.materials_equipment} />
                <GuideCard title="Application" value={guide.corresponding_application} />
                <GuideCard
                  title="Evidence / Check for Understanding"
                  value={guide.evidence_check_for_understanding}
                />
                <GuideCard title="Coaching Focus" value={guide.coaching_focus} />
                <GuideCard title="If Students Struggle" value={guide.if_students_struggle} />
                <GuideCard title="Keep Momentum" value={guide.keep_momentum} />
                <GuideCard title="Teaching Tips" value={guide.teaching_tips} />
              </div>

              <div className="guide-subsection">
                <div className="subhead">
                  <div>
                    <div className="eyebrow">Pacing</div>
                    <h3>Instructional Segments</h3>
                  </div>
                  <span>{segments.length} segment{segments.length === 1 ? '' : 's'}</span>
                </div>
                <div className="segment-list">
                  {segments.map((segment) => (
                    <article key={segment.id} className="segment">
                      <div className="segment-time">
                        {segment.start_minute !== null && segment.end_minute !== null
                          ? `${segment.start_minute}–${segment.end_minute} min`
                          : `${segment.planned_minutes ?? '—'} min`}
                      </div>
                      <div>
                        <strong>{segment.segment_title ?? `Segment ${segment.sequence_number}`}</strong>
                        {segment.segment_type && <small>{segment.segment_type.replace(/_/g, ' ')}</small>}
                        {segment.instructor_actions && (
                          <p><b>Instructor:</b> {segment.instructor_actions}</p>
                        )}
                        {segment.student_actions && (
                          <p><b>Students:</b> {segment.student_actions}</p>
                        )}
                        {segment.notes && <p><b>Notes:</b> {segment.notes}</p>}
                      </div>
                    </article>
                  ))}
                  {segments.length === 0 && (
                    <div className="empty">No timed segments are attached to this guide day.</div>
                  )}
                </div>
              </div>

              <div className="guide-subsection">
                <div className="subhead">
                  <div>
                    <div className="eyebrow">Materials</div>
                    <h3>Resources</h3>
                  </div>
                  <span>{resources.length} resource{resources.length === 1 ? '' : 's'}</span>
                </div>
                <div className="resource-list">
                  {resources.map((resource) => (
                    <article key={resource.id} className="resource">
                      <div>
                        <strong>{resource.resource_title ?? 'Resource'}</strong>
                        <small>
                          {resource.resource_type ?? 'resource'}
                          {resource.required ? ' · required' : ''}
                        </small>
                        {resource.resource_notes && <p>{resource.resource_notes}</p>}
                      </div>
                      {resource.resource_url && (
                        <a href={resource.resource_url} target="_blank" rel="noreferrer">
                          Open Resource
                        </a>
                      )}
                    </article>
                  ))}
                  {resources.length === 0 && (
                    <div className="empty">No resources are attached to this guide day.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="panel note-panel">
          <div>
            <div className="eyebrow">Training-Only Notes</div>
            <h2>Practice the reflection workflow</h2>
            <p>
              These notes belong only to the temporary training session and do not alter
              production curriculum or live class history.
            </p>
          </div>
          <div className="note-entry">
            <textarea
              value={trainingNote}
              onChange={(event) => setTrainingNote(event.target.value)}
              placeholder={`Training note for Day ${viewingDay}`}
            />
            <button
              className="primary"
              disabled={busy || !trainingNote.trim() || !selectedState}
              onClick={addNote}
            >
              Add Training Note
            </button>
          </div>
        </section>
      </main>

      <style jsx>{`
        .shell { min-height: 100vh; background: #091015; color: #e4e0da; }
        .loading { min-height: 100vh; display: grid; place-items: center; background: #091015; color: #97a2a7; }
        .banner { position: sticky; top: 0; z-index: 30; padding: 9px; text-align: center; background: #774a34; color: #f3e7de; font-size: 10px; font-weight: 900; letter-spacing: .10em; }
        header { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 18px 24px; border-bottom: 1px solid #223239; background: #0c1519; }
        .eyebrow { color: #d8844d; text-transform: uppercase; letter-spacing: .13em; font-size: 9px; font-weight: 900; }
        h1, h2, h3 { margin: 4px 0; color: #eee9e2; }
        h1 { font-size: 23px; } h2 { font-size: 19px; } h3 { font-size: 16px; }
        p { color: #8d9aa0; line-height: 1.5; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        button, a { font: inherit; }
        button { padding: 9px 12px; border: 1px solid #304149; border-radius: 7px; background: #111c21; color: #bcc7ca; font-weight: 750; cursor: pointer; }
        button:hover:not(:disabled) { border-color: #d8844d; color: #efb28a; }
        button:disabled { opacity: .42; cursor: not-allowed; }
        button.primary { border-color: rgba(216,132,77,.62); background: rgba(169,106,72,.12); color: #efad80; }
        button.danger { border-color: rgba(195,109,90,.45); color: #e89482; }
        main { width: min(1420px, calc(100% - 30px)); margin: auto; padding: 20px 0 52px; }
        .top-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .65fr); gap: 14px; }
        .panel { padding: 19px; border: 1px solid #293a41; border-radius: 10px; background: #10191e; margin-bottom: 14px; }
        .section-title-row { display: flex; justify-content: space-between; gap: 20px; align-items: end; margin-top: 5px; }
        .section-title-row p { margin: 2px 0 0; font-size: 11px; }
        label { display: grid; gap: 6px; color: #8d9aa0; font-size: 9px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
        select, input, textarea { width: 100%; padding: 10px 11px; border: 1px solid #304149; border-radius: 7px; background: #0b1418; color: #e9e4de; font: inherit; }
        textarea { min-height: 74px; resize: vertical; }
        select:focus, input:focus, textarea:focus { outline: none; border-color: #4c9fac; box-shadow: 0 0 0 3px rgba(76,159,172,.10); }
        .section-picker { min-width: 290px; }
        .metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 16px 0; }
        .controls { display: flex; gap: 8px; flex-wrap: wrap; }
        .completion-fields { display: grid; gap: 10px; margin-top: 14px; }
        .check { display: flex; align-items: center; gap: 8px; text-transform: none; font-size: 11px; letter-spacing: 0; }
        .check input { width: auto; }
        .hold { margin-top: 12px; padding: 10px 12px; border: 1px solid rgba(216,132,77,.38); border-radius: 7px; background: rgba(169,106,72,.08); color: #e3a57b; font-size: 11px; }
        .people { display: grid; gap: 7px; margin-top: 14px; }
        .people > div { display: grid; grid-template-columns: 12px 1fr; gap: 2px 7px; align-items: center; padding: 10px; border: 1px solid #26373e; border-radius: 7px; background: #0d161a; }
        .people strong { color: #dce1df; font-size: 11px; }
        .people small { grid-column: 2; color: #69777d; font-size: 9px; text-transform: capitalize; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: #536168; }
        .dot.on { background: #76a995; box-shadow: 0 0 10px rgba(118,169,149,.34); }
        .guide-panel { padding: 0; overflow: hidden; }
        .guide-head { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 18px 20px; border-bottom: 1px solid #293a41; background: #0d171b; }
        .guide-head p { margin: 2px 0 0; font-size: 10px; }
        .guide-nav { display: flex; align-items: end; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
        .guide-nav label { min-width: 88px; }
        .guide-nav .current { border-color: rgba(76,159,172,.5); color: #8bc5ce; }
        .guide-error { margin: 16px 20px 0; }
        .guide-title { padding: 22px 20px 18px; border-bottom: 1px solid #26373e; }
        .guide-title > span { color: #d8844d; font-size: 9px; font-weight: 900; letter-spacing: .14em; }
        .guide-title h3 { margin-top: 6px; font-size: 22px; }
        .guide-title p { max-width: 1000px; margin-bottom: 0; }
        .guide-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 16px 20px 20px; }
        .guide-subsection { padding: 18px 20px; border-top: 1px solid #26373e; }
        .subhead { display: flex; justify-content: space-between; gap: 15px; align-items: end; margin-bottom: 12px; }
        .subhead > span { color: #66757b; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }
        .segment-list, .resource-list { display: grid; gap: 8px; }
        .segment { display: grid; grid-template-columns: 105px 1fr; gap: 14px; padding: 13px; border: 1px solid #293a41; border-radius: 8px; background: #0d161a; }
        .segment-time { color: #d49a72; font-size: 10px; font-weight: 850; }
        .segment strong, .resource strong { display: block; color: #dce1df; }
        .segment small, .resource small { display: block; margin-top: 3px; color: #66757b; font-size: 9px; text-transform: capitalize; }
        .segment p, .resource p { margin: 7px 0 0; color: #8d9aa0; font-size: 11px; }
        .segment b { color: #aeb9bd; }
        .resource { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 13px; border: 1px solid #293a41; border-radius: 8px; background: #0d161a; }
        .resource a { flex: 0 0 auto; padding: 8px 10px; border: 1px solid rgba(76,159,172,.45); border-radius: 7px; color: #8bc5ce; text-decoration: none; font-size: 10px; font-weight: 800; }
        .resource a:hover { border-color: #4c9fac; color: #b6e2e8; }
        .note-panel { display: grid; grid-template-columns: minmax(260px, .7fr) minmax(0, 1.3fr); gap: 24px; align-items: center; }
        .note-panel p { margin-bottom: 0; }
        .note-entry { display: grid; gap: 8px; }
        .empty { padding: 18px; text-align: center; color: #66757b; font-size: 11px; }
        .error, .notice { margin-bottom: 12px; padding: 10px 12px; border-radius: 7px; font-size: 11px; line-height: 1.4; }
        .error { border: 1px solid rgba(195,109,90,.42); background: rgba(195,109,90,.08); color: #eca08f; }
        .notice { border: 1px solid rgba(118,169,149,.38); background: rgba(118,169,149,.07); color: #9dc7b7; }
        @media (max-width: 1050px) { .top-grid { grid-template-columns: 1fr; } .participant-panel { order: 2; } .metrics { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 780px) { header, .section-title-row, .guide-head { align-items: flex-start; flex-direction: column; } .actions, .controls, .guide-nav { width: 100%; } .actions button, .controls button { flex: 1; } .section-picker { width: 100%; min-width: 0; } .guide-nav { justify-content: flex-start; } .guide-cards { grid-template-columns: 1fr; } .note-panel { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { main { width: min(100% - 18px, 1420px); } header { padding: 15px; } .metrics { grid-template-columns: 1fr 1fr; } .segment { grid-template-columns: 1fr; } .resource { align-items: flex-start; flex-direction: column; } .resource a { width: 100%; text-align: center; } .guide-nav button, .guide-nav label { flex: 1; min-width: 100px; } }
      `}</style>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 11,
        border: '1px solid #293a41',
        borderRadius: 8,
        background: '#0d161a',
      }}
    >
      <span
        style={{
          display: 'block',
          color: '#66757b',
          fontSize: 8,
          textTransform: 'uppercase',
          fontWeight: 850,
          letterSpacing: '.07em',
        }}
      >
        {label}
      </span>
      <strong
        style={{
          display: 'block',
          color: '#eee9e2',
          fontSize: 18,
          marginTop: 4,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function GuideCard({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <article
      style={{
        padding: 14,
        border: '1px solid #293a41',
        borderRadius: 8,
        background: '#0d161a',
      }}
    >
      <div
        style={{
          color: '#d8844d',
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: '.10em',
          textTransform: 'uppercase',
          marginBottom: 7,
        }}
      >
        {title}
      </div>
      <div style={{ color: '#aeb8bc', fontSize: 11, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
        {value}
      </div>
    </article>
  );
}
