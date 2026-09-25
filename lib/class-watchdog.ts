export type WatchdogSeverity = 'start' | 'end' | 'overdue';

export type WatchdogRow = {
  sectionId: string;
  plannerDayId: string;
  scheduledDate: string;
  dayNumber: number | null;
  sectionLabel: string;
  courseLabel: string;
  startTime: string;
  endTime: string;
  deliveryStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  requiresFinalAttendance: boolean;
  attendanceFinalized: boolean;
  pairId: string | null;
  pairName: string | null;
  pairPrimarySectionId: string | null;
  pairCompletionSectionId: string | null;
};

export type WatchdogAlert = WatchdogRow & {
  severity: WatchdogSeverity;
  endMs: number;
  displayLabel: string;
};

function localDateTime(date: string, time: string) {
  const normalized = time.length >= 8 ? time.slice(0, 8) : time;
  return new Date(`${date}T${normalized}`).getTime();
}

function alertForRow(row: WatchdogRow, nowMs: number): WatchdogAlert | null {
  const startMs = localDateTime(row.scheduledDate, row.startTime);
  const endMs = localDateTime(row.scheduledDate, row.endTime);
  const completed = row.deliveryStatus === 'completed' || Boolean(row.completedAt);
  const needsCloseout =
    !completed || (row.requiresFinalAttendance && !row.attendanceFinalized);

  let severity: WatchdogSeverity | null = null;
  if (nowMs >= endMs + 30 * 60 * 1000 && needsCloseout) severity = 'overdue';
  else if (nowMs >= endMs && needsCloseout) severity = 'end';
  else if (nowMs >= startMs && !row.startedAt && !completed) severity = 'start';

  if (!severity) return null;

  return {
    ...row,
    severity,
    endMs,
    displayLabel: row.pairName || `${row.sectionLabel} · ${row.courseLabel}`,
  };
}

const rank: Record<WatchdogSeverity, number> = {
  overdue: 0,
  end: 1,
  start: 2,
};

/**
 * Dashboard watchdog rules:
 * - show alerts only for the currently selected class;
 * - when that class belongs to an LTG linked pair, inspect both halves;
 * - collapse the pair to one card using the most urgent outstanding condition.
 *
 * This prevents a lead instructor or manager who can see several cohorts from
 * receiving unrelated dashboard cards for every visible class.
 */
export function selectedWatchdogAlerts(
  rows: WatchdogRow[],
  nowMs: number,
  selectedSectionId: string
): WatchdogAlert[] {
  if (!selectedSectionId) return [];

  const selected = rows.find((row) => row.sectionId === selectedSectionId);
  if (!selected) return [];

  const scopeRows = selected.pairId
    ? rows.filter((row) => row.pairId === selected.pairId)
    : [selected];

  const alerts = scopeRows
    .map((row) => alertForRow(row, nowMs))
    .filter((alert): alert is WatchdogAlert => Boolean(alert))
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.endMs - b.endMs);

  const mostUrgent = alerts[0];
  if (!mostUrgent) return [];

  return [
    {
      ...mostUrgent,
      sectionId: selected.sectionId,
      sectionLabel: selected.sectionLabel,
      dayNumber: selected.dayNumber ?? mostUrgent.dayNumber,
      displayLabel:
        selected.pairName || `${selected.sectionLabel} · ${selected.courseLabel}`,
    },
  ];
}
