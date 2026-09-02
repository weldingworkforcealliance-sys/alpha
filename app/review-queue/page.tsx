'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type ReviewMode = 'school' | 'owner';

type School = { id: string; name: string };
type Membership = { school_id: string; role: string; status: string };
type Profile = { id: string; display_name: string | null; email: string | null };
type Section = { id: string; section_name: string | null; section_code: string | null };
type Course = { id: string; course_code: string | null; course_name: string | null };
type PlannerDay = {
  id: string;
  planner_day_number: number;
  scheduled_date: string | null;
  title: string | null;
};
type AgendaNote = {
  id: string;
  school_id: string;
  section_id: string;
  planner_day_id: string;
  instructor_id: string;
  note_text: string;
  guide_segment_id: string | null;
  math_segment_id: string | null;
  created_at: string;
};
type GuideSegment = {
  id: string;
  instructor_actions: string | null;
  segment_title: string | null;
  planned_minutes: number;
  start_minute: number | null;
  end_minute: number | null;
};
type MathSegment = {
  id: string;
  activity: string;
  planned_minutes: number;
  start_minute: number | null;
  end_minute: number | null;
};
type AgendaReview = {
  id: string;
  school_id: string;
  course_id: string;
  planner_day_number: number;
  source_note_id: string;
  source_section_id: string;
  slot_kind: 'guide' | 'math';
  original_activity: string;
  original_minutes: number;
  proposed_activity: string | null;
  proposed_minutes: number | null;
  school_decision: 'approved' | 'rejected' | 'formal_curriculum_review';
  school_review_notes: string | null;
  school_reviewed_by: string;
  school_reviewed_at: string;
  owner_status: string;
};

type SchoolQueueItem = {
  note: AgendaNote;
  instructor: Profile | null;
  section: Section | null;
  plannerDay: PlannerDay | null;
  currentActivity: string;
  currentMinutes: number;
  timeLabel: string;
};

type ReviewDraft = {
  activity: string;
  minutes: string;
  notes: string;
};

function personLabel(profile: Profile | null | undefined) {
  return profile?.display_name || profile?.email || 'Instructor';
}

function dateLabel(value: string | null) {
  if (!value) return 'Date unavailable';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeRange(start: number | null, end: number | null, minutes: number) {
  if (start !== null && end !== null) return `${start}–${end} min`;
  return `${minutes} min`;
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [mode, setMode] = useState<ReviewMode>('school');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolQueue, setSchoolQueue] = useState<SchoolQueueItem[]>([]);
  const [ownerQueue, setOwnerQueue] = useState<AgendaReview[]>([]);
  const [ownerNotes, setOwnerNotes] = useState<Record<string, AgendaNote>>({});
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, Profile>>({});
  const [ownerSchools, setOwnerSchools] = useState<Record<string, School>>({});
  const [ownerSections, setOwnerSections] = useState<Record<string, Section>>({});
  const [ownerCourses, setOwnerCourses] = useState<Record<string, Course>>({});
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [ownerDecisionNotes, setOwnerDecisionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) {
          router.push('/login');
          return;
        }

        const [ownerResult, membershipResult, schoolsResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
          supabase.from('schools').select('id,name').order('name'),
        ]);

        if (ownerResult.error) throw ownerResult.error;
        if (membershipResult.error) throw membershipResult.error;
        if (schoolsResult.error) throw schoolsResult.error;

        const owner = Boolean(ownerResult.data);
        const memberships = (membershipResult.data ?? []) as Membership[];
        const allSchools = (schoolsResult.data ?? []) as School[];
        const managerSchoolIds = new Set(
          memberships
            .filter((membership) =>
              ['school_admin', 'program_lead'].includes(membership.role)
            )
            .map((membership) => membership.school_id)
        );

        const allowedSchools = owner
          ? allSchools
          : allSchools.filter((school) => managerSchoolIds.has(school.id));

        if (!owner && allowedSchools.length === 0) {
          setError('School administrator or Platform Owner access is required.');
          return;
        }

        setIsOwner(owner);
        setSchools(allowedSchools);
        setSelectedSchoolId(allowedSchools[0]?.id ?? '');
        setMode('school');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router, supabase]);

  const loadSchoolQueue = useCallback(async () => {
    if (!selectedSchoolId) return;
    setQueueLoading(true);
    setError('');

    try {
      const [notesResult, reviewedResult] = await Promise.all([
        supabase
          .from('instructor_notes')
          .select('id,school_id,section_id,planner_day_id,instructor_id,note_text,guide_segment_id,math_segment_id,created_at')
          .eq('school_id', selectedSchoolId)
          .eq('note_type', 'agenda_slot')
          .eq('visibility', 'shared')
          .order('created_at', { ascending: false }),
        supabase
          .from('agenda_change_reviews')
          .select('source_note_id')
          .eq('school_id', selectedSchoolId),
      ]);

      if (notesResult.error) throw notesResult.error;
      if (reviewedResult.error) throw reviewedResult.error;

      const reviewedIds = new Set(
        (reviewedResult.data ?? []).map((row: { source_note_id: string }) => row.source_note_id)
      );
      const notes = ((notesResult.data ?? []) as AgendaNote[]).filter(
        (note) => !reviewedIds.has(note.id)
      );

      if (notes.length === 0) {
        setSchoolQueue([]);
        setDrafts({});
        return;
      }

      const instructorIds = Array.from(new Set(notes.map((note) => note.instructor_id)));
      const sectionIds = Array.from(new Set(notes.map((note) => note.section_id)));
      const plannerDayIds = Array.from(new Set(notes.map((note) => note.planner_day_id)));
      const guideIds = notes.map((note) => note.guide_segment_id).filter((id): id is string => Boolean(id));
      const mathIds = notes.map((note) => note.math_segment_id).filter((id): id is string => Boolean(id));

      const [profilesResult, sectionsResult, daysResult, guideResult, mathResult] = await Promise.all([
        supabase.from('profiles').select('id,display_name,email').in('id', instructorIds),
        supabase.from('sections').select('id,section_name,section_code').in('id', sectionIds),
        supabase.from('planner_days').select('id,planner_day_number,scheduled_date,title').in('id', plannerDayIds),
        guideIds.length
          ? supabase
              .from('course_guide_day_segments')
              .select('id,instructor_actions,segment_title,planned_minutes,start_minute,end_minute')
              .in('id', guideIds)
          : Promise.resolve({ data: [], error: null }),
        mathIds.length
          ? supabase
              .from('course_guide_day_math_segments')
              .select('id,activity,planned_minutes,start_minute,end_minute')
              .in('id', mathIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError = [
        profilesResult.error,
        sectionsResult.error,
        daysResult.error,
        guideResult.error,
        mathResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const profileMap = new Map(((profilesResult.data ?? []) as Profile[]).map((p) => [p.id, p]));
      const sectionMap = new Map(((sectionsResult.data ?? []) as Section[]).map((s) => [s.id, s]));
      const dayMap = new Map(((daysResult.data ?? []) as PlannerDay[]).map((d) => [d.id, d]));
      const guideMap = new Map(((guideResult.data ?? []) as GuideSegment[]).map((s) => [s.id, s]));
      const mathMap = new Map(((mathResult.data ?? []) as MathSegment[]).map((s) => [s.id, s]));

      const items: SchoolQueueItem[] = notes.map((note) => {
        const guide = note.guide_segment_id ? guideMap.get(note.guide_segment_id) : null;
        const math = note.math_segment_id ? mathMap.get(note.math_segment_id) : null;
        const currentActivity = guide
          ? guide.instructor_actions || guide.segment_title || 'Activity'
          : math?.activity || 'Activity';
        const currentMinutes = guide?.planned_minutes ?? math?.planned_minutes ?? 1;
        const start = guide?.start_minute ?? math?.start_minute ?? null;
        const end = guide?.end_minute ?? math?.end_minute ?? null;

        return {
          note,
          instructor: profileMap.get(note.instructor_id) ?? null,
          section: sectionMap.get(note.section_id) ?? null,
          plannerDay: dayMap.get(note.planner_day_id) ?? null,
          currentActivity,
          currentMinutes,
          timeLabel: timeRange(start, end, currentMinutes),
        };
      });

      const nextDrafts: Record<string, ReviewDraft> = {};
      items.forEach((item) => {
        nextDrafts[item.note.id] = {
          activity: item.currentActivity,
          minutes: String(item.currentMinutes),
          notes: '',
        };
      });

      setSchoolQueue(items);
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueueLoading(false);
    }
  }, [selectedSchoolId, supabase]);

  const loadOwnerQueue = useCallback(async () => {
    if (!isOwner) return;
    setQueueLoading(true);
    setError('');

    try {
      const { data, error: reviewError } = await supabase
        .from('agenda_change_reviews')
        .select('id,school_id,course_id,planner_day_number,source_note_id,source_section_id,slot_kind,original_activity,original_minutes,proposed_activity,proposed_minutes,school_decision,school_review_notes,school_reviewed_by,school_reviewed_at,owner_status')
        .in('owner_status', ['pending', 'pending_formal'])
        .order('school_reviewed_at', { ascending: false });

      if (reviewError) throw reviewError;
      const reviews = (data ?? []) as AgendaReview[];
      setOwnerQueue(reviews);

      if (reviews.length === 0) {
        setOwnerNotes({});
        setOwnerProfiles({});
        setOwnerSchools({});
        setOwnerSections({});
        setOwnerCourses({});
        return;
      }

      const noteIds = Array.from(new Set(reviews.map((review) => review.source_note_id)));
      const schoolIds = Array.from(new Set(reviews.map((review) => review.school_id)));
      const sectionIds = Array.from(new Set(reviews.map((review) => review.source_section_id)));
      const courseIds = Array.from(new Set(reviews.map((review) => review.course_id)));
      const reviewerIds = Array.from(new Set(reviews.map((review) => review.school_reviewed_by)));

      const [notesResult, schoolsResult, sectionsResult, coursesResult] = await Promise.all([
        supabase
          .from('instructor_notes')
          .select('id,school_id,section_id,planner_day_id,instructor_id,note_text,guide_segment_id,math_segment_id,created_at')
          .in('id', noteIds),
        supabase.from('schools').select('id,name').in('id', schoolIds),
        supabase.from('sections').select('id,section_name,section_code').in('id', sectionIds),
        supabase.from('courses').select('id,course_code,course_name').in('id', courseIds),
      ]);

      const firstError = [
        notesResult.error,
        schoolsResult.error,
        sectionsResult.error,
        coursesResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const notes = (notesResult.data ?? []) as AgendaNote[];
      const instructorIds = notes.map((note) => note.instructor_id);
      const profileIds = Array.from(new Set([...reviewerIds, ...instructorIds]));
      const profilesResult = await supabase
        .from('profiles')
        .select('id,display_name,email')
        .in('id', profileIds);
      if (profilesResult.error) throw profilesResult.error;

      setOwnerNotes(Object.fromEntries(notes.map((note) => [note.id, note])));
      setOwnerProfiles(
        Object.fromEntries(((profilesResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]))
      );
      setOwnerSchools(
        Object.fromEntries(((schoolsResult.data ?? []) as School[]).map((school) => [school.id, school]))
      );
      setOwnerSections(
        Object.fromEntries(((sectionsResult.data ?? []) as Section[]).map((section) => [section.id, section]))
      );
      setOwnerCourses(
        Object.fromEntries(((coursesResult.data ?? []) as Course[]).map((course) => [course.id, course]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueueLoading(false);
    }
  }, [isOwner, supabase]);

  useEffect(() => {
    if (!loading && mode === 'school' && selectedSchoolId) loadSchoolQueue();
  }, [loading, mode, selectedSchoolId, loadSchoolQueue]);

  useEffect(() => {
    if (!loading && mode === 'owner' && isOwner) loadOwnerQueue();
  }, [loading, mode, isOwner, loadOwnerQueue]);

  const schoolName = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId)?.name ?? 'School',
    [schools, selectedSchoolId]
  );

  const reviewSchoolNote = async (
    item: SchoolQueueItem,
    decision: 'approved' | 'rejected' | 'formal_curriculum_review'
  ) => {
    const draft = drafts[item.note.id];
    const minutes = Number(draft?.minutes ?? item.currentMinutes);

    if (decision === 'approved' && (!Number.isInteger(minutes) || minutes <= 0)) {
      setError('Approved minutes must be a whole number greater than zero.');
      return;
    }

    const confirmText =
      decision === 'approved'
        ? 'Approve this as a school-wide implementation change? All related classes at this school will use the updated agenda slot.'
        : decision === 'formal_curriculum_review'
        ? 'Flag this for formal curriculum review? No agenda change will be published.'
        : 'Close this note with no agenda change?';

    if (!window.confirm(confirmText)) return;

    setBusyId(item.note.id);
    setError('');
    setMessage('');
    try {
      const { error: rpcError } = await supabase.rpc('school_review_agenda_note_change', {
        p_note_id: item.note.id,
        p_decision: decision,
        p_proposed_activity: decision === 'approved' ? draft?.activity ?? item.currentActivity : null,
        p_proposed_minutes: decision === 'approved' ? minutes : null,
        p_review_notes: draft?.notes || null,
      });
      if (rpcError) throw rpcError;

      setMessage(
        decision === 'approved'
          ? 'School change approved and published. It was also sent to the Platform Owner review queue.'
          : decision === 'formal_curriculum_review'
          ? 'Item flagged for formal curriculum review. No agenda content was changed.'
          : 'Note reviewed with no agenda change.'
      );
      await loadSchoolQueue();
      if (isOwner) await loadOwnerQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const decideOwnerReview = async (
    review: AgendaReview,
    decision: 'promote_master' | 'keep_school_only' | 'reject_master' | 'formal_review_acknowledged'
  ) => {
    const labels: Record<string, string> = {
      promote_master: 'Promote this school-approved implementation change to the master agenda wherever this master slot is used?',
      keep_school_only: 'Keep this change at the approving school only?',
      reject_master: 'Reject this as a master change? The school-approved version will remain in place at that school.',
      formal_review_acknowledged: 'Acknowledge this formal curriculum review item? It will remain outside automatic publication.',
    };
    if (!window.confirm(labels[decision])) return;

    setBusyId(review.id);
    setError('');
    setMessage('');
    try {
      const { error: rpcError } = await supabase.rpc('owner_decide_agenda_change', {
        p_review_id: review.id,
        p_decision: decision,
        p_owner_notes: ownerDecisionNotes[review.id] || null,
      });
      if (rpcError) throw rpcError;
      setMessage('Platform Owner review saved.');
      await loadOwnerQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <main className="review-shell centered"><div className="spinner"/><p>Loading review permissions…</p><style jsx>{styles}</style></main>;
  }

  return (
    <main className="review-shell">
      <header className="review-header">
        <div>
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>Agenda Review Queue</h1>
          <p>Instructor notes are observations only. School approval can change implementation for that school. Platform Owner review decides whether a school-approved change should become a master change.</p>
        </div>
        <button className="secondary" onClick={() => router.push('/dashboard')}>Back to Planner</button>
      </header>

      <div className="boundary"><strong>Protected boundary:</strong> this workflow may change pacing, timing, sequencing, demonstrations, materials, and instructional implementation. It cannot change approved core curriculum, approved course outcomes, or protected grading requirements.</div>

      {isOwner && (
        <nav className="mode-tabs">
          <button className={mode === 'school' ? 'active' : ''} onClick={() => setMode('school')}>School Review</button>
          <button className={mode === 'owner' ? 'active' : ''} onClick={() => setMode('owner')}>Platform Owner Review</button>
        </nav>
      )}

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      {mode === 'school' && (
        <section className="stack">
          <div className="toolbar">
            <div>
              <div className="eyebrow">School Administration</div>
              <h2>Instructor Agenda Notes</h2>
              <p>Review shared time-slot notes. Nothing changes until an administrator approves a specific implementation update.</p>
            </div>
            <label>
              School
              <select value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            </label>
          </div>

          {queueLoading ? (
            <div className="empty-card">Loading {schoolName} notes…</div>
          ) : schoolQueue.length === 0 ? (
            <div className="empty-card">No unreviewed shared agenda notes for {schoolName}.</div>
          ) : (
            schoolQueue.map((item) => {
              const draft = drafts[item.note.id] ?? { activity: item.currentActivity, minutes: String(item.currentMinutes), notes: '' };
              return (
                <article className="review-card" key={item.note.id}>
                  <div className="card-top">
                    <div>
                      <div className="eyebrow">Day {item.plannerDay?.planner_day_number ?? '?'} · {item.timeLabel}</div>
                      <h3>{item.section?.section_name || item.section?.section_code || 'Section'}</h3>
                      <span>{dateLabel(item.plannerDay?.scheduled_date ?? null)} · {personLabel(item.instructor)}</span>
                    </div>
                    <span className="status pending">Awaiting school review</span>
                  </div>

                  <div className="note-box"><strong>Instructor note</strong><p>{item.note.note_text}</p></div>

                  <div className="compare-grid">
                    <div>
                      <label>Current agenda activity</label>
                      <div className="readonly-box">{item.currentActivity}</div>
                    </div>
                    <div>
                      <label>Approved school version</label>
                      <textarea
                        rows={4}
                        value={draft.activity}
                        onChange={(event) => setDrafts((current) => ({ ...current, [item.note.id]: { ...draft, activity: event.target.value } }))}
                      />
                    </div>
                  </div>

                  <div className="small-grid">
                    <label>Current minutes<input value={item.currentMinutes} disabled /></label>
                    <label>School minutes<input type="number" min={1} step={1} value={draft.minutes} onChange={(event) => setDrafts((current) => ({ ...current, [item.note.id]: { ...draft, minutes: event.target.value } }))} /></label>
                    <label className="review-notes">Administrative review notes<input value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [item.note.id]: { ...draft, notes: event.target.value } }))} placeholder="Optional reason or context" /></label>
                  </div>

                  <div className="actions">
                    <button disabled={busyId === item.note.id} onClick={() => reviewSchoolNote(item, 'approved')}>Approve School Change</button>
                    <button className="secondary" disabled={busyId === item.note.id} onClick={() => reviewSchoolNote(item, 'rejected')}>No Agenda Change</button>
                    <button className="warning" disabled={busyId === item.note.id} onClick={() => reviewSchoolNote(item, 'formal_curriculum_review')}>Formal Curriculum Review</button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {mode === 'owner' && isOwner && (
        <section className="stack">
          <div className="toolbar">
            <div>
              <div className="eyebrow">Platform Owner</div>
              <h2>School-Approved Changes</h2>
              <p>School-approved implementation changes are already active at that school. Decide whether each one stays local or becomes a master change.</p>
            </div>
          </div>

          {queueLoading ? (
            <div className="empty-card">Loading Platform Owner queue…</div>
          ) : ownerQueue.length === 0 ? (
            <div className="empty-card">No school-approved agenda changes are waiting for Platform Owner review.</div>
          ) : (
            ownerQueue.map((review) => {
              const note = ownerNotes[review.source_note_id];
              const instructor = note ? ownerProfiles[note.instructor_id] : null;
              const reviewer = ownerProfiles[review.school_reviewed_by];
              const school = ownerSchools[review.school_id];
              const section = ownerSections[review.source_section_id];
              const course = ownerCourses[review.course_id];
              const formal = review.school_decision === 'formal_curriculum_review';

              return (
                <article className="review-card" key={review.id}>
                  <div className="card-top">
                    <div>
                      <div className="eyebrow">{school?.name || 'School'} · Day {review.planner_day_number}</div>
                      <h3>{course?.course_code || course?.course_name || 'Course'} · {section?.section_name || section?.section_code || 'Section'}</h3>
                      <span>Instructor: {personLabel(instructor)} · School reviewer: {personLabel(reviewer)}</span>
                    </div>
                    <span className={`status ${formal ? 'formal' : 'pending'}`}>{formal ? 'Formal curriculum review' : 'School approved'}</span>
                  </div>

                  {note && <div className="note-box"><strong>Original instructor note</strong><p>{note.note_text}</p></div>}

                  {!formal && (
                    <div className="compare-grid">
                      <div><label>Before</label><div className="readonly-box">{review.original_activity}<small>{review.original_minutes} min</small></div></div>
                      <div><label>School-approved version</label><div className="readonly-box approved">{review.proposed_activity}<small>{review.proposed_minutes} min</small></div></div>
                    </div>
                  )}

                  {review.school_review_notes && <div className="admin-note"><strong>School review notes:</strong> {review.school_review_notes}</div>}

                  <label>Platform Owner review notes<textarea rows={2} value={ownerDecisionNotes[review.id] ?? ''} onChange={(event) => setOwnerDecisionNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Optional decision notes" /></label>

                  <div className="actions">
                    {formal ? (
                      <button className="warning" disabled={busyId === review.id} onClick={() => decideOwnerReview(review, 'formal_review_acknowledged')}>Acknowledge Formal Review</button>
                    ) : (
                      <>
                        <button disabled={busyId === review.id} onClick={() => decideOwnerReview(review, 'promote_master')}>Promote to Master</button>
                        <button className="secondary" disabled={busyId === review.id} onClick={() => decideOwnerReview(review, 'keep_school_only')}>Keep School Only</button>
                        <button className="danger" disabled={busyId === review.id} onClick={() => decideOwnerReview(review, 'reject_master')}>Reject Master Change</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .review-shell { min-height:100vh; padding:28px; background:#090909; color:#ddd; }
  .centered { display:grid; place-items:center; align-content:center; gap:12px; }
  .review-header, .toolbar, .card-top, .actions, .mode-tabs { display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
  .review-header { max-width:1180px; margin:0 auto 18px; }
  .review-header h1 { margin:5px 0 8px; color:#fff; font-size:32px; }
  .review-header p, .toolbar p { margin:0; color:#888; line-height:1.5; max-width:850px; }
  .eyebrow { color:#00ff88; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
  .boundary, .error-box, .success-box, .empty-card { max-width:1180px; margin:0 auto 16px; padding:14px 16px; border:1px solid #303030; border-radius:9px; background:#121212; line-height:1.5; }
  .boundary strong { color:#fff; }
  .error-box { border-color:rgba(255,90,90,.45); color:#ff9999; background:rgba(255,90,90,.06); }
  .success-box { border-color:rgba(0,255,136,.35); color:#90ffc0; background:rgba(0,255,136,.06); }
  .mode-tabs { max-width:1180px; margin:0 auto 18px; justify-content:flex-start; }
  .mode-tabs button { min-width:190px; }
  .mode-tabs .active { background:rgba(0,255,136,.12); border-color:#00ff88; color:#00ff88; }
  .stack { max-width:1180px; margin:0 auto; display:grid; gap:16px; }
  .toolbar { padding:18px; border:1px solid #2a2a2a; border-radius:10px; background:#111; }
  .toolbar h2 { margin:4px 0 7px; color:#fff; }
  .toolbar label { min-width:260px; }
  .review-card { padding:18px; border:1px solid #2c2c2c; border-radius:10px; background:#121212; display:grid; gap:16px; }
  .card-top h3 { margin:5px 0 5px; color:#fff; }
  .card-top span:not(.status) { color:#888; font-size:13px; }
  .status { padding:7px 10px; border-radius:999px; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; }
  .status.pending { color:#00ff88; background:rgba(0,255,136,.08); border:1px solid rgba(0,255,136,.3); }
  .status.formal { color:#ffbd66; background:rgba(255,170,50,.08); border:1px solid rgba(255,170,50,.35); }
  .note-box { padding:14px; border-left:3px solid #00ff88; background:#0c0c0c; }
  .note-box strong { color:#fff; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  .note-box p { margin:8px 0 0; line-height:1.55; white-space:pre-wrap; }
  .compare-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .small-grid { display:grid; grid-template-columns:140px 140px minmax(240px,1fr); gap:14px; }
  label { display:grid; gap:7px; color:#aaa; font-size:12px; font-weight:800; }
  input, textarea, select { width:100%; padding:11px 12px; border:1px solid #333; border-radius:7px; background:#0b0b0b; color:#eee; font:inherit; box-sizing:border-box; }
  textarea { resize:vertical; line-height:1.45; }
  input:focus, textarea:focus, select:focus { outline:none; border-color:#00ff88; }
  input:disabled { color:#777; }
  .readonly-box { min-height:76px; padding:12px; border:1px solid #292929; border-radius:7px; background:#0b0b0b; line-height:1.5; white-space:pre-wrap; }
  .readonly-box.approved { border-color:rgba(0,255,136,.3); }
  .readonly-box small { display:block; margin-top:10px; color:#00ff88; font-weight:800; }
  .admin-note { padding:11px 13px; border-radius:7px; background:#0b0b0b; color:#aaa; }
  .actions { justify-content:flex-start; }
  button { padding:11px 15px; border:1px solid rgba(0,255,136,.5); border-radius:7px; background:rgba(0,255,136,.08); color:#00ff88; font-weight:900; cursor:pointer; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  button.secondary { border-color:#383838; color:#bbb; background:#111; }
  button.warning { border-color:rgba(255,170,50,.5); color:#ffbd66; background:rgba(255,170,50,.08); }
  button.danger { border-color:rgba(255,90,90,.45); color:#ff9090; background:rgba(255,90,90,.07); }
  .spinner { width:26px; height:26px; border:3px solid #222; border-top-color:#00ff88; border-radius:50%; animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media (max-width:760px) {
    .review-shell { padding:18px 12px; }
    .compare-grid, .small-grid { grid-template-columns:1fr; }
    .review-header h1 { font-size:27px; }
    .toolbar label { min-width:100%; }
    .actions button { width:100%; }
  }
`;
