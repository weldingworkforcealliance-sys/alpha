'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type School = { id: string; name: string };
type Membership = { school_id: string; role: string; status: string };
type Note = {
  id: string;
  school_id: string;
  section_id: string;
  planner_day_id: string;
  instructor_id: string;
  note_text: string;
  created_at: string;
};
type Profile = { id: string; display_name: string | null; email: string | null };
type Section = { id: string; section_name: string | null; section_code: string | null };
type PlannerDay = {
  id: string;
  planner_day_number: number;
  scheduled_date: string | null;
  title: string | null;
};

type QueueItem = {
  note: Note;
  profile: Profile | null;
  section: Section | null;
  day: PlannerDay | null;
};

function personLabel(profile: Profile | null) {
  return profile?.display_name || profile?.email || 'Instructor';
}

export default function DayCompletionReviewQueue() {
  const [supabase] = useState(getSupabase);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) return;

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

        const memberships = (membershipResult.data ?? []) as Membership[];
        const managerSchoolIds = new Set(
          memberships
            .filter((membership) => ['school_admin', 'program_lead'].includes(membership.role))
            .map((membership) => membership.school_id)
        );

        const allSchools = (schoolsResult.data ?? []) as School[];
        const allowed = Boolean(ownerResult.data)
          ? allSchools
          : allSchools.filter((school) => managerSchoolIds.has(school.id));

        setSchools(allowed);
        setSchoolId(allowed[0]?.id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const loadQueue = useCallback(async () => {
    if (!schoolId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [notesResult, reviewsResult] = await Promise.all([
        supabase
          .from('instructor_notes')
          .select('id,school_id,section_id,planner_day_id,instructor_id,note_text,created_at')
          .eq('school_id', schoolId)
          .eq('note_type', 'day_completion')
          .eq('visibility', 'shared')
          .order('created_at', { ascending: false }),
        supabase
          .from('instructor_day_note_reviews')
          .select('note_id')
          .eq('school_id', schoolId),
      ]);

      if (notesResult.error) throw notesResult.error;
      if (reviewsResult.error) throw reviewsResult.error;

      const reviewedIds = new Set(
        (reviewsResult.data ?? []).map((row: { note_id: string }) => row.note_id)
      );
      const notes = ((notesResult.data ?? []) as Note[]).filter(
        (note) => !reviewedIds.has(note.id)
      );

      if (!notes.length) {
        setItems([]);
        return;
      }

      const profileIds = Array.from(new Set(notes.map((note) => note.instructor_id)));
      const sectionIds = Array.from(new Set(notes.map((note) => note.section_id)));
      const dayIds = Array.from(new Set(notes.map((note) => note.planner_day_id)));

      const [profilesResult, sectionsResult, daysResult] = await Promise.all([
        supabase.from('profiles').select('id,display_name,email').in('id', profileIds),
        supabase.from('sections').select('id,section_name,section_code').in('id', sectionIds),
        supabase
          .from('planner_days')
          .select('id,planner_day_number,scheduled_date,title')
          .in('id', dayIds),
      ]);

      const firstError = profilesResult.error || sectionsResult.error || daysResult.error;
      if (firstError) throw firstError;

      const profiles = new Map(
        ((profilesResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile])
      );
      const sections = new Map(
        ((sectionsResult.data ?? []) as Section[]).map((section) => [section.id, section])
      );
      const days = new Map(
        ((daysResult.data ?? []) as PlannerDay[]).map((day) => [day.id, day])
      );

      setItems(
        notes.map((note) => ({
          note,
          profile: profiles.get(note.instructor_id) ?? null,
          section: sections.get(note.section_id) ?? null,
          day: days.get(note.planner_day_id) ?? null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [schoolId, supabase]);

  useEffect(() => {
    if (schoolId) void loadQueue();
  }, [loadQueue, schoolId]);

  const schoolName = useMemo(
    () => schools.find((school) => school.id === schoolId)?.name ?? 'School',
    [schoolId, schools]
  );

  const review = async (
    noteId: string,
    decision: 'acknowledged' | 'planner_follow_up' | 'formal_curriculum_review'
  ) => {
    setBusyId(noteId);
    setError('');
    setMessage('');
    try {
      const { error: rpcError } = await supabase.rpc('review_day_completion_note', {
        p_note_id: noteId,
        p_decision: decision,
        p_review_notes: null,
      });
      if (rpcError) throw rpcError;

      setMessage(
        decision === 'planner_follow_up'
          ? 'Day note marked for planner follow-up.'
          : decision === 'formal_curriculum_review'
          ? 'Day note flagged for formal curriculum review.'
          : 'Day note reviewed.'
      );
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!schools.length && !loading) return null;

  return (
    <section
      style={{
        width: 'min(1180px, calc(100% - 24px))',
        margin: '18px auto 0',
        border: '1px solid rgba(69,214,232,.38)',
        borderRadius: 12,
        background: '#0a1513',
        color: '#dceae7',
        padding: 16,
      }}
      aria-label="Day completion note review queue"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
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
            Review Queue
          </div>
          <h2 style={{ margin: '3px 0 0', fontSize: 21 }}>Day Completion Notes</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb2ae', fontSize: 13 }}>
            Shared instructor observations saved when a teaching day is completed.
          </p>
        </div>

        <label style={{ display: 'grid', gap: 4, color: '#9fb2ae', fontSize: 12 }}>
          School
          <select
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            style={{
              background: '#07100f',
              border: '1px solid #2c4742',
              color: '#e9f3f1',
              borderRadius: 7,
              padding: '8px 10px',
            }}
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div style={{ marginBottom: 10, border: '1px solid #9e5555', borderRadius: 8, padding: 10, color: '#ffd0d0' }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ marginBottom: 10, border: '1px solid #357c58', borderRadius: 8, padding: 10, color: '#b8ffd8' }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#9fb2ae' }}>Loading {schoolName} day notes…</div>
      ) : items.length === 0 ? (
        <div
          style={{
            border: '1px dashed #2c4742',
            borderRadius: 9,
            padding: 14,
            color: '#9fb2ae',
          }}
        >
          No unreviewed day-completion notes for {schoolName}.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <article
              key={item.note.id}
              style={{
                border: '1px solid #29413d',
                borderRadius: 10,
                background: '#07100f',
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 8,
                }}
              >
                <div>
                  <strong>
                    {item.section?.section_name || item.section?.section_code || 'Section'} · Day{' '}
                    {item.day?.planner_day_number ?? '?'}
                  </strong>
                  <div style={{ marginTop: 3, color: '#8fa8a3', fontSize: 12 }}>
                    {personLabel(item.profile)}
                    {item.day?.scheduled_date
                      ? ` · ${new Date(`${item.day.scheduled_date}T12:00:00`).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : ''}
                  </div>
                </div>
                <span style={{ color: '#ffd1a8', fontSize: 12, fontWeight: 800 }}>
                  Awaiting review
                </span>
              </div>

              {item.day?.title && (
                <div style={{ marginBottom: 7, color: '#b9c9c5', fontSize: 12 }}>
                  {item.day.title}
                </div>
              )}

              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  background: 'rgba(69,214,232,.045)',
                  border: '1px solid rgba(69,214,232,.18)',
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 14,
                }}
              >
                {item.note.note_text}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button
                  type="button"
                  disabled={busyId === item.note.id}
                  onClick={() => void review(item.note.id, 'acknowledged')}
                  style={{ border: '1px solid #50df92', background: '#17663f', color: 'white', borderRadius: 7, padding: '8px 11px', fontWeight: 800 }}
                >
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  disabled={busyId === item.note.id}
                  onClick={() => void review(item.note.id, 'planner_follow_up')}
                  style={{ border: '1px solid #45d6e8', background: '#145d68', color: 'white', borderRadius: 7, padding: '8px 11px', fontWeight: 800 }}
                >
                  Planner Follow-up
                </button>
                <button
                  type="button"
                  disabled={busyId === item.note.id}
                  onClick={() => void review(item.note.id, 'formal_curriculum_review')}
                  style={{ border: '1px solid #c58a49', background: '#6a431c', color: 'white', borderRadius: 7, padding: '8px 11px', fontWeight: 800 }}
                >
                  Formal Curriculum Review
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
