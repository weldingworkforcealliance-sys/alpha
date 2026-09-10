'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import styles from './history.module.css';

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
  attendance_mode: 'standard' | 'pvhs';
  status: 'draft' | 'finalized';
  taken_at: string;
  finalized_at: string | null;
  instructor_notes: string | null;
  report_recipient: string | null;
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
  updated_at: string;
};
type Student = {
  id: string;
  display_name: string;
  external_student_id: string | null;
  active: boolean;
};
type ReportQueue = {
  session_id: string;
  recipient_email: string;
  status: string;
  run_after: string;
  sent_at: string | null;
  last_error: string | null;
};
type Membership = { school_id: string; role: string; status: string };
type SectionInstructor = { section_id: string };
type SessionCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  leftEarly: number;
  partial: number;
  unmarked: number;
  flagged: number;
};

const FLAG_LABELS: Record<string, string> = {
  unprepared: 'Unprepared',
  left_early: 'Left early',
  disappeared: 'Student disappeared',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
  left_early: 'Left early',
  partial: 'Partial day',
  unmarked: 'Not recorded',
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function prettyDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function prettyDateTime(value: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function effectiveStatus(record: AttendanceRecord) {
  return record.final_status || record.initial_status || 'unmarked';
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status.replaceAll('_', ' ');
}

function classLabel(pair: Pair) {
  return pair.pair_name.split(' · ')[0] || pair.pair_name;
}

function sessionCounts(rows: AttendanceRecord[]): SessionCounts {
  const counts: SessionCounts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    leftEarly: 0,
    partial: 0,
    unmarked: 0,
    flagged: 0,
  };

  rows.forEach((record) => {
    const status = effectiveStatus(record);
    if (status === 'present') counts.present += 1;
    else if (status === 'absent') counts.absent += 1;
    else if (status === 'late') counts.late += 1;
    else if (status === 'excused') counts.excused += 1;
    else if (status === 'left_early') counts.leftEarly += 1;
    else if (status === 'partial') counts.partial += 1;
    else counts.unmarked += 1;

    if ((record.completion_flags ?? []).length > 0) counts.flagged += 1;
  });

  return counts;
}

function includesSearch(student: Student | undefined, record: AttendanceRecord, search: string) {
  if (!search) return true;
  const haystack = [
    student?.display_name,
    student?.external_student_id,
    record.notes,
    record.initial_status,
    record.final_status,
    ...(record.completion_flags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(search);
}

export default function AttendanceHistoryPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [schools, setSchools] = useState<School[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [reportQueue, setReportQueue] = useState<ReportQueue[]>([]);
  const [dateFrom, setDateFrom] = useState(() => daysAgo(30));
  const [dateTo, setDateTo] = useState(localDate);
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [pairFilter, setPairFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'daily' | 'student'>('daily');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [canManageAny, setCanManageAny] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(
    async (targetPairs: Pair[], fromDate: string, toDate: string) => {
      if (fromDate > toDate) {
        setError('The start date must be on or before the end date.');
        return;
      }

      const pairIds = targetPairs.map((pair) => pair.id);
      if (!pairIds.length) {
        setSessions([]);
        setRecords([]);
        setStudents([]);
        setReportQueue([]);
        return;
      }

      setBusy(true);
      setError('');
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select(
            'id,school_id,pair_id,attendance_date,attendance_mode,status,taken_at,finalized_at,instructor_notes,report_recipient'
          )
          .in('pair_id', pairIds)
          .gte('attendance_date', fromDate)
          .lte('attendance_date', toDate)
          .order('attendance_date', { ascending: false })
          .order('taken_at', { ascending: false });
        if (sessionError) throw sessionError;

        const loadedSessions = (sessionData ?? []) as Session[];
        setSessions(loadedSessions);
        const sessionIds = loadedSessions.map((session) => session.id);

        if (!sessionIds.length) {
          setRecords([]);
          setStudents([]);
          setReportQueue([]);
          return;
        }

        const [recordResult, queueResult] = await Promise.all([
          supabase
            .from('attendance_records')
            .select(
              'id,session_id,student_id,initial_status,final_status,completion_flags,completion_confirmed,notes,updated_at'
            )
            .in('session_id', sessionIds),
          supabase
            .from('attendance_report_queue')
            .select('session_id,recipient_email,status,run_after,sent_at,last_error')
            .in('session_id', sessionIds),
        ]);
        if (recordResult.error) throw recordResult.error;
        if (queueResult.error) throw queueResult.error;

        const loadedRecords = (recordResult.data ?? []) as AttendanceRecord[];
        setRecords(loadedRecords);
        setReportQueue((queueResult.data ?? []) as ReportQueue[]);

        const studentIds = Array.from(new Set(loadedRecords.map((record) => record.student_id)));
        if (!studentIds.length) {
          setStudents([]);
          return;
        }

        const { data: studentData, error: studentError } = await supabase
          .from('attendance_students')
          .select('id,display_name,external_student_id,active')
          .in('id', studentIds)
          .order('display_name');
        if (studentError) throw studentError;
        setStudents((studentData ?? []) as Student[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        const userId = auth.session?.user.id;
        if (!userId) {
          router.replace('/login');
          return;
        }

        const [ownerResult, membershipResult, instructorResult, schoolResult, pairResult] =
          await Promise.all([
            supabase.rpc('is_platform_owner'),
            supabase
              .from('school_memberships')
              .select('school_id,role,status')
              .eq('user_id', userId)
              .eq('status', 'active'),
            supabase
              .from('section_instructors')
              .select('section_id')
              .eq('instructor_id', userId)
              .eq('active', true),
            supabase.from('schools').select('id,name').order('name'),
            supabase
              .from('attendance_pairs')
              .select(
                'id,school_id,pair_name,primary_section_id,completion_section_id,attendance_mode,active'
              )
              .order('pair_name'),
          ]);

        const firstError =
          ownerResult.error ||
          membershipResult.error ||
          instructorResult.error ||
          schoolResult.error ||
          pairResult.error;
        if (firstError) throw firstError;

        const isOwner = Boolean(ownerResult.data);
        const memberships = (membershipResult.data ?? []) as Membership[];
        const managementSchools = new Set(
          memberships
            .filter((membership) =>
              ['school_admin', 'program_lead'].includes(String(membership.role))
            )
            .map((membership) => membership.school_id)
        );
        const assignedSections = new Set(
          ((instructorResult.data ?? []) as SectionInstructor[]).map((row) => row.section_id)
        );
        const loadedPairs = (pairResult.data ?? []) as Pair[];
        const accessiblePairs = isOwner
          ? loadedPairs
          : loadedPairs.filter(
              (pair) =>
                managementSchools.has(pair.school_id) ||
                assignedSections.has(pair.primary_section_id) ||
                assignedSections.has(pair.completion_section_id)
            );

        const accessibleSchoolIds = new Set(accessiblePairs.map((pair) => pair.school_id));
        setSchools(
          ((schoolResult.data ?? []) as School[]).filter((school) => accessibleSchoolIds.has(school.id))
        );
        setPairs(accessiblePairs);
        setCanManageAny(isOwner || managementSchools.size > 0);
        await loadHistory(accessiblePairs, dateFrom, dateTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [dateFrom, dateTo, loadHistory, router, supabase]);

  const schoolMap = useMemo(() => new Map(schools.map((school) => [school.id, school])), [schools]);
  const pairMap = useMemo(() => new Map(pairs.map((pair) => [pair.id, pair])), [pairs]);
  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const queueMap = useMemo(() => new Map(reportQueue.map((queue) => [queue.session_id, queue])), [reportQueue]);
  const recordsBySession = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => {
      const current = map.get(record.session_id) ?? [];
      current.push(record);
      map.set(record.session_id, current);
    });
    return map;
  }, [records]);

  const pairsForSchool = useMemo(
    () => pairs.filter((pair) => schoolFilter === 'all' || pair.school_id === schoolFilter),
    [pairs, schoolFilter]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const visibleSessions = useMemo(() => {
    return sessions.filter((session) => {
      const pair = pairMap.get(session.pair_id);
      if (!pair) return false;
      if (schoolFilter !== 'all' && session.school_id !== schoolFilter) return false;
      if (pairFilter !== 'all' && session.pair_id !== pairFilter) return false;
      if (statusFilter !== 'all' && session.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const rows = recordsBySession.get(session.id) ?? [];
      return rows.some((record) =>
        includesSearch(studentMap.get(record.student_id), record, normalizedSearch)
      );
    });
  }, [sessions, pairMap, schoolFilter, pairFilter, statusFilter, normalizedSearch, recordsBySession, studentMap]);

  const visibleSessionGroups = useMemo(() => {
    const byPair = new Map<string, Session[]>();
    visibleSessions.forEach((session) => {
      const current = byPair.get(session.pair_id) ?? [];
      current.push(session);
      byPair.set(session.pair_id, current);
    });
    return pairsForSchool
      .filter((pair) => pairFilter === 'all' || pair.id === pairFilter)
      .map((pair) => ({ pair, sessions: byPair.get(pair.id) ?? [] }))
      .filter((group) => group.sessions.length > 0)
      .sort((a, b) => a.pair.pair_name.localeCompare(b.pair.pair_name));
  }, [visibleSessions, pairsForSchool, pairFilter]);

  const visibleRecordRows = useMemo(() => {
    const ids = new Set(visibleSessions.map((session) => session.id));
    return records.filter((record) => ids.has(record.session_id));
  }, [records, visibleSessions]);

  const overallCounts = useMemo(() => sessionCounts(visibleRecordRows), [visibleRecordRows]);

  const studentSummaries = useMemo(() => {
    const sessionIds = new Set(
      sessions
        .filter((session) => {
          if (schoolFilter !== 'all' && session.school_id !== schoolFilter) return false;
          if (pairFilter !== 'all' && session.pair_id !== pairFilter) return false;
          return true;
        })
        .map((session) => session.id)
    );

    const byStudent = new Map<string, AttendanceRecord[]>();
    records.forEach((record) => {
      if (!sessionIds.has(record.session_id)) return;
      const current = byStudent.get(record.student_id) ?? [];
      current.push(record);
      byStudent.set(record.student_id, current);
    });

    return Array.from(byStudent.entries())
      .map(([studentId, rows]) => {
        const student = studentMap.get(studentId);
        if (!student) return null;
        const counts = sessionCounts(rows);
        return { student, rows, counts };
      })
      .filter(
        (item): item is { student: Student; rows: AttendanceRecord[]; counts: SessionCounts } => Boolean(item)
      )
      .filter((item) => {
        if (!normalizedSearch) return true;
        return [item.student.display_name, item.student.external_student_id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => a.student.display_name.localeCompare(b.student.display_name));
  }, [sessions, schoolFilter, pairFilter, records, studentMap, normalizedSearch]);

  const selectedStudent = useMemo(
    () => studentSummaries.find((item) => item.student.id === selectedStudentId) ?? null,
    [studentSummaries, selectedStudentId]
  );

  const selectedStudentHistory = useMemo(() => {
    if (!selectedStudent) return [];
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));
    return selectedStudent.rows
      .map((record) => ({ record, session: sessionMap.get(record.session_id) }))
      .filter((item): item is { record: AttendanceRecord; session: Session } => Boolean(item.session))
      .sort((a, b) => b.session.attendance_date.localeCompare(a.session.attendance_date));
  }, [selectedStudent, sessions]);

  const refresh = async () => {
    await loadHistory(pairs, dateFrom, dateTo);
  };

  const resetFilters = () => {
    setSchoolFilter('all');
    setPairFilter('all');
    setStatusFilter('all');
    setSearch('');
    setSelectedStudentId('');
  };

  const renderSession = (session: Session) => {
    const pair = pairMap.get(session.pair_id);
    if (!pair) return null;
    const school = schoolMap.get(session.school_id);
    const rows = (recordsBySession.get(session.id) ?? []).slice().sort((a, b) => {
      const aName = studentMap.get(a.student_id)?.display_name ?? '';
      const bName = studentMap.get(b.student_id)?.display_name ?? '';
      return aName.localeCompare(bName);
    });
    const counts = sessionCounts(rows);
    const queue = queueMap.get(session.id);
    const attention = counts.absent + counts.late + counts.leftEarly + counts.partial + counts.flagged + counts.unmarked;

    return (
      <details className={styles.sessionCard} key={session.id} id={`session-${session.id}`}>
        <summary className={styles.sessionSummary}>
          <div className={styles.dateBlock}>
            <strong>{prettyDate(session.attendance_date)}</strong>
            <span>{pair.pair_name}</span>
            {school && schools.length > 1 && <small>{school.name}</small>}
          </div>
          <div className={styles.quickCounts}>
            <span className={styles.goodCount}>{counts.present} present</span>
            <span>{counts.absent} absent</span>
            <span>{counts.late} late</span>
            <span>{counts.excused} excused</span>
            {attention > 0 && <span className={styles.attentionCount}>{attention} needs review</span>}
          </div>
          <span className={session.status === 'finalized' ? styles.finalizedPill : styles.openPill}>
            {session.status === 'finalized' ? 'Finalized' : 'Open'}
          </span>
        </summary>

        <div className={styles.sessionBody}>
          <div className={styles.metadataGrid}>
            <div><span>Attendance taken</span><strong>{prettyDateTime(session.taken_at)}</strong></div>
            <div><span>Finalized</span><strong>{prettyDateTime(session.finalized_at)}</strong></div>
            <div><span>Mode</span><strong>{session.attendance_mode.toUpperCase()}</strong></div>
            <div>
              <span>PVHS report</span>
              <strong>
                {queue
                  ? `${queue.status}${queue.sent_at ? ` · ${prettyDateTime(queue.sent_at)}` : ''}`
                  : session.attendance_mode === 'pvhs'
                    ? 'No queue record visible'
                    : 'Not applicable'}
              </strong>
            </div>
          </div>

          {session.instructor_notes && (
            <div className={styles.classNote}>
              <span>Class note</span>
              <p>{session.instructor_notes}</p>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.recordTable}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Final Status</th>
                  <th>Flags</th>
                  <th>Instructor Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4}>No student records were stored for this session.</td></tr>
                ) : (
                  rows.map((record) => {
                    const student = studentMap.get(record.student_id);
                    const status = effectiveStatus(record);
                    return (
                      <tr key={record.id}>
                        <td>
                          <button
                            type="button"
                            className={styles.studentLink}
                            onClick={() => {
                              setPairFilter(session.pair_id);
                              setSelectedStudentId(record.student_id);
                              setView('student');
                              setSearch('');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <strong>{student?.display_name ?? 'Unknown student'}</strong>
                            {student?.external_student_id && <small>{student.external_student_id}</small>}
                          </button>
                        </td>
                        <td>
                          <span className={`${styles.statusText} ${styles[`status_${status}`] ?? ''}`}>
                            {statusLabel(status)}
                          </span>
                        </td>
                        <td>
                          {(record.completion_flags ?? []).length
                            ? record.completion_flags.map((flag) => FLAG_LABELS[flag] || flag).join(', ')
                            : 'None'}
                        </td>
                        <td>{record.notes || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.cardActions}>
            <a
              className={styles.linkButton}
              href={`/attendance?section=${encodeURIComponent(pair.completion_section_id)}&date=${encodeURIComponent(session.attendance_date)}`}
            >
              Open Original Attendance
            </a>
            {queue?.recipient_email && <span>Report recipient: {queue.recipient_email}</span>}
            {!queue?.recipient_email && session.report_recipient && <span>Report recipient: {session.report_recipient}</span>}
          </div>
        </div>
      </details>
    );
  };

  if (loading) return <main className={styles.page}>Loading attendance history…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>LTG Student Attendance</div>
          <h1>Attendance History</h1>
          <p>
            Review attendance by class instead of digging through one mixed timeline. Choose a class below, or leave All Classes selected to see each class in its own group.
          </p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.linkButton} href="/attendance">Take Attendance</a>
          {canManageAny && <a className={styles.linkButton} href="/attendance/admin">Administration</a>}
        </div>
      </header>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}

      <section className={styles.viewTabs} aria-label="Attendance history view">
        <button type="button" className={view === 'daily' ? styles.activeTab : styles.tab} onClick={() => setView('daily')}>
          Daily Records
        </button>
        <button type="button" className={view === 'student' ? styles.activeTab : styles.tab} onClick={() => setView('student')}>
          Student Lookup
        </button>
      </section>

      <section
        style={{
          border: '1px solid var(--ltg-border-soft, #314657)',
          background: 'var(--ltg-surface, #172b3a)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}
        aria-label="Choose attendance class"
      >
        <div className={styles.eyebrow} style={{ marginBottom: 8 }}>Choose Class</div>
        <div className={styles.viewTabs} style={{ marginBottom: 0, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={pairFilter === 'all' ? styles.activeTab : styles.tab}
            onClick={() => {
              setPairFilter('all');
              setSelectedStudentId('');
            }}
          >
            All Classes
          </button>
          {pairsForSchool.map((pair) => (
            <button
              type="button"
              key={pair.id}
              className={pairFilter === pair.id ? styles.activeTab : styles.tab}
              onClick={() => {
                setPairFilter(pair.id);
                setSelectedStudentId('');
              }}
            >
              {classLabel(pair)}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.filters}>
        <label className={styles.field}>
          School
          <select
            value={schoolFilter}
            onChange={(event) => {
              setSchoolFilter(event.target.value);
              setPairFilter('all');
              setSelectedStudentId('');
            }}
          >
            <option value="all">All accessible schools</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </label>

        <label className={styles.field}>
          Class pair
          <select
            value={pairFilter}
            onChange={(event) => {
              setPairFilter(event.target.value);
              setSelectedStudentId('');
            }}
          >
            <option value="all">All class pairs</option>
            {pairsForSchool.map((pair) => (
              <option key={pair.id} value={pair.id}>{pair.pair_name}{pair.active ? '' : ' · inactive'}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className={styles.field}>
          Through
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <label className={styles.field}>
          Record status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All records</option>
            <option value="finalized">Finalized only</option>
            <option value="draft">Open only</option>
          </select>
        </label>
        <label className={`${styles.field} ${styles.searchField}`}>
          Search student, ID, note, or flag
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (view === 'student') setSelectedStudentId('');
            }}
            placeholder="McEvoy, 2001756, left early…"
          />
        </label>
        <div className={styles.filterActions}>
          <button type="button" className={styles.primaryButton} onClick={refresh} disabled={busy}>
            {busy ? 'Loading…' : 'Refresh Dates'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={resetFilters} disabled={busy}>
            Clear Filters
          </button>
        </div>
      </section>

      <section className={styles.stats} aria-label="Attendance summary">
        <div><span>Days</span><strong>{visibleSessions.length}</strong></div>
        <div><span>Present</span><strong>{overallCounts.present}</strong></div>
        <div><span>Absent</span><strong>{overallCounts.absent}</strong></div>
        <div><span>Late</span><strong>{overallCounts.late}</strong></div>
        <div><span>Excused</span><strong>{overallCounts.excused}</strong></div>
        <div><span>Partial / Left Early</span><strong>{overallCounts.partial + overallCounts.leftEarly}</strong></div>
        <div><span>Flagged</span><strong>{overallCounts.flagged}</strong></div>
        <div><span>Not Recorded</span><strong>{overallCounts.unmarked}</strong></div>
      </section>

      {view === 'daily' ? (
        <section className={styles.historyList}>
          {visibleSessionGroups.length === 0 ? (
            <div className={styles.empty}>No attendance sessions match the selected filters and date range.</div>
          ) : (
            visibleSessionGroups.map(({ pair, sessions: groupedSessions }) => {
              const groupRows = groupedSessions.flatMap((session) => recordsBySession.get(session.id) ?? []);
              const counts = sessionCounts(groupRows);
              return (
                <section
                  key={pair.id}
                  style={{
                    border: '1px solid var(--ltg-border, #415668)',
                    background: 'var(--ltg-surface-2, #1d3242)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <header
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      padding: '2px 2px 4px',
                    }}
                  >
                    <div>
                      <div className={styles.eyebrow}>Class Attendance</div>
                      <h2 style={{ margin: '3px 0 2px', fontSize: 22 }}>{classLabel(pair)}</h2>
                      <span style={{ color: 'var(--ltg-muted, #b4bec6)', fontSize: 12 }}>{pair.pair_name}</span>
                    </div>
                    <div className={styles.quickCounts}>
                      <span>{groupedSessions.length} day{groupedSessions.length === 1 ? '' : 's'}</span>
                      <span className={styles.goodCount}>{counts.present} present</span>
                      <span>{counts.absent} absent</span>
                      <span>{counts.late} late</span>
                    </div>
                  </header>
                  <div className={styles.historyList}>{groupedSessions.map(renderSession)}</div>
                </section>
              );
            })
          )}
        </section>
      ) : (
        <section className={styles.studentWorkspace}>
          <aside className={styles.studentList}>
            <div className={styles.studentListHeader}>
              <strong>Students in selected class history</strong>
              <span>{studentSummaries.length} found</span>
            </div>
            {studentSummaries.length === 0 ? (
              <div className={styles.emptySmall}>No students match the current filters.</div>
            ) : (
              studentSummaries.map((item) => {
                const attended = item.counts.present + item.counts.late + item.counts.leftEarly + item.counts.partial;
                return (
                  <button
                    type="button"
                    key={item.student.id}
                    className={selectedStudentId === item.student.id ? styles.activeStudent : styles.studentRow}
                    onClick={() => setSelectedStudentId(item.student.id)}
                  >
                    <span>
                      <strong>{item.student.display_name}</strong>
                      {item.student.external_student_id && <small>{item.student.external_student_id}</small>}
                    </span>
                    <span>{attended} attended · {item.counts.absent} absent</span>
                  </button>
                );
              })
            )}
          </aside>

          <div className={styles.studentDetail}>
            {!selectedStudent ? (
              <div className={styles.empty}>Choose a class above, then select a student to see that student's attendance history.</div>
            ) : (
              <>
                <header className={styles.studentHeader}>
                  <div>
                    <div className={styles.eyebrow}>Student Attendance Record</div>
                    <h2>{selectedStudent.student.display_name}</h2>
                    {selectedStudent.student.external_student_id && <p>ID {selectedStudent.student.external_student_id}</p>}
                  </div>
                  <div className={styles.studentTotals}>
                    <div><span>Present</span><strong>{selectedStudent.counts.present}</strong></div>
                    <div><span>Absent</span><strong>{selectedStudent.counts.absent}</strong></div>
                    <div><span>Late</span><strong>{selectedStudent.counts.late}</strong></div>
                    <div><span>Excused</span><strong>{selectedStudent.counts.excused}</strong></div>
                    <div><span>Partial / Left Early</span><strong>{selectedStudent.counts.partial + selectedStudent.counts.leftEarly}</strong></div>
                    <div><span>Flags</span><strong>{selectedStudent.counts.flagged}</strong></div>
                  </div>
                </header>

                <div className={styles.tableWrap}>
                  <table className={styles.recordTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Class Pair</th>
                        <th>Status</th>
                        <th>Flags</th>
                        <th>Instructor Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudentHistory.map(({ record, session }) => {
                        const pair = pairMap.get(session.pair_id);
                        const status = effectiveStatus(record);
                        return (
                          <tr key={record.id}>
                            <td>{prettyDate(session.attendance_date)}</td>
                            <td>{pair?.pair_name ?? 'Class pair'}</td>
                            <td><span className={`${styles.statusText} ${styles[`status_${status}`] ?? ''}`}>{statusLabel(status)}</span></td>
                            <td>
                              {(record.completion_flags ?? []).length
                                ? record.completion_flags.map((flag) => FLAG_LABELS[flag] || flag).join(', ')
                                : 'None'}
                            </td>
                            <td>{record.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
