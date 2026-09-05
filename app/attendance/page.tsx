'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import {
  ATTENDANCE_STATUSES,
  AttendanceGroup,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  attendanceStatusLabel,
  localDateInputValue,
} from '@/lib/attendance';
import styles from './attendance.module.css';

type SessionPayload = {
  session: AttendanceSession;
  records: AttendanceRecord[];
};

type FinalizeResult = {
  status: string;
  email_state: 'queued' | 'configuration_required' | 'not_required';
  report_due_at: string | null;
};

function timeLabel(value: string | null) {
  if (!value) return '';
  const [hour = '0', minute = '00'] = value.split(':');
  return new Date(2000, 0, 1, Number(hour), Number(minute)).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function StudentAttendancePage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [groups, setGroups] = useState<AttendanceGroup[]>([]);
  const [groupId, setGroupId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(localDateInputValue);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canManageAttendance, setCanManageAttendance] = useState(false);

  const selectedGroup = groups.find((group) => group.id === groupId) ?? null;
  const locked = Boolean(session?.report_sent_at);

  const totals = useMemo(() => {
    const result = new Map<AttendanceStatus, number>();
    ATTENDANCE_STATUSES.forEach((status) => result.set(status, 0));
    records.forEach((record) => {
      result.set(record.attendance_status, (result.get(record.attendance_status) ?? 0) + 1);
    });
    return result;
  }, [records]);

  const loadSession = async (sessionId: string) => {
    const { data, error: loadError } = await supabase.rpc('get_attendance_session', {
      p_attendance_session_id: sessionId,
    });
    if (loadError) throw loadError;
    const payload = data as SessionPayload;
    setSession(payload.session);
    setRecords(payload.records ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        if (!authData.session) {
          router.replace('/login');
          return;
        }
        const [groupResult, ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('list_attendance_groups'),
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('role,status')
            .eq('user_id', authData.session.user.id)
            .eq('status', 'active'),
        ]);
        const { data, error: groupError } = groupResult;
        if (groupError) throw groupError;
        setCanManageAttendance(
          Boolean(ownerResult.data) ||
            (membershipResult.data ?? []).some(
              (membership: { role: string }) => membership.role === 'school_admin'
            )
        );
        const loadedGroups = (data ?? []) as AttendanceGroup[];
        setGroups(loadedGroups);
        setGroupId(loadedGroups[0]?.id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Attendance could not be opened.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, supabase]);

  useEffect(() => {
    setSession(null);
    setRecords([]);
    setNotice('');
  }, [groupId, attendanceDate]);

  const openRoster = async () => {
    if (!groupId || !attendanceDate) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: openError } = await supabase.rpc('open_attendance_session', {
        p_attendance_group_id: groupId,
        p_attendance_date: attendanceDate,
      });
      if (openError) throw openError;
      await loadSession(data as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The roster could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

  const updateRecord = (recordId: string, patch: Partial<AttendanceRecord>) => {
    setRecords((current) =>
      current.map((record) => (record.id === recordId ? { ...record, ...patch } : record))
    );
  };

  const markAllPresent = () => {
    setRecords((current) =>
      current.map((record) => ({ ...record, attendance_status: 'present' }))
    );
    setNotice('Everyone is marked present. Adjust exceptions before saving.');
  };

  const save = async (showNotice = true) => {
    if (!session) return false;
    setBusy(true);
    setError('');
    try {
      const payload = records.map((record) => ({
        id: record.id,
        attendance_status: record.attendance_status,
        arrival_time: record.arrival_time,
        departure_time: record.departure_time,
        note: record.note,
      }));
      const { error: saveError } = await supabase.rpc('save_attendance_records', {
        p_attendance_session_id: session.id,
        p_records: payload,
      });
      if (saveError) throw saveError;
      if (showNotice) setNotice('Attendance draft saved.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!session) return;
    if ((totals.get('unmarked') ?? 0) > 0) {
      setError('Every student must be marked before attendance is finalized.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = records.map((record) => ({
        id: record.id,
        attendance_status: record.attendance_status,
        arrival_time: record.arrival_time,
        departure_time: record.departure_time,
        note: record.note,
      }));
      const { error: saveError } = await supabase.rpc('save_attendance_records', {
        p_attendance_session_id: session.id,
        p_records: payload,
      });
      if (saveError) throw saveError;

      const { data, error: finalizeError } = await supabase.rpc('finalize_attendance_session', {
        p_attendance_session_id: session.id,
      });
      if (finalizeError) throw finalizeError;
      const result = data as FinalizeResult;
      await loadSession(session.id);

      if (result.email_state === 'queued' && result.report_due_at) {
        setNotice(
          `Attendance finalized. The PVHS report is scheduled for ${new Date(
            result.report_due_at
          ).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`
        );
      } else if (result.email_state === 'configuration_required') {
        setNotice(
          'Attendance finalized, but the PVHS email is not configured and confirmed. A school administrator must complete Email Settings.'
        );
      } else {
        setNotice('Attendance finalized.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance could not be finalized.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className={styles.loading}>Opening Student Attendance…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Living Teacher Guide</div>
          <h1>Student Attendance</h1>
          <p>One roster and one attendance entry for every linked class in the pair.</p>
        </div>
        <div className={styles.headerActions}>
          {canManageAttendance && (
            <button type="button" onClick={() => router.push('/school/attendance')}>
              Roster &amp; Settings
            </button>
          )}
          <button type="button" onClick={() => router.push('/dashboard')}>
            Back to Planner
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.setupPanel}>
        <label>
          <span>Class Pair</span>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {group.course_labels.join(' / ') || 'No classes linked'}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Attendance Date</span>
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => setAttendanceDate(event.target.value)}
          />
        </label>
        <button type="button" className={styles.primary} disabled={busy || !groupId} onClick={openRoster}>
          {session ? 'Reload Roster' : 'Open Roster'}
        </button>
      </section>

      {!groups.length && (
        <section className={styles.empty}>
          <h2>No attendance class pairs are assigned</h2>
          <p>A school administrator must create a class pair and add its roster first.</p>
        </section>
      )}

      {session && selectedGroup && (
        <>
          <section className={styles.summary}>
            <div>
              <span>Roster</span>
              <strong>{records.length}</strong>
            </div>
            <div>
              <span>Present</span>
              <strong>{totals.get('present') ?? 0}</strong>
            </div>
            <div>
              <span>Absent</span>
              <strong>{totals.get('absent') ?? 0}</strong>
            </div>
            <div>
              <span>Tardy</span>
              <strong>{totals.get('tardy') ?? 0}</strong>
            </div>
            <div className={(totals.get('unmarked') ?? 0) ? styles.warningMetric : ''}>
              <span>Unmarked</span>
              <strong>{totals.get('unmarked') ?? 0}</strong>
            </div>
          </section>

          <section className={styles.rosterPanel}>
            <div className={styles.rosterHeader}>
              <div>
                <div className={styles.eyebrow}>
                  {selectedGroup.attendance_mode === 'pvhs_daily_email'
                    ? 'PVHS Daily Email Attendance'
                    : 'Standard College Attendance'}
                </div>
                <h2>{selectedGroup.name}</h2>
                <p>{selectedGroup.course_labels.join(' / ')}</p>
              </div>
              <button type="button" disabled={busy || locked} onClick={markAllPresent}>
                Mark All Present
              </button>
            </div>

            {session.status === 'finalized' && !session.report_sent_at && (
              <div className={styles.pendingBanner}>
                Finalized. Corrections may still be saved until the report is sent
                {session.report_due_at
                  ? ` at ${new Date(session.report_due_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : ''}.
              </div>
            )}
            {locked && (
              <div className={styles.lockedBanner}>
                Report sent {session.report_sent_at ? new Date(session.report_sent_at).toLocaleString() : ''}.
                A school administrator must reopen attendance before making a correction.
              </div>
            )}

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Time Detail</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className={styles[record.attendance_status]}>
                      <td>
                        <strong>{record.student_name}</strong>
                        <small>{record.external_student_id || 'No Student ID'}</small>
                      </td>
                      <td>
                        <select
                          aria-label={`Attendance status for ${record.student_name}`}
                          value={record.attendance_status}
                          disabled={busy || locked}
                          onChange={(event) =>
                            updateRecord(record.id, {
                              attendance_status: event.target.value as AttendanceStatus,
                            })
                          }
                        >
                          {ATTENDANCE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {attendanceStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {record.attendance_status === 'tardy' ? (
                          <label className={styles.inlineField}>
                            <span>Arrival</span>
                            <input
                              type="time"
                              value={record.arrival_time?.slice(0, 5) ?? ''}
                              disabled={busy || locked}
                              onChange={(event) =>
                                updateRecord(record.id, { arrival_time: event.target.value || null })
                              }
                            />
                          </label>
                        ) : record.attendance_status === 'left_early' ? (
                          <label className={styles.inlineField}>
                            <span>Departure</span>
                            <input
                              type="time"
                              value={record.departure_time?.slice(0, 5) ?? ''}
                              disabled={busy || locked}
                              onChange={(event) =>
                                updateRecord(record.id, { departure_time: event.target.value || null })
                              }
                            />
                          </label>
                        ) : (
                          <span className={styles.muted}>
                            {record.arrival_time
                              ? `Arrived ${timeLabel(record.arrival_time)}`
                              : record.departure_time
                                ? `Left ${timeLabel(record.departure_time)}`
                                : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          maxLength={500}
                          placeholder="Optional note"
                          value={record.note ?? ''}
                          disabled={busy || locked}
                          onChange={(event) => updateRecord(record.id, { note: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!records.length && <div className={styles.empty}>This class pair has no active students.</div>}
            </div>

            <div className={styles.actions}>
              <button type="button" disabled={busy || locked || !records.length} onClick={() => save()}>
                Save Draft
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || locked || session.status === 'finalized' || !records.length || (totals.get('unmarked') ?? 0) > 0}
                onClick={finalize}
              >
                Finalize Attendance
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
