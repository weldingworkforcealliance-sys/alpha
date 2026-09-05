'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { AttendanceRecord, AttendanceSession, AttendanceStatus } from '@/lib/attendance';
import styles from './attendance-confirmation-modal.module.css';

type Props = {
  attendanceGroupId: string;
  groupName: string;
  courseLabels: string[];
  attendanceDate: string;
  onCancel: () => void;
  onComplete: (result: { email_state: string; report_due_at: string | null }) => void;
};

type SessionPayload = {
  session: AttendanceSession;
  records: AttendanceRecord[];
};

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'unmarked', label: 'Not Confirmed' },
  { value: 'present', label: 'Completed Full Pair Day — Present' },
  { value: 'left_early', label: 'Left Early' },
  { value: 'tardy', label: 'Arrived Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
  { value: 'not_scheduled', label: 'Not Scheduled' },
];

const QUICK_NOTES = [
  'Unprepared for class',
  'Left early',
  'Left class area / could not be located',
  'Missing required PPE or materials',
];

function appendNote(current: string | null, note: string) {
  const existing = (current ?? '').trim();
  if (!existing) return note;
  if (existing.toLowerCase().includes(note.toLowerCase())) return existing;
  return `${existing}; ${note}`;
}

export default function AttendanceConfirmationModal({
  attendanceGroupId,
  groupName,
  courseLabels,
  attendanceDate,
  onCancel,
  onComplete,
}: Props) {
  const [supabase] = useState(getSupabase);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unmarked = useMemo(
    () => records.filter((record) => record.attendance_status === 'unmarked').length,
    [records]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const { data: sessionId, error: openError } = await supabase.rpc('open_attendance_session', {
          p_attendance_group_id: attendanceGroupId,
          p_attendance_date: attendanceDate,
        });
        if (openError) throw openError;
        const { data, error: loadError } = await supabase.rpc('get_attendance_session', {
          p_attendance_session_id: sessionId,
        });
        if (loadError) throw loadError;
        const payload = data as SessionPayload;
        setSession(payload.session);
        setRecords(payload.records ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Attendance confirmation could not be opened.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [attendanceDate, attendanceGroupId, supabase]);

  const updateRecord = (id: string, patch: Partial<AttendanceRecord>) => {
    setRecords((current) =>
      current.map((record) => (record.id === id ? { ...record, ...patch } : record))
    );
  };

  const confirmAllCompleted = () => {
    setRecords((current) =>
      current.map((record) => ({
        ...record,
        attendance_status:
          record.attendance_status === 'unmarked' ? 'present' : record.attendance_status,
      }))
    );
  };

  const saveAndFinalize = async () => {
    if (!session || unmarked > 0) return;
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
      const { data, error: finalizeError } = await supabase.rpc('finalize_attendance_session', {
        p_attendance_session_id: session.id,
      });
      if (finalizeError) throw finalizeError;
      onComplete(data as { email_state: string; report_due_at: string | null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance could not be finalized.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="attendance-confirmation-title">
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Required Before Completing Class</div>
            <h2 id="attendance-confirmation-title">Confirm Paired-Day Attendance</h2>
            <p>
              {groupName} · {courseLabels.join(' / ')} ·{' '}
              {new Date(`${attendanceDate}T12:00:00`).toLocaleDateString()}
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy}>Return to Planner</button>
        </header>

        <div className={styles.explanation}>
          Confirming <strong>Completed Full Pair Day</strong> counts the student present for the entire linked WLD pair.
          Change exceptions and add factual notes before continuing.
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {loading ? (
          <div className={styles.loading}>Loading class roster…</div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <strong>{records.length} students · {unmarked} not confirmed</strong>
              <button type="button" className={styles.confirmAll} onClick={confirmAllCompleted} disabled={busy}>
                Confirm All Completed Full Day
              </button>
            </div>

            <div className={styles.roster}>
              {records.map((record) => (
                <article key={record.id} className={record.attendance_status === 'unmarked' ? styles.needsConfirmation : ''}>
                  <div className={styles.student}>
                    <strong>{record.student_name}</strong>
                    <small>{record.external_student_id || 'No Student ID'}</small>
                  </div>
                  <label>
                    <span>Day Confirmation</span>
                    <select
                      value={record.attendance_status}
                      disabled={busy}
                      onChange={(event) =>
                        updateRecord(record.id, {
                          attendance_status: event.target.value as AttendanceStatus,
                          departure_time: event.target.value === 'left_early' ? record.departure_time : null,
                          arrival_time: event.target.value === 'tardy' ? record.arrival_time : null,
                        })
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  {(record.attendance_status === 'left_early' || record.attendance_status === 'tardy') && (
                    <label className={styles.timeField}>
                      <span>{record.attendance_status === 'left_early' ? 'Departure Time' : 'Arrival Time'}</span>
                      <input
                        type="time"
                        value={(record.attendance_status === 'left_early' ? record.departure_time : record.arrival_time)?.slice(0, 5) ?? ''}
                        disabled={busy}
                        onChange={(event) =>
                          updateRecord(
                            record.id,
                            record.attendance_status === 'left_early'
                              ? { departure_time: event.target.value || null }
                              : { arrival_time: event.target.value || null }
                          )
                        }
                      />
                    </label>
                  )}
                  <label className={styles.noteField}>
                    <span>Instructor Note</span>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={record.note ?? ''}
                      disabled={busy}
                      placeholder="Example: Unprepared; missing PPE; left class area; instructor follow-up needed."
                      onChange={(event) => updateRecord(record.id, { note: event.target.value })}
                    />
                    <div className={styles.quickNotes}>
                      {QUICK_NOTES.map((note) => (
                        <button
                          type="button"
                          key={note}
                          disabled={busy}
                          onClick={() => updateRecord(record.id, { note: appendNote(record.note, note) })}
                        >
                          + {note}
                        </button>
                      ))}
                    </div>
                  </label>
                </article>
              ))}
              {!records.length && <div className={styles.loading}>No active students are assigned to this class pair.</div>}
            </div>

            <footer className={styles.footer}>
              <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
              <button
                type="button"
                className={styles.finalize}
                disabled={busy || !records.length || unmarked > 0}
                onClick={saveAndFinalize}
              >
                {busy ? 'Saving…' : 'Confirm Attendance & Complete Class Day'}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
