'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import styles from './reports.module.css';

type PeriodPreset = 'today' | 'week' | 'month' | 'quarter' | 'academic_year' | 'custom';

type School = {
  id: string;
  name: string;
};

type Membership = {
  school_id: string;
  role: string;
  status: string;
};

type ReportSnapshot = {
  id: string;
  school_id: string | null;
  report_scope: 'school' | 'platform';
  period_type: string;
  period_label: string;
  period_start: string;
  period_end: string;
  revision: number;
  status: 'draft' | 'finalized';
  payload: ReportingPayload;
  generated_at: string;
  finalized_at: string | null;
};

type SchoolSummary = {
  scope: 'school';
  school_id: string;
  school_name: string;
  timezone?: string;
  period: { start: string; end: string };
  instruction: {
    sections: number;
    scheduled_days: number;
    completed_days: number;
    instruction_minutes: number;
    instruction_hours: number;
    followups: number;
    missing_completed_days: number;
    archived_delivery_rows: number;
  };
  students: {
    active_students: number;
    attendance_sessions: number;
    attendance_finalized_sessions: number;
    attendance_records: number;
    present: number;
    absent: number;
    left_early: number;
    attendance_statuses?: Record<string, number>;
    attendance_rate_pct: number | null;
  };
  learning: {
    classroom_sessions: number;
    classroom_submissions: number;
    students_assessed: number;
    assessment_average_pct: number | null;
    job_card_sessions: number;
    job_card_submissions: number;
    job_card_accepted: number;
    job_card_recheck: number;
  };
  instructional_improvement: {
    instructor_notes: number;
    agenda_reviews: number;
    approved_changes: number;
  };
  workforce: {
    employee_hours: number;
    open_punches: number;
    adjusted_entries: number;
  };
  usage: {
    audit_events: number;
  };
  data_quality: {
    unfinalized_attendance_sessions: number;
    unlinked_classroom_submissions: number;
    unlinked_job_card_submissions: number;
    open_timeclock_punches: number;
    scheduled_days_without_completion: number;
    archived_delivery_rows_excluded_from_totals: number;
  };
};

type PlatformSummary = {
  scope: 'platform';
  period: { start: string; end: string };
  school_count: number;
  schools: SchoolSummary[];
};

type ReportingPayload = SchoolSummary | PlatformSummary;

type AggregateSummary = {
  schoolCount: number;
  sections: number;
  scheduledDays: number;
  completedDays: number;
  instructionHours: number;
  followups: number;
  activeStudents: number;
  attendanceSessions: number;
  attendanceFinalized: number;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceLeftEarly: number;
  attendanceRate: number | null;
  classroomSessions: number;
  classroomSubmissions: number;
  studentsAssessed: number;
  assessmentAverage: number | null;
  jobCardSessions: number;
  jobCardSubmissions: number;
  jobCardAccepted: number;
  jobCardRecheck: number;
  instructorNotes: number;
  agendaReviews: number;
  approvedChanges: number;
  employeeHours: number;
  openPunches: number;
  adjustedEntries: number;
  auditEvents: number;
  unfinalizedAttendance: number;
  unlinkedClassroom: number;
  unlinkedJobCards: number;
  missingCompletedDays: number;
  archivedDeliveryRows: number;
};

const VIEW_ROLES = new Set(['school_admin', 'program_lead', 'lead_instructor', 'viewer']);
const SAVE_ROLES = new Set(['school_admin', 'program_lead']);

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
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

function periodForPreset(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { start: dateKey(start), end: dateKey(end), label: 'Today' };
  }

  if (preset === 'week') {
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end), label: 'This Week' };
  }

  if (preset === 'month') {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
    return { start: dateKey(start), end: dateKey(end), label: 'This Month' };
  }

  if (preset === 'quarter') {
    const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    end.setMonth(quarterStartMonth + 3, 0);
    const quarter = Math.floor(quarterStartMonth / 3) + 1;
    return {
      start: dateKey(start),
      end: dateKey(end),
      label: `Calendar Q${quarter} ${start.getFullYear()}`,
    };
  }

  const academicStartYear = start.getMonth() >= 6 ? start.getFullYear() : start.getFullYear() - 1;
  start.setFullYear(academicStartYear, 6, 1);
  end.setFullYear(academicStartYear + 1, 5, 30);
  return {
    start: dateKey(start),
    end: dateKey(end),
    label: `Academic Year ${academicStartYear}–${academicStartYear + 1}`,
  };
}

function payloadSchools(payload: ReportingPayload | null): SchoolSummary[] {
  if (!payload) return [];
  return payload.scope === 'platform' ? payload.schools ?? [] : [payload];
}

function aggregatePayload(payload: ReportingPayload | null): AggregateSummary {
  const schools = payloadSchools(payload);
  const aggregate: AggregateSummary = {
    schoolCount: schools.length,
    sections: 0,
    scheduledDays: 0,
    completedDays: 0,
    instructionHours: 0,
    followups: 0,
    activeStudents: 0,
    attendanceSessions: 0,
    attendanceFinalized: 0,
    attendancePresent: 0,
    attendanceAbsent: 0,
    attendanceLeftEarly: 0,
    attendanceRate: null,
    classroomSessions: 0,
    classroomSubmissions: 0,
    studentsAssessed: 0,
    assessmentAverage: null,
    jobCardSessions: 0,
    jobCardSubmissions: 0,
    jobCardAccepted: 0,
    jobCardRecheck: 0,
    instructorNotes: 0,
    agendaReviews: 0,
    approvedChanges: 0,
    employeeHours: 0,
    openPunches: 0,
    adjustedEntries: 0,
    auditEvents: 0,
    unfinalizedAttendance: 0,
    unlinkedClassroom: 0,
    unlinkedJobCards: 0,
    missingCompletedDays: 0,
    archivedDeliveryRows: 0,
  };

  let assessmentWeightedTotal = 0;
  let assessmentWeight = 0;

  for (const school of schools) {
    aggregate.sections += Number(school.instruction?.sections ?? 0);
    aggregate.scheduledDays += Number(school.instruction?.scheduled_days ?? 0);
    aggregate.completedDays += Number(school.instruction?.completed_days ?? 0);
    aggregate.instructionHours += Number(school.instruction?.instruction_hours ?? 0);
    aggregate.followups += Number(school.instruction?.followups ?? 0);
    aggregate.activeStudents += Number(school.students?.active_students ?? 0);
    aggregate.attendanceSessions += Number(school.students?.attendance_sessions ?? 0);
    aggregate.attendanceFinalized += Number(school.students?.attendance_finalized_sessions ?? 0);
    aggregate.attendancePresent += Number(school.students?.present ?? 0);
    aggregate.attendanceAbsent += Number(school.students?.absent ?? 0);
    aggregate.attendanceLeftEarly += Number(school.students?.left_early ?? 0);
    aggregate.classroomSessions += Number(school.learning?.classroom_sessions ?? 0);
    aggregate.classroomSubmissions += Number(school.learning?.classroom_submissions ?? 0);
    aggregate.studentsAssessed += Number(school.learning?.students_assessed ?? 0);
    aggregate.jobCardSessions += Number(school.learning?.job_card_sessions ?? 0);
    aggregate.jobCardSubmissions += Number(school.learning?.job_card_submissions ?? 0);
    aggregate.jobCardAccepted += Number(school.learning?.job_card_accepted ?? 0);
    aggregate.jobCardRecheck += Number(school.learning?.job_card_recheck ?? 0);
    aggregate.instructorNotes += Number(school.instructional_improvement?.instructor_notes ?? 0);
    aggregate.agendaReviews += Number(school.instructional_improvement?.agenda_reviews ?? 0);
    aggregate.approvedChanges += Number(school.instructional_improvement?.approved_changes ?? 0);
    aggregate.employeeHours += Number(school.workforce?.employee_hours ?? 0);
    aggregate.openPunches += Number(school.workforce?.open_punches ?? 0);
    aggregate.adjustedEntries += Number(school.workforce?.adjusted_entries ?? 0);
    aggregate.auditEvents += Number(school.usage?.audit_events ?? 0);
    aggregate.unfinalizedAttendance += Number(school.data_quality?.unfinalized_attendance_sessions ?? 0);
    aggregate.unlinkedClassroom += Number(school.data_quality?.unlinked_classroom_submissions ?? 0);
    aggregate.unlinkedJobCards += Number(school.data_quality?.unlinked_job_card_submissions ?? 0);
    aggregate.missingCompletedDays += Number(school.data_quality?.scheduled_days_without_completion ?? 0);
    aggregate.archivedDeliveryRows += Number(school.data_quality?.archived_delivery_rows_excluded_from_totals ?? 0);

    const avg = school.learning?.assessment_average_pct;
    const weight = Number(school.learning?.classroom_submissions ?? 0);
    if (avg !== null && avg !== undefined && weight > 0) {
      assessmentWeightedTotal += Number(avg) * weight;
      assessmentWeight += weight;
    }
  }

  const attendanceDenominator =
    aggregate.attendancePresent + aggregate.attendanceAbsent + aggregate.attendanceLeftEarly;
  aggregate.attendanceRate = attendanceDenominator > 0
    ? Math.round((aggregate.attendancePresent * 1000) / attendanceDenominator) / 10
    : null;
  aggregate.assessmentAverage = assessmentWeight > 0
    ? Math.round((assessmentWeightedTotal * 10) / assessmentWeight) / 10
    : null;
  aggregate.instructionHours = Math.round(aggregate.instructionHours * 100) / 100;
  aggregate.employeeHours = Math.round(aggregate.employeeHours * 100) / 100;

  return aggregate;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function qualityIssueCount(summary: AggregateSummary) {
  return (
    summary.unfinalizedAttendance +
    summary.unlinkedClassroom +
    summary.unlinkedJobCards +
    summary.openPunches +
    summary.missingCompletedDays
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [preset, setPreset] = useState<PeriodPreset>('quarter');
  const initialQuarter = useMemo(() => periodForPreset('quarter'), []);
  const [startDate, setStartDate] = useState(initialQuarter.start);
  const [endDate, setEndDate] = useState(initialQuarter.end);
  const [periodLabel, setPeriodLabel] = useState(initialQuarter.label);
  const [livePayload, setLivePayload] = useState<ReportingPayload | null>(null);
  const [snapshotPayload, setSnapshotPayload] = useState<ReportingPayload | null>(null);
  const [viewingSnapshotId, setViewingSnapshotId] = useState('');
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);

  const selectedSchool = schools.find((school) => school.id === schoolId) ?? null;
  const isPlatformScope = isOwner && schoolId === 'all';
  const canSaveSelected = useMemo(() => {
    if (isOwner) return true;
    return memberships.some(
      (membership) =>
        membership.school_id === schoolId &&
        membership.status === 'active' &&
        SAVE_ROLES.has(membership.role)
    );
  }, [isOwner, memberships, schoolId]);

  const displayedPayload = snapshotPayload ?? livePayload;
  const aggregate = useMemo(() => aggregatePayload(displayedPayload), [displayedPayload]);
  const issueCount = qualityIssueCount(aggregate);

  const applyPreset = (nextPreset: Exclude<PeriodPreset, 'custom'>) => {
    const period = periodForPreset(nextPreset);
    setPreset(nextPreset);
    setStartDate(period.start);
    setEndDate(period.end);
    setPeriodLabel(period.label);
    setSnapshotPayload(null);
    setViewingSnapshotId('');
  };

  const loadSnapshots = useCallback(async () => {
    if (!schoolId) return;

    let query = supabase
      .from('ltg_report_snapshots')
      .select(
        'id,school_id,report_scope,period_type,period_label,period_start,period_end,revision,status,payload,generated_at,finalized_at'
      )
      .order('generated_at', { ascending: false })
      .limit(50);

    query = isOwner && schoolId === 'all'
      ? query.eq('report_scope', 'platform').is('school_id', null)
      : query.eq('report_scope', 'school').eq('school_id', schoolId);

    const { data, error: snapshotError } = await query;
    if (snapshotError) {
      setError(snapshotError.message);
      return;
    }

    setSnapshots((data ?? []) as ReportSnapshot[]);
  }, [isOwner, schoolId, supabase]);

  const loadSummary = useCallback(async () => {
    if (!schoolId || !startDate || !endDate) return;
    setDataLoading(true);
    setError('');

    try {
      const result = isOwner && schoolId === 'all'
        ? await supabase.rpc('get_ltg_platform_reporting_summary', {
            p_start_date: startDate,
            p_end_date: endDate,
          })
        : await supabase.rpc('get_ltg_reporting_summary', {
            p_school_id: schoolId,
            p_start_date: startDate,
            p_end_date: endDate,
          });

      if (result.error) throw result.error;
      setLivePayload(result.data as ReportingPayload);
      setSnapshotPayload(null);
      setViewingSnapshotId('');
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reporting summary.');
    } finally {
      setDataLoading(false);
    }
  }, [endDate, isOwner, loadSnapshots, schoolId, startDate, supabase]);

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

        if (ownerResult.error) throw ownerResult.error;
        if (membershipResult.error) throw membershipResult.error;

        const owner = Boolean(ownerResult.data);
        const loadedMemberships = (membershipResult.data ?? []) as Membership[];
        setIsOwner(owner);
        setMemberships(loadedMemberships);

        const viewSchoolIds = loadedMemberships
          .filter((membership) => VIEW_ROLES.has(membership.role))
          .map((membership) => membership.school_id);

        const schoolResult = owner
          ? await supabase.from('schools').select('id,name').order('name')
          : viewSchoolIds.length > 0
            ? await supabase.from('schools').select('id,name').in('id', viewSchoolIds).order('name')
            : { data: [], error: null };

        if (schoolResult.error) throw schoolResult.error;
        const loadedSchools = (schoolResult.data ?? []) as School[];
        setSchools(loadedSchools);
        setSchoolId(owner ? 'all' : loadedSchools[0]?.id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to open Reporting & Analytics.');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router, supabase]);

  useEffect(() => {
    if (!loading && schoolId) loadSummary();
  }, [loading, schoolId, startDate, endDate, loadSummary]);

  const generateSnapshot = async () => {
    if (!canSaveSelected || !schoolId) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const label = `${periodLabel} · ${formatDate(startDate)}–${formatDate(endDate)}`;
      const { data, error: rpcError } = await supabase.rpc('generate_ltg_report_snapshot', {
        p_school_id: isPlatformScope ? null : schoolId,
        p_period_type: preset,
        p_period_label: label,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (rpcError) throw rpcError;

      setNotice('Saved a frozen report snapshot. Live data can change; this saved revision will not.');
      await loadSnapshots();
      if (data) setViewingSnapshotId(String(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save report snapshot.');
    } finally {
      setBusy(false);
    }
  };

  const finalizeSnapshot = async (reportId: string) => {
    if (!canSaveSelected) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const { error: rpcError } = await supabase.rpc('finalize_ltg_report_snapshot', {
        p_report_id: reportId,
      });
      if (rpcError) throw rpcError;
      setNotice('Report finalized. The exact revision is retained as historical record.');
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finalize report.');
    } finally {
      setBusy(false);
    }
  };

  const viewSnapshot = (snapshot: ReportSnapshot) => {
    setSnapshotPayload(snapshot.payload);
    setViewingSnapshotId(snapshot.id);
    setNotice(`Viewing saved ${snapshot.status} revision ${snapshot.revision}.`);
  };

  const returnToLive = () => {
    setSnapshotPayload(null);
    setViewingSnapshotId('');
    setNotice('Viewing current live data.');
  };

  const downloadCsv = () => {
    if (!displayedPayload) return;
    const rows: unknown[][] = [[
      'School',
      'Period Start',
      'Period End',
      'Active Students',
      'Scheduled Days',
      'Completed Days',
      'Instruction Hours',
      'Attendance Rate %',
      'Assessment Average %',
      'Classroom Submissions',
      'Job Card Submissions',
      'Instructor Notes',
      'Approved Changes',
      'Employee Hours',
      'Follow-Ups',
      'Data Quality Issues',
    ]];

    for (const school of payloadSchools(displayedPayload)) {
      const schoolAggregate = aggregatePayload(school);
      rows.push([
        school.school_name,
        startDate,
        endDate,
        schoolAggregate.activeStudents,
        schoolAggregate.scheduledDays,
        schoolAggregate.completedDays,
        schoolAggregate.instructionHours,
        schoolAggregate.attendanceRate ?? '',
        schoolAggregate.assessmentAverage ?? '',
        schoolAggregate.classroomSubmissions,
        schoolAggregate.jobCardSubmissions,
        schoolAggregate.instructorNotes,
        schoolAggregate.approvedChanges,
        schoolAggregate.employeeHours,
        schoolAggregate.followups,
        qualityIssueCount(schoolAggregate),
      ]);
    }

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ltg-report-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className={styles.loading}>Opening Reporting &amp; Analytics…</main>;
  }

  if (!isOwner && schools.length === 0) {
    return (
      <main className={styles.loading}>
        <div>
          <h1>Reporting &amp; Analytics</h1>
          <p>This account does not have school reporting access.</p>
          <button onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>LTG · Reporting &amp; Analytics</div>
          <h1>Program Intelligence Center</h1>
          <p>
            One reporting workspace for instruction, attendance, learning outcomes, workforce,
            improvement activity, historical snapshots, and data-quality checks.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button onClick={() => window.print()}>Print / PDF</button>
          <button onClick={downloadCsv} disabled={!displayedPayload}>Download CSV</button>
          {snapshotPayload && <button onClick={returnToLive}>Return to Live</button>}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.controls}>
        <label>
          Scope
          <select
            value={schoolId}
            onChange={(event) => {
              setSchoolId(event.target.value);
              setSnapshotPayload(null);
              setViewingSnapshotId('');
            }}
          >
            {isOwner && <option value="all">All Schools · Owner View</option>}
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </label>

        <div className={styles.periodBlock}>
          <span className={styles.controlLabel}>Reporting Period</span>
          <div className={styles.presetRow}>
            {([
              ['today', 'Today'],
              ['week', 'Week'],
              ['month', 'Month'],
              ['quarter', 'Quarter'],
              ['academic_year', 'Academic Year'],
            ] as [Exclude<PeriodPreset, 'custom'>, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={preset === value ? styles.activePreset : ''}
                onClick={() => applyPreset(value)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={preset === 'custom' ? styles.activePreset : ''}
              onClick={() => {
                setPreset('custom');
                setPeriodLabel('Custom Period');
                setSnapshotPayload(null);
                setViewingSnapshotId('');
              }}
            >
              Custom
            </button>
          </div>
        </div>

        <label>
          Start
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setPreset('custom');
              setPeriodLabel('Custom Period');
              setStartDate(event.target.value);
            }}
          />
        </label>

        <label>
          End
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => {
              setPreset('custom');
              setPeriodLabel('Custom Period');
              setEndDate(event.target.value);
            }}
          />
        </label>

        {canSaveSelected && (
          <button
            className={styles.primaryAction}
            onClick={generateSnapshot}
            disabled={busy || dataLoading || !livePayload}
          >
            {busy ? 'Working…' : 'Save Report Snapshot'}
          </button>
        )}
      </section>

      <section className={styles.reportStatus}>
        <div>
          <strong>{snapshotPayload ? 'Saved Historical Report' : 'Live Reporting View'}</strong>
          <span>{periodLabel} · {formatDate(startDate)} through {formatDate(endDate)}</span>
        </div>
        <div>
          <strong>{isPlatformScope ? 'Platform Owner' : selectedSchool?.name ?? 'School'}</strong>
          <span>{dataLoading ? 'Refreshing data…' : `${aggregate.schoolCount} school${aggregate.schoolCount === 1 ? '' : 's'} in scope`}</span>
        </div>
      </section>

      <section className={styles.metricGrid}>
        <Metric label="Instruction Hours" value={aggregate.instructionHours.toFixed(1)} detail={`${aggregate.completedDays} completed days`} />
        <Metric label="Schedule Completion" value={aggregate.scheduledDays > 0 ? `${Math.round((aggregate.completedDays / aggregate.scheduledDays) * 100)}%` : '—'} detail={`${aggregate.completedDays} / ${aggregate.scheduledDays} scheduled`} />
        <Metric label="Active Students" value={aggregate.activeStudents} detail={`${aggregate.attendanceFinalized} finalized attendance sessions`} />
        <Metric label="Attendance Rate" value={aggregate.attendanceRate === null ? '—' : `${aggregate.attendanceRate.toFixed(1)}%`} detail={`${aggregate.attendancePresent} present records`} />
        <Metric label="Assessment Average" value={aggregate.assessmentAverage === null ? '—' : `${aggregate.assessmentAverage.toFixed(1)}%`} detail={`${aggregate.classroomSubmissions} submissions`} />
        <Metric label="Job Card Reviews" value={aggregate.jobCardSubmissions} detail={`${aggregate.jobCardAccepted} accepted · ${aggregate.jobCardRecheck} recheck`} />
        <Metric label="Instructor Notes" value={aggregate.instructorNotes} detail={`${aggregate.approvedChanges} approved changes`} />
        <Metric label="Employee Hours" value={aggregate.employeeHours.toFixed(1)} detail={`${aggregate.adjustedEntries} adjusted entries`} />
        <Metric label="Follow-Ups" value={aggregate.followups} detail="Instructional follow-up flags" warn={aggregate.followups > 0} />
        <Metric label="Data Quality" value={issueCount} detail={issueCount === 0 ? 'No current exceptions' : 'Items need review'} warn={issueCount > 0} />
      </section>

      <div className={styles.sectionGrid}>
        <ReportSection title="Instruction & Delivery">
          <StatRow label="Sections in scope" value={aggregate.sections} />
          <StatRow label="Scheduled instructional days" value={aggregate.scheduledDays} />
          <StatRow label="Completed instructional days" value={aggregate.completedDays} />
          <StatRow label="Actual instructional hours" value={aggregate.instructionHours.toFixed(2)} />
          <StatRow label="Follow-ups flagged" value={aggregate.followups} warn={aggregate.followups > 0} />
          <StatRow label="Scheduled days without completion" value={aggregate.missingCompletedDays} warn={aggregate.missingCompletedDays > 0} />
        </ReportSection>

        <ReportSection title="Students & Learning">
          <StatRow label="Active students" value={aggregate.activeStudents} />
          <StatRow label="Attendance sessions" value={aggregate.attendanceSessions} />
          <StatRow label="Finalized attendance sessions" value={aggregate.attendanceFinalized} />
          <StatRow label="Live Classroom sessions" value={aggregate.classroomSessions} />
          <StatRow label="Students assessed" value={aggregate.studentsAssessed} />
          <StatRow label="Job Card sessions" value={aggregate.jobCardSessions} />
        </ReportSection>

        <ReportSection title="Instructional Improvement">
          <StatRow label="Instructor notes captured" value={aggregate.instructorNotes} />
          <StatRow label="Agenda / implementation reviews" value={aggregate.agendaReviews} />
          <StatRow label="Approved changes" value={aggregate.approvedChanges} />
          <StatRow label="Recorded operational events" value={aggregate.auditEvents} />
        </ReportSection>

        <ReportSection title="Data Quality & Exceptions" warn={issueCount > 0}>
          <StatRow label="Unfinalized attendance sessions" value={aggregate.unfinalizedAttendance} warn={aggregate.unfinalizedAttendance > 0} />
          <StatRow label="Assessment submissions not linked to LTG student" value={aggregate.unlinkedClassroom} warn={aggregate.unlinkedClassroom > 0} />
          <StatRow label="Job Cards not linked to LTG student" value={aggregate.unlinkedJobCards} warn={aggregate.unlinkedJobCards > 0} />
          <StatRow label="Open employee punches" value={aggregate.openPunches} warn={aggregate.openPunches > 0} />
          <StatRow label="Archived delivery rows excluded from totals" value={aggregate.archivedDeliveryRows} />
        </ReportSection>
      </div>

      {displayedPayload?.scope === 'platform' && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.eyebrow}>Owner Comparison</div>
              <h2>School Breakdown</h2>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>School</th>
                  <th>Students</th>
                  <th>Completed Days</th>
                  <th>Instruction Hrs</th>
                  <th>Attendance</th>
                  <th>Assessment Avg</th>
                  <th>Follow-Ups</th>
                  <th>Quality Issues</th>
                </tr>
              </thead>
              <tbody>
                {displayedPayload.schools.map((school) => {
                  const row = aggregatePayload(school);
                  return (
                    <tr key={school.school_id}>
                      <td>{school.school_name}</td>
                      <td>{row.activeStudents}</td>
                      <td>{row.completedDays}</td>
                      <td>{row.instructionHours.toFixed(1)}</td>
                      <td>{row.attendanceRate === null ? '—' : `${row.attendanceRate.toFixed(1)}%`}</td>
                      <td>{row.assessmentAverage === null ? '—' : `${row.assessmentAverage.toFixed(1)}%`}</td>
                      <td>{row.followups}</td>
                      <td>{qualityIssueCount(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.eyebrow}>Historical Record</div>
            <h2>Saved Reports</h2>
            <p>Saved revisions retain the exact metrics that existed when the report was generated.</p>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className={styles.emptyState}>No saved reports exist for this scope yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Period</th>
                  <th>Revision</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Finalized</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className={viewingSnapshotId === snapshot.id ? styles.selectedRow : ''}>
                    <td>{snapshot.period_label}</td>
                    <td>{formatDate(snapshot.period_start)}–{formatDate(snapshot.period_end)}</td>
                    <td>R{snapshot.revision}</td>
                    <td><span className={snapshot.status === 'finalized' ? styles.finalized : styles.draft}>{snapshot.status}</span></td>
                    <td>{formatDateTime(snapshot.generated_at)}</td>
                    <td>{formatDateTime(snapshot.finalized_at)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button onClick={() => viewSnapshot(snapshot)}>View</button>
                        {canSaveSelected && snapshot.status === 'draft' && (
                          <button disabled={busy} onClick={() => finalizeSnapshot(snapshot.id)}>Finalize</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.methodology}>
        <strong>Reporting integrity rules</strong>
        <p>
          Current planner delivery records are authoritative for totals. Superseded delivery archive rows remain available for audit history but are excluded from instructional totals. Saved reports are versioned snapshots. Assessment and Job Card records are linked to the canonical LTG student only when the submitted student ID matches the school student record; unmatched submissions are surfaced as data-quality exceptions instead of being guessed into place.
        </p>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  warn?: boolean;
}) {
  return (
    <article className={`${styles.metric} ${warn ? styles.metricWarn : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ReportSection({
  title,
  children,
  warn = false,
}: {
  title: string;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <section className={`${styles.reportSection} ${warn ? styles.reportSectionWarn : ''}`}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function StatRow({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className={`${styles.statRow} ${warn ? styles.statWarn : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
