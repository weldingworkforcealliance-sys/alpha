'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import styles from '../attendance.module.css';

type School = { id: string; name: string };
type Section = {
  id: string;
  school_id: string;
  course_id: string;
  section_name: string;
  section_code: string | null;
  cohort_id: string | null;
  status: string;
};
type Course = { id: string; course_code: string; course_name: string };
type Pair = {
  id: string;
  school_id: string;
  pair_name: string;
  primary_section_id: string;
  completion_section_id: string;
  attendance_mode: 'standard' | 'pvhs';
  report_email: string | null;
  report_delay_minutes: number;
  active: boolean;
};
type Student = { id: string; display_name: string; external_student_id: string | null };

function sectionLabel(section: Section, courses: Map<string, Course>) {
  const course = courses.get(section.course_id);
  const courseLabel = course?.course_code || course?.course_name || 'Course';
  return `${courseLabel} · ${section.section_name}${section.section_code ? ` (${section.section_code})` : ''}`;
}

export default function AttendanceAdminPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [selectedPairId, setSelectedPairId] = useState('');
  const [pairName, setPairName] = useState('');
  const [primarySectionId, setPrimarySectionId] = useState('');
  const [completionSectionId, setCompletionSectionId] = useState('');
  const [mode, setMode] = useState<'standard' | 'pvhs'>('standard');
  const [reportEmail, setReportEmail] = useState('');
  const [reportDelay, setReportDelay] = useState(30);
  const [pairActive, setPairActive] = useState(true);
  const [bulkNames, setBulkNames] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const selectedPair = useMemo(
    () => pairs.find((pair) => pair.id === selectedPairId) ?? null,
    [pairs, selectedPairId]
  );

  const loadSchools = async () => {
    const { data: owner } = await supabase.rpc('is_platform_owner');
    if (owner) {
      const { data, error } = await supabase.from('schools').select('id,name').order('name');
      if (error) throw error;
      const loaded = (data ?? []) as School[];
      setSchools(loaded);
      if (!schoolId && loaded[0]) setSchoolId(loaded[0].id);
      return;
    }

    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) throw new Error('Authentication required');

    const { data: memberships, error: membershipError } = await supabase
      .from('school_memberships')
      .select('school_id,role,status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('role', ['school_admin', 'program_lead']);
    if (membershipError) throw membershipError;

    const ids = (memberships ?? []).map((row: { school_id: string }) => row.school_id);
    if (!ids.length) throw new Error('School administration access is required.');

    const { data, error } = await supabase.from('schools').select('id,name').in('id', ids).order('name');
    if (error) throw error;
    const loaded = (data ?? []) as School[];
    setSchools(loaded);
    if (!schoolId && loaded[0]) setSchoolId(loaded[0].id);
  };

  const loadSchoolData = async (targetSchoolId: string) => {
    if (!targetSchoolId) return;
    const [sectionResult, courseResult, pairResult] = await Promise.all([
      supabase
        .from('sections')
        .select('id,school_id,course_id,section_name,section_code,cohort_id,status')
        .eq('school_id', targetSchoolId)
        .order('section_name'),
      supabase
        .from('courses')
        .select('id,course_code,course_name')
        .eq('school_id', targetSchoolId)
        .order('course_code'),
      supabase
        .from('attendance_pairs')
        .select('id,school_id,pair_name,primary_section_id,completion_section_id,attendance_mode,report_email,report_delay_minutes,active')
        .eq('school_id', targetSchoolId)
        .order('created_at'),
    ]);
    const firstError = sectionResult.error || courseResult.error || pairResult.error;
    if (firstError) throw firstError;
    setSections((sectionResult.data ?? []) as Section[]);
    setCourses((courseResult.data ?? []) as Course[]);
    setPairs((pairResult.data ?? []) as Pair[]);
  };

  const loadRoster = async (pairId: string) => {
    if (!pairId) {
      setRoster([]);
      return;
    }
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('attendance_pair_enrollments')
      .select('student_id')
      .eq('pair_id', pairId)
      .eq('active', true);
    if (enrollmentError) throw enrollmentError;
    const ids = (enrollments ?? []).map((row: { student_id: string }) => row.student_id);
    if (!ids.length) {
      setRoster([]);
      return;
    }
    const { data, error } = await supabase
      .from('attendance_students')
      .select('id,display_name,external_student_id')
      .in('id', ids)
      .eq('active', true)
      .order('display_name');
    if (error) throw error;
    setRoster((data ?? []) as Student[]);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace('/login');
          return;
        }
        await loadSchools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setBusy(true);
      setError('');
      try {
        await loadSchoolData(schoolId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedPair) {
      setPairName('');
      setPrimarySectionId('');
      setCompletionSectionId('');
      setMode('standard');
      setReportEmail('');
      setReportDelay(30);
      setPairActive(true);
      setRoster([]);
      return;
    }
    setPairName(selectedPair.pair_name);
    setPrimarySectionId(selectedPair.primary_section_id);
    setCompletionSectionId(selectedPair.completion_section_id);
    setMode(selectedPair.attendance_mode);
    setReportEmail(selectedPair.report_email ?? '');
    setReportDelay(selectedPair.report_delay_minutes);
    setPairActive(selectedPair.active);
    void loadRoster(selectedPair.id);
  }, [selectedPairId, selectedPair]);

  const savePair = async () => {
    if (!schoolId || !primarySectionId || !completionSectionId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: rpcError } = await supabase.rpc('save_attendance_pair', {
        p_pair_id: selectedPairId || null,
        p_primary_section_id: primarySectionId,
        p_completion_section_id: completionSectionId,
        p_pair_name: pairName.trim() || 'Class Pair',
        p_mode: mode,
        p_report_email: reportEmail.trim() || null,
        p_report_delay_minutes: reportDelay,
        p_active: pairActive,
      });
      if (rpcError) throw rpcError;
      await loadSchoolData(schoolId);
      const pairId = String(data);
      setSelectedPairId(pairId);
      setNotice('Attendance pair saved. The shared roster will serve both linked sections.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const importRoster = async () => {
    if (!selectedPairId || !bulkNames.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: rpcError } = await supabase.rpc('bulk_upsert_attendance_roster', {
        p_pair_id: selectedPairId,
        p_names: bulkNames,
      });
      if (rpcError) throw rpcError;
      const result = Array.isArray(data) ? data[0] : data;
      setBulkNames('');
      await loadRoster(selectedPairId);
      setNotice(`Roster updated. ${result?.enrolled ?? 0} student row(s) enrolled in the shared class pair.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!selectedPairId) return;
    setBusy(true);
    try {
      const { error: updateError } = await supabase
        .from('attendance_pair_enrollments')
        .update({ active: false })
        .eq('pair_id', selectedPairId)
        .eq('student_id', studentId);
      if (updateError) throw updateError;
      await loadRoster(selectedPairId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className={styles.page}>Loading attendance administration…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>School Administration</div>
          <h1>Attendance Pair Configuration</h1>
          <p>
            Link the two courses that share one daily attendance roster. Students pasted into the pair are automatically available from both linked sections. Future course pairs use the same configuration.
          </p>
        </div>
        <a className={styles.backLink} href="/attendance">Back to Attendance</a>
      </header>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
      {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

      <section className={styles.toolbar}>
        <label className={styles.field}>
          School
          <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} disabled={busy}>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Existing pair
          <select value={selectedPairId} onChange={(event) => setSelectedPairId(event.target.value)} disabled={busy}>
            <option value="">Create new pair</option>
            {pairs.map((pair) => (
              <option key={pair.id} value={pair.id}>{pair.pair_name}{pair.active ? '' : ' · inactive'}</option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.secondaryButton} onClick={() => setSelectedPairId('')} disabled={busy}>
          New Pair
        </button>
      </section>

      <section className={styles.finalizeCard}>
        <div className={styles.finalizeHeader}>
          <div>
            <div className={styles.eyebrow}>Class Pair</div>
            <h2>{selectedPairId ? 'Edit attendance pair' : 'Create attendance pair'}</h2>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(260px,1.4fr) minmax(260px,1.4fr)', gap: 10 }}>
          <label className={styles.field}>
            Pair name
            <input value={pairName} onChange={(event) => setPairName(event.target.value)} placeholder="PVHS Level I · WLD 105/110" />
          </label>
          <label className={styles.field}>
            Primary / first course
            <select value={primarySectionId} onChange={(event) => setPrimarySectionId(event.target.value)}>
              <option value="">Select section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>{sectionLabel(section, courseMap)}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Completion / confirmation course
            <select value={completionSectionId} onChange={(event) => setCompletionSectionId(event.target.value)}>
              <option value="">Select section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>{sectionLabel(section, courseMap)}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(260px,1fr) 190px auto', gap: 10, alignItems: 'end' }}>
          <label className={styles.field}>
            Attendance mode
            <select value={mode} onChange={(event) => setMode(event.target.value as 'standard' | 'pvhs')}>
              <option value="standard">Standard</option>
              <option value="pvhs">PVHS + delayed email report</option>
            </select>
          </label>
          <label className={styles.field}>
            PVHS report recipient
            <input
              type="email"
              value={reportEmail}
              onChange={(event) => setReportEmail(event.target.value)}
              placeholder={mode === 'pvhs' ? 'attendance@pvhs.example' : 'Not used in Standard mode'}
              disabled={mode !== 'pvhs'}
            />
          </label>
          <label className={styles.field}>
            Report delay (minutes)
            <input
              type="number"
              min={0}
              max={1440}
              value={reportDelay}
              onChange={(event) => setReportDelay(Number(event.target.value) || 0)}
              disabled={mode !== 'pvhs'}
            />
          </label>
          <label style={{ color: '#b7c9c5', paddingBottom: 9 }}>
            <input type="checkbox" checked={pairActive} onChange={(event) => setPairActive(event.target.checked)} /> Active
          </label>
        </div>

        <button type="button" className={styles.actionButton} onClick={savePair} disabled={busy || !primarySectionId || !completionSectionId}>
          {busy ? 'Saving…' : 'Save Attendance Pair'}
        </button>
      </section>

      {selectedPairId && (
        <section className={styles.finalizeCard}>
          <div className={styles.finalizeHeader}>
            <div>
              <div className={styles.eyebrow}>Shared Student Roster</div>
              <h2>Paste students in one batch</h2>
            </div>
            <span className={styles.modePill}>{roster.length} active students</span>
          </div>
          <p style={{ margin: 0, color: '#9eb1ad', lineHeight: 1.45 }}>
            Paste one student name per line. The roster belongs to the pair, so the same students appear automatically in both linked courses.
          </p>
          <textarea
            rows={8}
            value={bulkNames}
            onChange={(event) => setBulkNames(event.target.value)}
            placeholder={'Student One\nStudent Two\nStudent Three'}
          />
          <button type="button" className={styles.actionButton} onClick={importRoster} disabled={busy || !bulkNames.trim()}>
            Add / Reactivate Students
          </button>

          {roster.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
              {roster.map((student) => (
                <div
                  key={student.id}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid #253b37', background: '#081310', borderRadius: 8, padding: '9px 11px' }}
                >
                  <span>{student.display_name}</span>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => removeStudent(student.id)}
                    disabled={busy}
                  >
                    Remove from Pair
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
