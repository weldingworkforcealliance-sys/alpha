'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import {
  publishSelectedSection,
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';
import styles from './attendance.module.css';

type TeachingSection = {
  school_id: string;
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
};

type SessionInfo = {
  session_id: string;
  pair_id: string;
  pair_name: string;
  attendance_mode: 'standard' | 'pvhs';
  is_completion_section: boolean;
  finalized: boolean;
};

type Student = {
  id: string;
  display_name: string;
  external_student_id: string | null;
};

type AttendanceRecord = {
  id: string;
  session_id: string;
  student_id: string;
  initial_status: string | null;
  final_status: string | null;
  completion_flags: string[];
  completion_confirmed: boolean;
  notes: string | null;
};

type EditableRecord = {
  recordId: string;
  initialStatus: string | null;
  finalStatus: string | null;
  flags: string[];
  notes: string;
};

type ReportQueue = {
  status: string;
  run_after: string;
  sent_at: string | null;
  recipient_email: string;
  last_error: string | null;
};

const INITIAL_STATUSES = [
  ['present', 'Present'],
  ['absent', 'Absent'],
  ['late', 'Late'],
  ['excused', 'Excused'],
] as const;

const COMPLETION_FLAGS = [
  ['unprepared', 'Unprepared'],
  ['left_early', 'Left early'],
  ['disappeared', 'Student disappeared'],
  ['other', 'Other'],
] as const;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function sectionLabel(section: TeachingSection) {
  const course = section.course_code || section.course_name || 'Course';
  const cohort = section.cohort_name || section.section_name || section.section_code;
  return cohort ? `${course} · ${cohort}` : course;
}

export default function AttendancePage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(localDate);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, EditableRecord>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [reportQueue, setReportQueue] = useState<ReportQueue | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedSection = useMemo(
    () => sections.find((section) => section.section_id === sectionId) ?? null,
    [sections, sectionId]
  );

  const loadRoster = async (info: SessionInfo) => {
    const enrollmentResult = await supabase
      .from('attendance_pair_enrollments')
      .select('student_id')
      .eq('pair_id', info.pair_id)
      .eq('active', true);
    if (enrollmentResult.error) throw enrollmentResult.error;

    const studentIds = (enrollmentResult.data ?? []).map(
      (row: { student_id: string }) => row.student_id
    );

    if (!studentIds.length) {
      setStudents([]);
      setRecords({});
      return;
    }

    const [studentResult, recordResult] = await Promise.all([
      supabase
        .from('attendance_students')
        .select('id,display_name,external_student_id')
        .in('id', studentIds)
        .eq('active', true)
        .order('display_name'),
      supabase
        .from('attendance_records')
        .select(
          'id,session_id,student_id,initial_status,final_status,completion_flags,completion_confirmed,notes'
        )
        .eq('session_id', info.session_id),
    ]);

    if (studentResult.error) throw studentResult.error;
    if (recordResult.error) throw recordResult.error;

    const loadedStudents = (studentResult.data ?? []) as Student[];
    const loadedRecords = (recordResult.data ?? []) as AttendanceRecord[];
    const byStudent: Record<string, EditableRecord> = {};

    loadedRecords.forEach((record) => {
      byStudent[record.student_id] = {
        recordId: record.id,
        initialStatus: record.initial_status,
        finalStatus: record.final_status,
        flags: record.completion_flags ?? [],
        notes: record.notes ?? '',
      };
    });

    setStudents(loadedStudents);
    setRecords(byStudent);
  };

  const loadReportQueue = async (info: SessionInfo) => {
    if (info.attendance_mode !== 'pvhs') {
      setReportQueue(null);
      return;
    }
    const { data } = await supabase
      .from('attendance_report_queue')
      .select('status,run_after,sent_at,recipient_email,last_error')
      .eq('session_id', info.session_id)
      .maybeSingle();
    setReportQueue((data ?? null) as ReportQueue | null);
  };

  const openSession = async (targetSectionId: string, targetDate: string) => {
    if (!targetSectionId || !targetDate) return;
    setBusy(true);
    setError('');
    setNotice('');
    setSession(null);
    setStudents([]);
    setRecords({});
    try {
      const { data, error: rpcError } = await supabase.rpc('open_attendance_session', {
        p_section_id: targetSectionId,
        p_attendance_date: targetDate,
      });
      if (rpcError) throw rpcError;
      const info = (Array.isArray(data) ? data[0] : data) as SessionInfo | null;
      if (!info) throw new Error('Attendance session could not be opened.');
      setSession(info);
      await loadRoster(info);
      await loadReportQueue(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

        const { data, error: sectionError } = await supabase
          .from('current_teaching_sections')
          .select('school_id,section_id,section_name,section_code,course_code,course_name,cohort_name');
        if (sectionError) throw sectionError;

        const loaded = (data ?? []) as TeachingSection[];
        setSections(loaded);

        const params = new URLSearchParams(window.location.search);
        const requestedSection = params.get('section') || readSelectedSectionId();
        const requestedDate = params.get('date') || localDate();
        setAttendanceDate(requestedDate);

        const chosen = loaded.find((section) => section.section_id === requestedSection) ?? loaded[0];
        if (chosen) {
          setSectionId(chosen.section_id);
          publishSelectedSection(chosen.section_id);
          const { data: management } = await supabase.rpc('can_manage_school', {
            check_school_id: chosen.school_id,
          });
          setCanManage(Boolean(management));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    return subscribeSelectedSection((nextSectionId) => {
      if (sections.some((section) => section.section_id === nextSectionId)) {
        setSectionId(nextSectionId);
      }
    });
  }, [sections]);

  useEffect(() => {
    if (!loading && sectionId && attendanceDate) {
      openSession(sectionId, attendanceDate);
    }
  }, [loading, sectionId, attendanceDate]);

  useEffect(() => {
    if (!selectedSection) return;
    supabase
      .rpc('can_manage_school', { check_school_id: selectedSection.school_id })
      .then(({ data }) => setCanManage(Boolean(data)));
  }, [selectedSection?.school_id, supabase]);

  const saveRecord = async (studentId: string, next?: EditableRecord) => {
    if (!session || session.finalized) return;
    const record = next ?? records[studentId];
    if (!record) return;
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('set_attendance_record', {
        p_session_id: session.session_id,
        p_student_id: studentId,
        p_initial_status: record.initialStatus,
        p_final_status: record.finalStatus,
        p_completion_flags: record.flags,
        p_notes: record.notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setNotice('Attendance saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const patchRecord = (studentId: string, patch: Partial<EditableRecord>, saveNow = false) => {
    const current = records[studentId];
    if (!current) return;
    const next = { ...current, ...patch };
    setRecords((existing) => ({ ...existing, [studentId]: next }));
    if (saveNow) void saveRecord(studentId, next);
  };

  const markAllPresent = async () => {
    if (!session || session.finalized) return;
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('mark_all_attendance', {
        p_session_id: session.session_id,
        p_status: 'present',
      });
      if (rpcError) throw rpcError;
      await loadRoster(session);
      setNotice('All active students marked present. Adjust exceptions as needed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleFlag = (studentId: string, flag: string) => {
    const current = records[studentId];
    if (!current) return;
    const flags = current.flags.includes(flag)
      ? current.flags.filter((item) => item !== flag)
      : [...current.flags, flag];
    let finalStatus = current.finalStatus;
    if (flag === 'left_early' && !current.flags.includes(flag)) finalStatus = 'left_early';
    if (flag === 'disappeared' && !current.flags.includes(flag) && !finalStatus) finalStatus = 'partial';
    patchRecord(studentId, { flags, finalStatus });
  };

  const finalize = async () => {
    if (!session || !selectedSection || !session.is_completion_section || session.finalized) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('finalize_attendance_session', {
        p_session_id: session.session_id,
        p_section_id: selectedSection.section_id,
        p_general_notes: generalNotes.trim() || null,
      });
      if (rpcError) throw rpcError;
      const updated = { ...session, finalized: true };
      setSession(updated);
      await loadRoster(updated);
      await loadReportQueue(updated);
      setNotice(
        session.attendance_mode === 'pvhs'
          ? 'Attendance finalized. The PVHS report is queued for delayed delivery.'
          : 'Attendance finalized for the class pair.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className={styles.page}>Loading attendance…</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>LTG Student Attendance</div>
          <h1>Paired-Class Attendance</h1>
          <p>
            One roster follows the linked course pair. Take daily attendance, then confirm the full-day result at the end of the configured completion course.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className={styles.backLink} href="/planner">Back to Planner</a>
          {canManage && <a className={styles.adminLink} href="/attendance/admin">Attendance Administration</a>}
        </div>
      </header>

      <section className={styles.toolbar}>
        <label className={styles.field}>
          Class
          <select
            value={sectionId}
            onChange={(event) => {
              setSectionId(event.target.value);
              publishSelectedSection(event.target.value);
            }}
            disabled={busy}
          >
            {sections.map((section) => (
              <option key={section.section_id} value={section.section_id}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Attendance date
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => setAttendanceDate(event.target.value)}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => openSession(sectionId, attendanceDate)}
          disabled={busy || !sectionId}
        >
          Refresh Attendance
        </button>
      </section>

      {error && (
        <div className={`${styles.notice} ${styles.error}`}>
          {error}
          {error.toLowerCase().includes('no attendance pair') && canManage && (
            <> <a href="/attendance/admin" style={{ color: '#fff' }}>Configure the class pair.</a></>
          )}
        </div>
      )}
      {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

      {session && (
        <>
          <section className={styles.summary}>
            <strong>{session.pair_name}</strong>
            <span className={styles.modePill}>{session.attendance_mode}</span>
            <span>{attendanceDate}</span>
            <span>{session.is_completion_section ? 'End-of-pair confirmation course' : 'Daily attendance course'}</span>
            <span>{session.finalized ? 'Finalized' : 'Open'}</span>
            {reportQueue && (
              <span>
                PVHS report: {reportQueue.status} · {reportQueue.recipient_email}
              </span>
            )}
          </section>

          {!session.finalized && students.length > 0 && (
            <div className={styles.bulkRow}>
              <button type="button" className={styles.actionButton} onClick={markAllPresent} disabled={busy}>
                Mark All Present
              </button>
              {!session.is_completion_section && (
                <span style={{ color: '#8da29d', alignSelf: 'center', fontSize: 12 }}>
                  Full-day notes and confirmation are completed in the paired completion course.
                </span>
              )}
            </div>
          )}

          {students.length ? (
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
                      <div className={styles.statusButtons}>
                        {INITIAL_STATUSES.map(([value, label]) => (
                          <button
                            type="button"
                            key={value}
                            disabled={busy || session.finalized}
                            onClick={() => patchRecord(student.id, { initialStatus: value }, true)}
                            className={`${styles.statusButton} ${styles[value]} ${record.initialStatus === value ? styles.active : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {session.is_completion_section && (
                      <div className={styles.completionGrid}>
                        <label className={styles.field}>
                          Final attendance
                          <select
                            value={record.finalStatus ?? ''}
                            disabled={busy || session.finalized}
                            onChange={(event) => patchRecord(student.id, { finalStatus: event.target.value || null })}
                          >
                            <option value="">Same as initial</option>
                            <option value="present">Present / full day</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                            <option value="excused">Excused</option>
                            <option value="left_early">Left early</option>
                            <option value="partial">Partial day</option>
                          </select>
                        </label>

                        <div className={styles.flags}>
                          {COMPLETION_FLAGS.map(([value, label]) => (
                            <label key={value}>
                              <input
                                type="checkbox"
                                checked={record.flags.includes(value)}
                                disabled={busy || session.finalized}
                                onChange={() => toggleFlag(student.id, value)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>

                        <label className={styles.field}>
                          Instructor note
                          <textarea
                            rows={2}
                            value={record.notes}
                            disabled={busy || session.finalized}
                            onChange={(event) => patchRecord(student.id, { notes: event.target.value })}
                            placeholder="Unprepared, left early, disappeared, other context…"
                          />
                        </label>

                        <button
                          type="button"
                          className={styles.saveButton}
                          disabled={busy || session.finalized}
                          onClick={() => saveRecord(student.id)}
                        >
                          Save Note
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ) : (
            <div className={styles.empty}>
              No active students are enrolled in this attendance pair.
              {canManage && <> Use <a href="/attendance/admin" style={{ color: '#79e7f2' }}>Attendance Administration</a> to paste the roster.</>}
            </div>
          )}

          {session.is_completion_section && students.length > 0 && (
            <section className={styles.finalizeCard}>
              <div className={styles.finalizeHeader}>
                <div>
                  <div className={styles.eyebrow}>End-of-Day Confirmation</div>
                  <h2>Confirm attendance for the full course pair</h2>
                </div>
                <span className={styles.modePill}>{session.finalized ? 'Finalized' : 'Required before Complete Day'}</span>
              </div>
              <textarea
                rows={3}
                value={generalNotes}
                disabled={busy || session.finalized}
                onChange={(event) => setGeneralNotes(event.target.value)}
                placeholder="Optional overall class attendance note"
              />
              {!session.finalized && (
                <button type="button" className={styles.actionButton} onClick={finalize} disabled={busy}>
                  {busy ? 'Saving…' : 'Finalize Pair Attendance'}
                </button>
              )}
              {session.attendance_mode === 'pvhs' && (
                <div className={styles.reportLine}>
                  PVHS mode queues one daily attendance report after the school-configured delay, currently designed for 30 minutes.
                  {reportQueue && ` Queue status: ${reportQueue.status}.`}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
