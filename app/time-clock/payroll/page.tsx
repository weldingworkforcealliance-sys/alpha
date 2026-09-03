'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import styles from './payroll.module.css';

type School = { id: string; name: string };
type Membership = { school_id: string; role: string; status: string };
type Report = {
  id: string;
  school_id: string;
  week_start: string;
  week_end: string;
  timezone: string;
  status: 'draft' | 'finalized';
  employee_count: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_hours: number;
  open_shift_count: number;
  adjusted_entry_count: number;
  long_shift_count: number;
  generated_at: string;
  finalized_at: string | null;
  adp_exported_at: string | null;
};
type ReportLine = {
  id: string;
  report_id: string;
  school_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  employee_code_snapshot: string | null;
  daily_hours: Record<string, number>;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  open_shift_count: number;
  adjusted_entry_count: number;
  long_shift_count: number;
};
type ReportEntry = {
  id: string;
  report_id: string;
  report_line_id: string;
  employee_id: string;
  clock_in_at_snapshot: string;
  clock_out_at_snapshot: string | null;
  clock_in_method_snapshot: string;
  clock_out_method_snapshot: string | null;
  hours_snapshot: number;
  adjustment_count: number;
  open_shift: boolean;
  long_shift: boolean;
  cross_midnight: boolean;
};

const MANAGER_ROLES = new Set(['school_admin', 'program_lead', 'lead_instructor']);

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayOf(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  copy.setHours(0, 0, 0, 0);
  return dateKey(copy);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function PayrollPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [weekStart, setWeekStart] = useState(mondayOf);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');

  const canManageSelected = useMemo(
    () => memberships.some((m) => m.school_id === schoolId && m.status === 'active' && MANAGER_ROLES.has(m.role)),
    [memberships, schoolId]
  );

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  const selectedLine = useMemo(
    () => lines.find((line) => line.id === selectedLineId) ?? null,
    [lines, selectedLineId]
  );

  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.report_line_id === selectedLineId),
    [entries, selectedLineId]
  );

  const dayKeys = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedReport?.week_start ?? weekStart, index)), [selectedReport?.week_start, weekStart]);

  const loadReports = useCallback(async () => {
    if (!schoolId) return;
    setError('');
    const { data, error: reportError } = await supabase
      .from('timeclock_weekly_reports')
      .select('id,school_id,week_start,week_end,timezone,status,employee_count,total_regular_hours,total_overtime_hours,total_hours,open_shift_count,adjusted_entry_count,long_shift_count,generated_at,finalized_at,adp_exported_at')
      .eq('school_id', schoolId)
      .order('week_start', { ascending: false })
      .limit(60);

    if (reportError) {
      setError(reportError.message);
      return;
    }

    const loaded = (data ?? []) as Report[];
    setReports(loaded);
    setSelectedReportId((current) => {
      if (current && loaded.some((report) => report.id === current)) return current;
      const matchingWeek = loaded.find((report) => report.week_start === weekStart);
      return matchingWeek?.id ?? loaded[0]?.id ?? '';
    });
  }, [schoolId, supabase, weekStart]);

  const loadReportDetails = useCallback(async () => {
    if (!selectedReportId) {
      setLines([]);
      setEntries([]);
      setSelectedLineId('');
      return;
    }

    const [lineResult, entryResult] = await Promise.all([
      supabase
        .from('timeclock_weekly_report_lines')
        .select('id,report_id,school_id,employee_id,employee_name_snapshot,employee_code_snapshot,daily_hours,regular_hours,overtime_hours,total_hours,open_shift_count,adjusted_entry_count,long_shift_count')
        .eq('report_id', selectedReportId)
        .order('employee_name_snapshot'),
      supabase
        .from('timeclock_weekly_report_entries')
        .select('id,report_id,report_line_id,employee_id,clock_in_at_snapshot,clock_out_at_snapshot,clock_in_method_snapshot,clock_out_method_snapshot,hours_snapshot,adjustment_count,open_shift,long_shift,cross_midnight')
        .eq('report_id', selectedReportId)
        .order('clock_in_at_snapshot'),
    ]);

    const detailError = lineResult.error || entryResult.error;
    if (detailError) {
      setError(detailError.message);
      return;
    }

    const loadedLines = (lineResult.data ?? []) as ReportLine[];
    setLines(loadedLines);
    setEntries((entryResult.data ?? []) as ReportEntry[]);
    setSelectedLineId((current) => {
      if (current && loadedLines.some((line) => line.id === current)) return current;
      return loadedLines[0]?.id ?? '';
    });
  }, [selectedReportId, supabase]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.push('/login');
          return;
        }
        const userId = sessionData.session.user.id;
        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
        ]);
        if (membershipResult.error) throw membershipResult.error;
        const owner = Boolean(ownerResult.data);
        const loadedMemberships = (membershipResult.data ?? []) as Membership[];
        setIsOwner(owner);
        setMemberships(loadedMemberships);

        const managerSchoolIds = loadedMemberships.filter((m) => MANAGER_ROLES.has(m.role)).map((m) => m.school_id);
        const schoolResult = owner
          ? await supabase.from('schools').select('id,name').eq('status', 'active').order('name')
          : managerSchoolIds.length
            ? await supabase.from('schools').select('id,name').in('id', managerSchoolIds).order('name')
            : { data: [], error: null };

        if (schoolResult.error) throw schoolResult.error;
        const loadedSchools = (schoolResult.data ?? []) as School[];
        setSchools(loadedSchools);
        setSchoolId(loadedSchools[0]?.id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to open payroll reporting.');
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [router, supabase]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadReportDetails();
  }, [loadReportDetails]);

  const generateReport = async () => {
    if (!canManageSelected || !schoolId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: rpcError } = await supabase.rpc('timeclock_generate_weekly_report', {
        p_school_id: schoolId,
        p_week_start: weekStart,
      });
      if (rpcError) throw rpcError;
      setNotice('Weekly payroll report generated from the current punch record.');
      await loadReports();
      if (data) setSelectedReportId(String(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate payroll report.');
    } finally {
      setBusy(false);
    }
  };

  const finalizeReport = async () => {
    if (!canManageSelected || !selectedReport) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('timeclock_finalize_weekly_report', {
        p_report_id: selectedReport.id,
      });
      if (rpcError) throw rpcError;
      setNotice('Payroll report finalized. Its snapshot is now locked for payroll and owner reporting.');
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finalize payroll report.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    if (!selectedReport) return;
    const header = [
      'Employee',
      'Employee Code',
      ...dayKeys,
      'Regular Hours',
      'Overtime Hours',
      'Total Hours',
      'Open Shifts',
      'Adjusted Entries',
      'Long Shifts',
      'Week Start',
      'Week End',
      'Report Status',
    ];
    const rows = lines.map((line) => [
      line.employee_name_snapshot,
      line.employee_code_snapshot ?? '',
      ...dayKeys.map((day) => Number(line.daily_hours?.[day] ?? 0).toFixed(2)),
      Number(line.regular_hours).toFixed(2),
      Number(line.overtime_hours).toFixed(2),
      Number(line.total_hours).toFixed(2),
      line.open_shift_count,
      line.adjusted_entry_count,
      line.long_shift_count,
      selectedReport.week_start,
      selectedReport.week_end,
      selectedReport.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ltg-payroll-${selectedReport.week_start}-to-${selectedReport.week_end}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    if (canManageSelected && selectedReport.status === 'finalized') {
      const { error: markError } = await supabase.rpc('timeclock_mark_weekly_report_exported', {
        p_report_id: selectedReport.id,
      });
      if (!markError) {
        setNotice('Payroll CSV downloaded and export recorded in the audit trail.');
        await loadReports();
      }
    }
  };

  if (loading) return <main className={styles.loading}>Opening payroll reporting…</main>;

  if (!schools.length) {
    return (
      <main className={styles.loading}>
        <div>
          <h1>Payroll Reports</h1>
          <p>This account does not have school payroll-report access.</p>
          <button onClick={() => router.push('/time-clock')}>Back to Time Clock</button>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Living Teacher Guide · Time Clock</div>
          <h1>Weekly Payroll Reports</h1>
          <p>{canManageSelected ? 'School payroll view: generate, review, finalize, and export the weekly employee record.' : 'Owner view: finalized school payroll reports retained for oversight and future analytics.'}</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => router.push('/time-clock')}>Employee Time Clock</button>
          {isOwner && <button onClick={() => router.push('/owner')}>Owner Dashboard</button>}
          {!isOwner && <button onClick={() => router.push('/school')}>School Dashboard</button>}
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}

        <section className={styles.controlBar}>
          <label>
            School
            <select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setSelectedReportId(''); }}>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </label>
          {canManageSelected && (
            <label>
              Week starting
              <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
            </label>
          )}
          {canManageSelected && (
            <button className={styles.primaryButton} disabled={busy} onClick={generateReport}>
              {busy ? 'Working…' : 'Generate / Refresh Week'}
            </button>
          )}
        </section>

        <div className={styles.layout}>
          <aside className={styles.archive}>
            <div className={styles.sectionHeading}>
              <div>
                <span>REPORT ARCHIVE</span>
                <h2>Payroll Weeks</h2>
              </div>
            </div>
            <div className={styles.reportList}>
              {reports.map((report) => (
                <button key={report.id} className={selectedReportId === report.id ? styles.reportActive : styles.reportItem} onClick={() => setSelectedReportId(report.id)}>
                  <strong>{formatDate(report.week_start)} – {formatDate(report.week_end)}</strong>
                  <span>{report.status === 'finalized' ? 'Finalized' : 'Draft'} · {Number(report.total_hours).toFixed(2)} hrs</span>
                </button>
              ))}
              {!reports.length && <div className={styles.empty}>No payroll reports are available yet.</div>}
            </div>
          </aside>

          <section className={styles.reportPanel}>
            {!selectedReport ? (
              <div className={styles.emptyLarge}>{canManageSelected ? 'Choose a week and generate the first payroll report.' : 'No finalized report is available for this school yet.'}</div>
            ) : (
              <>
                <div className={styles.reportHeader}>
                  <div>
                    <span className={styles.kicker}>WEEKLY PAYROLL</span>
                    <h2>{formatDate(selectedReport.week_start)} – {formatDate(selectedReport.week_end)}</h2>
                    <p>Generated {formatDateTime(selectedReport.generated_at)} · {selectedReport.timezone}</p>
                  </div>
                  <div className={styles.reportActions}>
                    <span className={selectedReport.status === 'finalized' ? styles.finalizedBadge : styles.draftBadge}>{selectedReport.status.toUpperCase()}</span>
                    {canManageSelected && selectedReport.status === 'draft' && (
                      <button disabled={busy || selectedReport.open_shift_count > 0} onClick={finalizeReport}>Finalize Payroll</button>
                    )}
                    {selectedReport.status === 'finalized' && (
                      <button onClick={exportCsv}>{canManageSelected ? 'Export for ADP' : 'Download Finalized CSV'}</button>
                    )}
                  </div>
                </div>

                <div className={styles.metrics}>
                  <div><span>Employees</span><strong>{selectedReport.employee_count}</strong></div>
                  <div><span>Regular Hours</span><strong>{Number(selectedReport.total_regular_hours).toFixed(2)}</strong></div>
                  <div><span>OT Hours</span><strong>{Number(selectedReport.total_overtime_hours).toFixed(2)}</strong></div>
                  <div><span>Total Hours</span><strong>{Number(selectedReport.total_hours).toFixed(2)}</strong></div>
                </div>

                {(selectedReport.open_shift_count > 0 || selectedReport.adjusted_entry_count > 0 || selectedReport.long_shift_count > 0) && (
                  <div className={styles.exceptions}>
                    <strong>Payroll review flags</strong>
                    <span>{selectedReport.open_shift_count} open shift(s)</span>
                    <span>{selectedReport.adjusted_entry_count} adjusted entr{selectedReport.adjusted_entry_count === 1 ? 'y' : 'ies'}</span>
                    <span>{selectedReport.long_shift_count} long shift(s)</span>
                    {selectedReport.open_shift_count > 0 && <em>Open shifts must be resolved before finalization.</em>}
                  </div>
                )}

                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        {dayKeys.map((day) => <th key={day}>{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}<br /><small>{day.slice(5)}</small></th>)}
                        <th>Reg</th>
                        <th>OT</th>
                        <th>Total</th>
                        <th>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className={selectedLineId === line.id ? styles.selectedRow : undefined} onClick={() => setSelectedLineId(line.id)}>
                          <td><strong>{line.employee_name_snapshot}</strong><small>{line.employee_code_snapshot ?? ''}</small></td>
                          {dayKeys.map((day) => <td key={day}>{Number(line.daily_hours?.[day] ?? 0).toFixed(2)}</td>)}
                          <td>{Number(line.regular_hours).toFixed(2)}</td>
                          <td>{Number(line.overtime_hours).toFixed(2)}</td>
                          <td><strong>{Number(line.total_hours).toFixed(2)}</strong></td>
                          <td>{line.open_shift_count > 0 ? 'Open ' : ''}{line.adjusted_entry_count > 0 ? 'Adj ' : ''}{line.long_shift_count > 0 ? 'Long' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedLine && (
                  <div className={styles.detailPanel}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <span>PUNCH DETAIL</span>
                        <h3>{selectedLine.employee_name_snapshot}</h3>
                      </div>
                      <strong>{Number(selectedLine.total_hours).toFixed(2)} hrs</strong>
                    </div>
                    <div className={styles.detailTableWrap}>
                      <table>
                        <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Source</th><th>Review</th></tr></thead>
                        <tbody>
                          {selectedEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{new Date(entry.clock_in_at_snapshot).toLocaleDateString('en-US')}</td>
                              <td>{formatTime(entry.clock_in_at_snapshot)}</td>
                              <td>{formatTime(entry.clock_out_at_snapshot)}</td>
                              <td>{Number(entry.hours_snapshot).toFixed(2)}</td>
                              <td>{entry.clock_in_method_snapshot}{entry.clock_out_method_snapshot ? ` / ${entry.clock_out_method_snapshot}` : ''}</td>
                              <td>{entry.open_shift ? 'OPEN ' : ''}{entry.adjustment_count > 0 ? `Adjusted(${entry.adjustment_count}) ` : ''}{entry.long_shift ? 'Long ' : ''}{entry.cross_midnight ? 'Cross-midnight' : ''}</td>
                            </tr>
                          ))}
                          {!selectedEntries.length && <tr><td colSpan={6} className={styles.emptyCell}>No punches recorded for this employee in the selected week.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className={styles.auditStrip}>
                  <span>Finalized: {formatDateTime(selectedReport.finalized_at)}</span>
                  <span>ADP export recorded: {formatDateTime(selectedReport.adp_exported_at)}</span>
                  <span>Report ID: {selectedReport.id}</span>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
