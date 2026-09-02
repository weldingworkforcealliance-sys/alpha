'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type TeachingSection = {
  school_id: string;
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  current_planner_day_number: number | null;
};

type PlannerDay = {
  id: string;
  planner_day_number: number;
  scheduled_date: string;
  title: string | null;
  status: string | null;
  guide_day_id: string | null;
};

type GuideDay = {
  id: string;
  planner_day_number: number;
  title: string | null;
  objective: string | null;
};

type GuideSegment = {
  id: string;
  sequence_number: number;
  segment_title: string | null;
  instructor_actions: string | null;
  planned_minutes: number;
  start_minute: number | null;
  end_minute: number | null;
};

type MathLesson = {
  id: string;
  math_day_number: number;
  title: string;
  planned_minutes: number;
};

type MathSegment = {
  id: string;
  sequence_number: number;
  activity: string;
  planned_minutes: number;
  start_minute: number | null;
  end_minute: number | null;
};

type AgendaNote = {
  id: string;
  note_text: string;
  visibility: string;
  guide_segment_id: string | null;
  math_segment_id: string | null;
};

type SlotKind = 'guide' | 'math';

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeLabel(
  startMinute: number | null,
  endMinute: number | null,
  plannedMinutes: number
) {
  if (startMinute !== null && endMinute !== null) {
    return `${startMinute}–${endMinute} min`;
  }
  return `${plannedMinutes} min`;
}

function slotKey(kind: SlotKind, id: string) {
  return `${kind}:${id}`;
}

export default function AgendaPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [canAddNotes, setCanAddNotes] = useState(false);

  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [plannerDays, setPlannerDays] = useState<PlannerDay[]>([]);
  const [selectedPlannerDayId, setSelectedPlannerDayId] = useState('');

  const [guideDay, setGuideDay] = useState<GuideDay | null>(null);
  const [guideSegments, setGuideSegments] = useState<GuideSegment[]>([]);
  const [mathLesson, setMathLesson] = useState<MathLesson | null>(null);
  const [mathSegments, setMathSegments] = useState<MathSegment[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteSavingKey, setNoteSavingKey] = useState<string | null>(null);

  const [editKey, setEditKey] = useState<string | null>(null);
  const [editActivity, setEditActivity] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [ownerSaving, setOwnerSaving] = useState(false);

  const selectedSection = useMemo(
    () => sections.find((section) => section.section_id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );

  const selectedPlannerDay = useMemo(
    () => plannerDays.find((day) => day.id === selectedPlannerDayId) ?? null,
    [plannerDays, selectedPlannerDayId]
  );

  const loadPlannerDays = useCallback(
    async (section: TeachingSection) => {
      setError('');
      const { data, error: daysError } = await supabase
        .from('planner_days')
        .select('id, planner_day_number, scheduled_date, title, status, guide_day_id')
        .eq('section_id', section.section_id)
        .order('planner_day_number');

      if (daysError) {
        setError(`Failed to load planner days: ${daysError.message}`);
        setPlannerDays([]);
        setSelectedPlannerDayId('');
        return;
      }

      const days = (data ?? []) as PlannerDay[];
      setPlannerDays(days);
      const currentDay = days.find(
        (day) => day.planner_day_number === section.current_planner_day_number
      );
      setSelectedPlannerDayId(currentDay?.id ?? days[0]?.id ?? '');

      const { data: assigned, error: assignedError } = await supabase.rpc(
        'is_section_instructor',
        {
          check_school_id: section.school_id,
          check_section_id: section.section_id,
        }
      );

      if (assignedError) {
        console.error('Instructor access check failed:', assignedError);
        setCanAddNotes(false);
      } else {
        setCanAddNotes(Boolean(assigned));
      }
    },
    [supabase]
  );

  const loadDay = useCallback(
    async (section: TeachingSection, plannerDay: PlannerDay) => {
      setDayLoading(true);
      setError('');
      setMessage('');
      setGuideDay(null);
      setGuideSegments([]);
      setMathLesson(null);
      setMathSegments([]);
      setNoteDrafts({});
      setEditKey(null);

      try {
        if (!plannerDay.guide_day_id) {
          setError('This planner day does not have a teacher-guide day linked yet.');
          return;
        }

        const [dayResult, segmentsResult, mathResult, notesResult] = await Promise.all([
          supabase
            .from('course_guide_days')
            .select('id, planner_day_number, title, objective')
            .eq('id', plannerDay.guide_day_id)
            .maybeSingle(),
          supabase
            .from('course_guide_day_segments')
            .select(
              'id, sequence_number, segment_title, instructor_actions, planned_minutes, start_minute, end_minute'
            )
            .eq('guide_day_id', plannerDay.guide_day_id)
            .order('sequence_number'),
          supabase
            .from('course_guide_day_math')
            .select('id, math_day_number, title, planned_minutes')
            .eq('guide_day_id', plannerDay.guide_day_id)
            .maybeSingle(),
          currentUserId
            ? supabase
                .from('instructor_notes')
                .select(
                  'id, note_text, visibility, guide_segment_id, math_segment_id'
                )
                .eq('section_id', section.section_id)
                .eq('planner_day_id', plannerDay.id)
                .eq('instructor_id', currentUserId)
                .eq('note_type', 'agenda_slot')
            : Promise.resolve({ data: [], error: null }),
        ]);

        const loadError =
          dayResult.error || segmentsResult.error || mathResult.error || notesResult.error;
        if (loadError) throw loadError;

        setGuideDay((dayResult.data ?? null) as GuideDay | null);
        setGuideSegments((segmentsResult.data ?? []) as GuideSegment[]);

        const loadedMathLesson = (mathResult.data ?? null) as MathLesson | null;
        setMathLesson(loadedMathLesson);

        if (loadedMathLesson) {
          const { data: mathData, error: mathError } = await supabase
            .from('course_guide_day_math_segments')
            .select(
              'id, sequence_number, activity, planned_minutes, start_minute, end_minute'
            )
            .eq('math_lesson_id', loadedMathLesson.id)
            .order('sequence_number');
          if (mathError) throw mathError;
          setMathSegments((mathData ?? []) as MathSegment[]);
        }

        const drafts: Record<string, string> = {};
        ((notesResult.data ?? []) as AgendaNote[]).forEach((note) => {
          if (note.guide_segment_id) {
            drafts[slotKey('guide', note.guide_segment_id)] = note.note_text;
          }
          if (note.math_segment_id) {
            drafts[slotKey('math', note.math_segment_id)] = note.note_text;
          }
        });
        setNoteDrafts(drafts);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDayLoading(false);
      }
    },
    [currentUserId, supabase]
  );

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        if (!authData.session) {
          router.push('/login');
          return;
        }

        setCurrentUserId(authData.session.user.id);

        const [ownerResult, sectionsResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase.from('current_teaching_sections').select('*'),
        ]);

        if (ownerResult.error) throw ownerResult.error;
        if (sectionsResult.error) throw sectionsResult.error;

        setIsPlatformOwner(Boolean(ownerResult.data));
        const loadedSections = (sectionsResult.data ?? []) as TeachingSection[];
        setSections(loadedSections);
        setSelectedSectionId(loadedSections[0]?.section_id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router, supabase]);

  useEffect(() => {
    if (selectedSection) {
      loadPlannerDays(selectedSection);
    } else {
      setPlannerDays([]);
      setSelectedPlannerDayId('');
      setCanAddNotes(false);
    }
  }, [selectedSection, loadPlannerDays]);

  useEffect(() => {
    if (selectedSection && selectedPlannerDay) {
      loadDay(selectedSection, selectedPlannerDay);
    }
  }, [selectedSection, selectedPlannerDay, loadDay]);

  const refreshCurrentDay = async () => {
    if (selectedSection && selectedPlannerDay) {
      await loadDay(selectedSection, selectedPlannerDay);
    }
  };

  const beginOwnerEdit = (
    kind: SlotKind,
    segment: GuideSegment | MathSegment
  ) => {
    const activity =
      kind === 'guide'
        ? (segment as GuideSegment).instructor_actions ||
          (segment as GuideSegment).segment_title ||
          ''
        : (segment as MathSegment).activity;
    setEditKey(slotKey(kind, segment.id));
    setEditActivity(activity);
    setEditMinutes(String(segment.planned_minutes));
    setMessage('');
    setError('');
  };

  const saveOwnerEdit = async (kind: SlotKind, segmentId: string) => {
    const minutes = Number(editMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setError('Minutes must be a whole number greater than zero.');
      return;
    }

    setOwnerSaving(true);
    setError('');
    setMessage('');
    try {
      const functionName =
        kind === 'guide'
          ? 'owner_update_guide_agenda_slot'
          : 'owner_update_math_agenda_slot';
      const { error: updateError } = await supabase.rpc(functionName, {
        p_segment_id: segmentId,
        p_activity: editActivity,
        p_planned_minutes: minutes,
      });
      if (updateError) throw updateError;
      setEditKey(null);
      setMessage('Agenda slot updated. Times were recalculated automatically.');
      await refreshCurrentDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOwnerSaving(false);
    }
  };

  const moveOwnerSlot = async (
    kind: SlotKind,
    segmentId: string,
    direction: -1 | 1
  ) => {
    setOwnerSaving(true);
    setError('');
    setMessage('');
    try {
      const functionName =
        kind === 'guide'
          ? 'owner_move_guide_agenda_slot'
          : 'owner_move_math_agenda_slot';
      const { error: moveError } = await supabase.rpc(functionName, {
        p_segment_id: segmentId,
        p_direction: direction,
      });
      if (moveError) throw moveError;
      setMessage('Agenda order updated.');
      await refreshCurrentDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOwnerSaving(false);
    }
  };

  const saveNote = async (kind: SlotKind, segmentId: string) => {
    if (!selectedSection || !selectedPlannerDay) return;
    const key = slotKey(kind, segmentId);
    setNoteSavingKey(key);
    setError('');
    setMessage('');
    try {
      const { error: noteError } = await supabase.rpc('save_my_agenda_slot_note', {
        p_section_id: selectedSection.section_id,
        p_planner_day_id: selectedPlannerDay.id,
        p_note_text: noteDrafts[key] ?? '',
        p_guide_segment_id: kind === 'guide' ? segmentId : null,
        p_math_segment_id: kind === 'math' ? segmentId : null,
        p_visibility: 'shared',
      });
      if (noteError) throw noteError;
      setMessage(
        (noteDrafts[key] ?? '').trim()
          ? 'Instructor note saved.'
          : 'Instructor note cleared.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNoteSavingKey(null);
    }
  };

  const renderSlot = (
    kind: SlotKind,
    segment: GuideSegment | MathSegment,
    index: number,
    total: number
  ) => {
    const key = slotKey(kind, segment.id);
    const guideSegment = kind === 'guide' ? (segment as GuideSegment) : null;
    const mathSegment = kind === 'math' ? (segment as MathSegment) : null;
    const activity = guideSegment
      ? guideSegment.instructor_actions || guideSegment.segment_title || 'Activity'
      : mathSegment?.activity || 'Activity';
    const isEditing = editKey === key;

    return (
      <article className="slot" key={key}>
        <div className="slot-main">
          <div className="time-box">
            <strong>
              {timeLabel(
                segment.start_minute,
                segment.end_minute,
                segment.planned_minutes
              )}
            </strong>
            <span>{segment.planned_minutes} min</span>
          </div>

          <div className="slot-content">
            {isEditing ? (
              <div className="edit-grid">
                <label>
                  Activity / instructor direction
                  <textarea
                    value={editActivity}
                    onChange={(event) => setEditActivity(event.target.value)}
                    rows={3}
                  />
                </label>
                <label className="minutes-field">
                  Minutes
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={editMinutes}
                    onChange={(event) => setEditMinutes(event.target.value)}
                  />
                </label>
                <div className="edit-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={ownerSaving}
                    onClick={() => saveOwnerEdit(kind, segment.id)}
                  >
                    {ownerSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={ownerSaving}
                    onClick={() => setEditKey(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="activity-text">{activity}</p>
            )}
          </div>

          {isPlatformOwner && !isEditing && (
            <div className="owner-controls" aria-label="Platform Owner agenda controls">
              <button
                type="button"
                title="Move up"
                disabled={ownerSaving || index === 0}
                onClick={() => moveOwnerSlot(kind, segment.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                title="Move down"
                disabled={ownerSaving || index === total - 1}
                onClick={() => moveOwnerSlot(kind, segment.id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="edit-button"
                disabled={ownerSaving}
                onClick={() => beginOwnerEdit(kind, segment)}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {canAddNotes && (
          <div className="note-area">
            <label>
              Your note for this time slot
              <textarea
                rows={2}
                placeholder="What happened here? Add pacing, student response, equipment, safety, or follow-up notes."
                value={noteDrafts[key] ?? ''}
                onChange={(event) =>
                  setNoteDrafts((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="note-save"
              disabled={noteSavingKey === key}
              onClick={() => saveNote(kind, segment.id)}
            >
              {noteSavingKey === key ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        )}
      </article>
    );
  };

  if (loading) {
    return (
      <main className="workspace-shell">
        <div className="panel">Loading agenda workspace…</div>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <div className="eyebrow">Living Teacher Planner</div>
            <h1>Daily Agenda Workspace</h1>
            <p>
              Platform Owner controls can edit timing and sequence. Instructor notes
              stay attached to the exact class, day, and time slot.
            </p>
          </div>
          <button type="button" className="back-button" onClick={() => router.push('/dashboard')}>
            Back to Planner
          </button>
        </header>

        <div className="protection-banner">
          <strong>Protected boundary:</strong> this workspace changes instructional
          implementation only. Approved curriculum and course outcomes remain locked.
        </div>

        {isPlatformOwner && (
          <div className="owner-banner">
            Platform Owner controls are active. Agenda edits update the guide-day
            implementation agenda wherever that guide day is used.
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}

        <section className="selector-panel">
          <label>
            Class
            <select
              value={selectedSectionId}
              onChange={(event) => setSelectedSectionId(event.target.value)}
            >
              {sections.map((section) => (
                <option key={section.section_id} value={section.section_id}>
                  {section.course_code || section.course_name || 'Course'} ·{' '}
                  {section.cohort_name || section.section_name || section.section_code || 'Section'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Planner Day
            <select
              value={selectedPlannerDayId}
              onChange={(event) => setSelectedPlannerDayId(event.target.value)}
              disabled={plannerDays.length === 0}
            >
              {plannerDays.map((day) => (
                <option key={day.id} value={day.id}>
                  Day {day.planner_day_number} · {dateLabel(day.scheduled_date)}
                  {day.title ? ` · ${day.title}` : ''}
                </option>
              ))}
            </select>
          </label>
        </section>

        {sections.length === 0 ? (
          <div className="panel">No teaching sections are available to this account.</div>
        ) : dayLoading ? (
          <div className="panel">Loading daily agenda…</div>
        ) : selectedPlannerDay && guideDay ? (
          <>
            <section className="day-heading">
              <div>
                <div className="eyebrow">DAY {guideDay.planner_day_number}</div>
                <h2>{guideDay.title || selectedPlannerDay.title || 'Daily Agenda'}</h2>
                <p>{dateLabel(selectedPlannerDay.scheduled_date)}</p>
              </div>
              {guideDay.objective && (
                <div className="objective-box">
                  <strong>Daily Objective</strong>
                  <span>{guideDay.objective}</span>
                </div>
              )}
            </section>

            <section className="agenda-section">
              <div className="section-title-row">
                <div>
                  <div className="eyebrow">{mathLesson ? 'Section 1 · Daily Agenda' : 'Daily Agenda'}</div>
                  <h3>{selectedSection?.course_code || 'Course'} Instruction</h3>
                </div>
                <strong>{guideSegments.reduce((sum, item) => sum + item.planned_minutes, 0)} min</strong>
              </div>
              <div className="slot-list">
                {guideSegments.map((segment, index) =>
                  renderSlot('guide', segment, index, guideSegments.length)
                )}
              </div>
            </section>

            {mathLesson && (
              <section className="agenda-section">
                <div className="section-title-row">
                  <div>
                    <div className="eyebrow">Section 2 · Welding Math</div>
                    <h3>
                      Day {mathLesson.math_day_number}: {mathLesson.title}
                    </h3>
                  </div>
                  <strong>{mathSegments.reduce((sum, item) => sum + item.planned_minutes, 0)} min</strong>
                </div>
                <div className="slot-list">
                  {mathSegments.map((segment, index) =>
                    renderSlot('math', segment, index, mathSegments.length)
                  )}
                </div>
              </section>
            )}

            {!canAddNotes && (
              <div className="note-access-message">
                Time-slot notes are available to instructors actively assigned to this section.
              </div>
            )}
          </>
        ) : null}
      </div>

      <style jsx>{`
        .workspace-shell {
          min-height: 100vh;
          padding: 24px;
          background: #080808;
          color: #e8e8e8;
        }

        .workspace {
          width: min(1180px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .workspace-header,
        .day-heading,
        .section-title-row,
        .slot-main,
        .note-area,
        .edit-actions {
          display: flex;
          align-items: center;
        }

        .workspace-header,
        .day-heading,
        .section-title-row {
          justify-content: space-between;
          gap: 20px;
        }

        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 8px;
          font-size: clamp(28px, 4vw, 40px);
        }

        h2,
        h3 {
          margin-bottom: 5px;
        }

        .workspace-header p,
        .day-heading p {
          margin-bottom: 0;
          color: #9b9b9b;
          line-height: 1.5;
        }

        .eyebrow {
          color: #00ff88;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 11px;
          font-weight: 900;
        }

        .back-button,
        .primary,
        .secondary,
        .owner-controls button,
        .note-save {
          min-height: 42px;
          border-radius: 7px;
          font-weight: 800;
          cursor: pointer;
        }

        .back-button,
        .secondary,
        .owner-controls button {
          border: 1px solid #3a3a3a;
          background: #151515;
          color: #ddd;
          padding: 9px 13px;
        }

        .primary,
        .note-save,
        .owner-controls .edit-button {
          border: 1px solid rgba(0, 255, 136, 0.55);
          background: rgba(0, 255, 136, 0.09);
          color: #00ff88;
          padding: 9px 13px;
        }

        button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .protection-banner,
        .owner-banner,
        .error-box,
        .success-box,
        .note-access-message,
        .panel {
          padding: 13px 15px;
          border-radius: 9px;
          line-height: 1.45;
        }

        .protection-banner {
          border: 1px solid #343434;
          background: #121212;
          color: #bcbcbc;
        }

        .owner-banner,
        .success-box {
          border: 1px solid rgba(0, 255, 136, 0.35);
          background: rgba(0, 255, 136, 0.06);
          color: #9affc9;
        }

        .error-box {
          border: 1px solid rgba(255, 90, 90, 0.4);
          background: rgba(255, 90, 90, 0.08);
          color: #ffaaaa;
        }

        .selector-panel {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
          border: 1px solid #272727;
          border-radius: 10px;
          background: #111;
        }

        label {
          display: grid;
          gap: 7px;
          color: #aaa;
          font-size: 12px;
          font-weight: 800;
        }

        select,
        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 7px;
          background: #0b0b0b;
          color: #eee;
          font: inherit;
          font-size: 16px;
          padding: 11px;
        }

        textarea {
          resize: vertical;
          line-height: 1.45;
        }

        .day-heading {
          padding: 18px;
          border: 1px solid #2b2b2b;
          border-radius: 10px;
          background: #121212;
        }

        .objective-box {
          max-width: 520px;
          display: grid;
          gap: 5px;
          color: #bbb;
          line-height: 1.45;
        }

        .objective-box strong {
          color: #fff;
        }

        .agenda-section {
          border: 1px solid #2a2a2a;
          border-radius: 11px;
          background: #111;
          overflow: hidden;
        }

        .section-title-row {
          padding: 17px 18px;
          border-bottom: 1px solid #272727;
          background: #151515;
        }

        .section-title-row h3 {
          margin: 3px 0 0;
        }

        .section-title-row > strong {
          color: #00ff88;
          white-space: nowrap;
        }

        .slot-list {
          display: grid;
        }

        .slot {
          border-bottom: 1px solid #242424;
        }

        .slot:last-child {
          border-bottom: 0;
        }

        .slot-main {
          gap: 14px;
          align-items: stretch;
          padding: 14px 16px;
        }

        .time-box {
          width: 112px;
          flex: 0 0 112px;
          display: grid;
          align-content: center;
          gap: 4px;
          color: #d9d9d9;
        }

        .time-box span {
          color: #737373;
          font-size: 12px;
        }

        .slot-content {
          flex: 1;
          min-width: 0;
          display: grid;
          align-content: center;
        }

        .activity-text {
          margin: 0;
          line-height: 1.5;
          color: #ddd;
          white-space: pre-wrap;
        }

        .owner-controls {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .owner-controls button {
          min-width: 44px;
        }

        .edit-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 110px;
          gap: 12px;
        }

        .edit-grid > label:first-child {
          grid-row: span 2;
        }

        .minutes-field input {
          text-align: center;
        }

        .edit-actions {
          gap: 8px;
          align-self: end;
        }

        .note-area {
          gap: 10px;
          align-items: end;
          padding: 12px 16px 14px 142px;
          background: #0c0c0c;
          border-top: 1px dashed #292929;
        }

        .note-area label {
          flex: 1;
          min-width: 0;
        }

        .note-save {
          flex: 0 0 auto;
        }

        .note-access-message,
        .panel {
          border: 1px solid #2c2c2c;
          background: #111;
          color: #999;
        }

        @media (max-width: 760px) {
          .workspace-shell {
            padding: 14px;
          }

          .workspace-header,
          .day-heading,
          .section-title-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .selector-panel {
            grid-template-columns: 1fr;
          }

          .slot-main {
            flex-wrap: wrap;
          }

          .time-box {
            width: 100%;
            flex-basis: 100%;
            grid-template-columns: auto auto;
            justify-content: space-between;
          }

          .owner-controls {
            width: 100%;
          }

          .edit-grid {
            grid-template-columns: 1fr;
          }

          .edit-grid > label:first-child {
            grid-row: auto;
          }

          .note-area {
            padding-left: 16px;
            align-items: stretch;
            flex-direction: column;
          }

          .note-save,
          .back-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
