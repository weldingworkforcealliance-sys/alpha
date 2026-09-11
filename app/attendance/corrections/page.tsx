'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import styles from '../attendance.module.css';

type School = { id: string; name: string };
type Pair = {
  id: string;
  school_id: string;
  pair_name: string;
  primary_section_id: string;
  completion_section_id: string;
  attendance_mode: 'standard' | 'pvhs';
  active: boolean;
};
type Session = {
  id: string;
  school_id: string;
  pair_id: string;
  attendance_date: string;
  status: string;
  attendance_mode: string;
  finalized_at: string | null;
};
type Student = { id: string; display_name: string; external_student_id: string | null };
type RecordRow = {
  id: string;
  student_id: string;
  initial_status: string | null;
  final_status: string | null;
  completion_flags: string[] | null;
  notes: string | null;
};
type EditableRecord = {
  id: string | null;
  initialStatus: string;
  finalStatus: string;
  flags: string[];
  notes: string;
};
type ReportQueue = { status: string; sent_at: string | null; recipient_email: string };
type ErrorLike = { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };

const DAILY_STATUSES = [
  ['present', 'Present'],
  ['absent', 'Absent'],
  ['late', 'Late'],
  ['excused', 'Excused'],
] as const;

const FINAL_STATUSES = [
  ['', 'Same as daily'],
  ['present', 'Present / full day'],
  ['absent', 'Absent'],
  ['late', 'Late'],
  ['excused', 'Excused'],
  ['left_early', 'Left early'],
  ['partial', 'Partial day'],
] as const;

const FLAGS = [
  ['unprepared', 'Unprepared'],
  ['left_early', 'Left early'],
  ['disappeared', 'Student disappeared'],
  ['other', 'Other'],
] as const;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatError(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const item = err as ErrorLike;
    const parts = [item.message, item.details, item.hint]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
    if (parts.length) return Array.from(new Set(parts)).join(' ');
  }
  return 'Attendance correction failed. Please retry.';
}

export default function AttendanceCorrectionsPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairId, setPairId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(localDate);
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, EditableRecord>>({});
  const [reportQueue, setReportQueue] = useState<ReportQueue | null>(null);
  const [reason, setReason] = useState('');
  const [dayLoaded, setDayLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedPair = useMemo(() => pairs.find((pair) => pair.id === pairId) ?? null, [pairs, pairId]);
  const correctionReady = reason.trim().length >= 3;

  const resetLoadedDay = () => {
    setSession(null);
    setStudents([]);
    setRecords({});
    setReportQueue(null);
    setReason('');
    setDayLoaded(false);
    setNotice('');
    setError('');
  };

  const loadSchools = async () => {
    const { data: owner, error: ownerError } = await supabase.rpc('is_platform_owner');
    if (ownerError) throw ownerError;

    if (owner) {
      const { data, error: schoolsError } = await supabase.from('schools').select('id,name').order('name');
      if (schoolsError) throw schoolsError;
      const loaded = (data ?? []) as School[];
      setSchools(loaded);
      setSchoolId((current) => current || loaded[0]?.id || '');
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

    const schoolIds = (memberships ?? []).map((row: { school_id: string }) => row.school_id);
    if (!schoolIds.length) throw new Error('School administration or Platform Owner access is required.');

    const { data, error: schoolsError } = await supabase
      .from('schools')
      .select('id,name')
      .in('id', schoolIds)
      .order('name');
    if (schoolsError) throw schoolsError;
    const loaded = (data ?? []) as School[];
    setSchools(loaded);
    setSchoolId((current) => current || loaded[0]?.id || '');
  };

  const loadPairs = async (targetSchoolId: string) => {
    if (!targetSchoolId) return;
    const { data, error: pairError } = await supabase
      .from('attendance_pairs')
      .select('id,school_id,pair_name,primary_section_id,completion_section_id,attendance_mode,active')
      .eq('school_id', targetSchoolId)
      .order('pair_name');
    if (pairError) throw pairError;
    const loaded = (data ?? []) as Pair[];
    setPairs(loaded);
    setPairId((current) => loaded.some((pair) => pair.id === current) ? current : loaded[0]?.id || '');
  };

  const loadRoster = async (targetSession: Session, targetPairId: string) => {
    const [enrollmentResult, recordResult, queueResult] = await Promise.all([
      supabase.from('attendance_pair_enrollments').select('student_id,active').eq('pair_id', targetPairId),
      supabase
        .from('attendance_records')
        .select('id,student_id,initial_status,final_status,completion_flags,notes')
        .eq('session_id', targetSession.id),
      supabase
        .from('attendance_report_queue')
        .select('status,sent_at,recipient_email')
        .eq('session_id', targetSession.id)
        .maybeSingle(),
    ]);

    if (enrollmentResult.error) throw enrollmentResult.error;
    if (recordResult.error) throw recordResult.error;
    if (queueResult.error) throw queueResult.error;

    const enrollmentRows = (enrollmentResult.data ?? []) as { student_id: string; active: boolean }[];
    const rows = (recordResult.data ?? []) as RecordRow[];
    const currentIds = enrollmentRows.filter((row) => row.active).map((row) => row.student_id);
    const recordIds = rows.map((row) => row.student_id);
    const ids = Array.from(new Set([...currentIds, ...recordIds]));

    if (!ids.length) {
      setStudents([]);
      setRecords({});
      setReportQueue((queueResult.data ?? null) as ReportQueue | null);
      return;
    }

    const { data: studentData, error: studentError } = await supabase
      .from('attendance_students')
      .select('id,display_name,external_student_id')
      .in('id', ids)
      .order('display_name');
    if (studentError) throw studentError;

    const byStudent = new Map(rows.map((row) => [row.student_id, row]));
    const editable: Record<string, EditableRecord> = {};
    for (const student of (studentData ?? []) as Student[]) {
      const row = byStudent.get(student.id);
      editable[student.id] = {
        id: row?.id ?? null,
        initialStatus: row?.initial_status ?? '',
        finalStatus: row?.final_status ?? '',
        flags: row?.completion_flags ?? [],
        notes: row?.notes ?? '',
      };
    }

    setStudents((studentData ?? []) as Student[]);
    setRecords(editable);
    setReportQueue((queueResult.data ?? null) as ReportQueue | null);
  };

  const loadDay = async () => {
    if (!pairId || !attendanceDate) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id,school_id,pair_id,attendance_date,status,attendance_mode,finalized_at')
        .eq('pair_id', pairId)
        .eq('attendance_date', attendanceDate)
        .maybeSingle();
      if (sessionError) throw sessionError;
      const found = (data ?? null) as Session | null;
      setSession(found);
      setReason('');
      if (found) {
        await loadRoster(found, pairId);
      } else {
        setStudents([]);
        setRecords({});
        setReportQueue(null);
      }
      setDayLoaded(true);
    } catch (err) {
      setError(formatError(err));
      setDayLoaded(false);
    } finally {
      setBusy(false);
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
        await loadSchools();
      } catch (err) {
        setError(formatError(err));
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
        await loadPairs(schoolId);
        resetLoadedDay();
      } catch (err) {
        setError(formatError(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [schoolId]);

  const createPastSession = async () => {
    if (!selectedPair || !attendanceDate || !correctionReady) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('manager_create_attendance_session', {
        p_pair_id: selectedPair.id,
        p_attendance_date: attendanceDate,
        p_reason: reason.trim(),
      });
      if (rpcError) throw rpcError;

      const { data, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id,school_id,pair_id,attendance_date,status,attendance_mode,finalized_at')
        .eq('pair_id', selectedPair.id)
        .eq('attendance_date', attendanceDate)
        .single();
      if (sessionError) throw sessionError;
      const created = data as Session;
      setSession(created);
      setDayLoaded(true);
      await loadRoster(created, selectedPair.id);
      setNotice('Historical attendance session created. Enter the correct statuses, save each correction, then finalize the day.');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const patchRecord = (studentId: string, patch: Partial<EditableRecord>) => {
    setRecords((existing) => ({ ...existing, [studentId]: { ...existing[studentId], ...patch } }));
  };

  const toggleFlag = (studentId: string, flag: string) => {
    const current = records[studentId];
    if (!current) return;
    const next = current.flags.includes(flag)
      ? current.flags.filter((item) => item !== flag)
      : [...current.flags, flag];
    patchRecord(studentId, { flags: next });
  };

  const saveCorrection = async (studentId: string) => {
    if (!session || !correctionReady) return;
    const record = records[studentId];
    if (!record?.initialStatus) {
      setError('Choose a daily attendance status before saving the correction.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('manager_correct_attendance_record', {
        p_session_id: session.id,
        p_student_id: studentId,
        p_initial_status: record.initialStatus,
        p_final_status: record.finalStatus || null,
        p_completion_flags: record.flags,
        p_notes: record.notes.trim() || null,
        p_reason: reason.trim(),
      });
      if (rpcError) throw rpcError;
      await loadRoster(session, session.pair_id);
      setNotice(
        reportQueue?.status === 'sent'
          ? 'Attendance correction saved and audited. The previously sent PVHS report was not automatically resent.'
          : 'Attendance correction saved and audited.'
      );
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const finalizePastDay = async () => {
    if (!session || !selectedPair || session.status === 'finalized' || !correctionReady) return;
    if (students.some((student) => !records[student.id]?.initialStatus)) {
      setError('Every displayed student needs a daily status before finalizing this past day.');
      return;
    }
    const confirmed = typeof window === 'undefined' || window.confirm(
      `Finalize corrected attendance for ${attendanceDate}? This will lock the instructor view for that day.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('finalize_attendance_session', {
        p_session_id: session.id,
        p_section_id: selectedPair.completion_section_id,
        p_general_notes: `Administrative historical correction: ${reason.trim()}`,
      });
      if (rpcError) throw rpcError;

      const finalized = { ...session, status: 'finalized' };
      setSession(finalized);
      await loadRoster(finalized, session.pair_id);
      setNotice(
        selectedPair.attendance_mode === 'pvhs'
          ? 'Past attendance finalized. The PVHS report is queued using the normal reporting workflow.'
          : 'Past attendance finalized.'
      );
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className={styles.page}>Loading attendance corrections…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>LTG Attendance Administration</div>
          <h1>Correct Past Attendance</h1>
          <p>
            Platform Owners and school administrators can correct a student record even after the class date or after attendance was finalized. Every correction requires a reason and is written to the audit log.
          </p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.backLink} href="/attendance/history">Attendance History</a>
          <a className={styles.adminLink} href="/attendance/admin">Administration</a>
        </div>
      </header>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
      {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

      <section className={styles.toolbar}>
        <label className={styles.field}>
          School
          <select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); resetLoadedDay(); }} disabled={busy}>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          Class pair
          <select value={pairId} onChange={(event) => { setPairId(event.target.value); resetLoadedDay(); }} disabled={busy}>
            {pairs.map((pair) => <option key={pair.id} value={pair.id}>{pair.pair_name}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          Attendance date
          <input type="date" value={attendanceDate} max={localDate()} onChange={(event) => { setAttendanceDate(event.target.value); resetLoadedDay(); }} disabled={busy} />
        </label>
        <button type="button" className={styles.secondaryButton} onClick={loadDay} disabled={busy || !pairId || !attendanceDate}>
          {busy ? 'Loading…' : 'Load Attendance'}
        </button>
      </section>

      {dayLoaded && !session && pairId && (
        <section className={styles.finalizeCard}>
          <div className={styles.finalizeHeader}>
            <div>
              <div className={styles.eyebrow}>No attendance session found</div>
              <h2>{selectedPair?.pair_name} · {attendanceDate}</h2>
            </div>
          </div>
          <p>If this was a real class day, enter a correction reason first, then create the historical attendance session.</p>
          <textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason for creating this historical attendance day" />
          <button type="button" className={styles.actionButton} onClick={createPastSession} disabled={busy || !correctionReady}>
            Create Past Attendance Session
          </button>
        </section>
      )}

      {session && (
        <>
          <section className={styles.summary}>
            <strong>{selectedPair?.pair_name}</strong>
            <span className={styles.modePill}>{session.attendance_mode}</span>
            <span>{session.attendance_date}</span>
            <span>{session.status === 'finalized' ? 'Finalized' : 'Open / correction in progress'}</span>
            {reportQueue && <span>PVHS report: {reportQueue.status} · {reportQueue.recipient_email}</span>}
          </section>

          <section className={styles.finalizeCard}>
            <div className={styles.finalizeHeader}>
              <div>
                <div className={styles.eyebrow}>Required audit reason</div>
                <h2>Why is this attendance being corrected?</h2>
              </div>
            </div>
            <textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Student was added to the roster after the original attendance was finalized." />
            <div className={styles.reportLine}>
              {reportQueue?.status === 'sent'
                ? 'A PVHS report was already sent for this day. Saving a correction updates LTG history but does not automatically send a duplicate email.'
                : 'Corrections are recorded with the manager, date, previous value, new value, and this reason.'}
            </div>
          </section>

          {students.length > 0 ? (
            <section className={styles.roster}>
              {students.map((student) => {
                const record = records[student.id];
                if (!record) return null;
                return (
                  <article className={styles.studentCard} key={student.id}>
                    <div className={styles.studentTop}>
                      <div className={styles.studentName}>
                        <strong>{student.display_name}</strong>
                        {student.external_student_id && <span>{student.external_student_id}</span>}
                      </div>
                    </div>
                    <div className={styles.completionGrid}>
                      <label className={styles.field}>
                        Daily attendance
                        <select value={record.initialStatus} onChange={(event) => patchRecord(student.id, { initialStatus: event.target.value })} disabled={busy}>
                          <option value="">Not recorded</option>
                          {DAILY_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className={styles.field}>
                        Final full-day status
                        <select value={record.finalStatus} onChange={(event) => patchRecord(student.id, { finalStatus: event.target.value })} disabled={busy}>
                          {FINAL_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <div className={styles.flags}>
                        {FLAGS.map(([value, label]) => (
                          <label key={value}>
                            <input type="checkbox" checked={record.flags.includes(value)} onChange={() => toggleFlag(student.id, value)} disabled={busy} />
                            {label}
                          </label>
                        ))}
                      </div>
                      <label className={styles.field}>
                        Attendance note
                        <textarea rows={2} value={record.notes} onChange={(event) => patchRecord(student.id, { notes: event.target.value })} placeholder="Optional context for this student" disabled={busy} />
                      </label>
                      <button type="button" className={styles.saveButton} onClick={() => saveCorrection(student.id)} disabled={busy || !correctionReady || !record.initialStatus}>
                        Save Correction
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className={styles.empty}>No students are associated with this attendance pair.</div>
          )}

          {session.status !== 'finalized' && students.length > 0 && (
            <section className={styles.finalizeCard}>
              <div className={styles.finalizeHeader}>
                <div>
                  <div className={styles.eyebrow}>Historical day is still open</div>
                  <h2>Finalize after all corrections are saved</h2>
                </div>
              </div>
              <button type="button" className={styles.actionButton} onClick={finalizePastDay} disabled={busy || !correctionReady}>
                Finalize Past Attendance
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
