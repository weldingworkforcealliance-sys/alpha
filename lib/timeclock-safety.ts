/**
 * LTG time-clock presentation and payroll safety.
 *
 * Open punches can be forgotten for days. Never auto-close, delete or silently
 * count them as payable hours. Flag long shifts for manager reconciliation.
 *
 * PCCC's configured long-shift review threshold is currently 16 hours.
 * The optional threshold parameter allows other schools to use their setting.
 */
export const DEFAULT_REVIEW_HOURS = 16;
const HOUR_MS = 3_600_000;

export type ClockInterval = {
  clock_in_at: string;
  clock_out_at: string | null;
};

export function recordedShiftHours(entry: ClockInterval, nowMs = Date.now()): number | null {
  const start = Date.parse(entry.clock_in_at);
  const end = entry.clock_out_at ? Date.parse(entry.clock_out_at) : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / HOUR_MS;
}

export function isUnresolvedOpenPunch(
  entry: ClockInterval,
  nowMs = Date.now(),
  reviewHours = DEFAULT_REVIEW_HOURS,
): boolean {
  if (entry.clock_out_at !== null) return false;
  const hours = recordedShiftHours(entry, nowMs);
  return hours === null || hours > reviewHours;
}

export function isActiveOpenPunch(
  entry: ClockInterval,
  nowMs = Date.now(),
  reviewHours = DEFAULT_REVIEW_HOURS,
): boolean {
  return entry.clock_out_at === null && !isUnresolvedOpenPunch(entry, nowMs, reviewHours);
}

/** Completed shifts > threshold and invalid intervals must be reviewed first. */
export function eligibleCompletedHours(
  entry: ClockInterval,
  reviewHours = DEFAULT_REVIEW_HOURS,
): number {
  if (entry.clock_out_at === null) return 0;
  const hours = recordedShiftHours(entry);
  return hours !== null && hours <= reviewHours ? hours : 0;
}

/** Workbook rows may come from older callers without ISO timestamps. */
export function eligibleWorkbookHours(
  status: string,
  hours: number,
  reviewHours = DEFAULT_REVIEW_HOURS,
): number {
  return status === 'Complete' && Number.isFinite(hours) && hours >= 0 && hours <= reviewHours
    ? hours
    : 0;
}
