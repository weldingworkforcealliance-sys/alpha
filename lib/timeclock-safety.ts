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
/** Flag prior-day punches once an overnight shift exceeds the grace window. */
export const OVERNIGHT_GRACE_HOURS = 10;
const DEFAULT_TIMEZONE = 'America/New_York';

function localCalendarDay(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(epochMs));
}
const HOUR_MS = 3_600_000;

export type ClockInterval = {
  clock_in_at: string;
  clock_out_at: string | null;
  requires_correction?: boolean;
};

/** Matches the production recovery RPC's New York calendar-day boundary. */
export function canRecoverPriorDayPunch(entry: ClockInterval | null | undefined, nowMs = Date.now()): boolean {
  if (!entry || entry.clock_out_at !== null) return false;
  const start = Date.parse(entry.clock_in_at);
  return Number.isFinite(start) && start < nowMs &&
    localCalendarDay(start, DEFAULT_TIMEZONE) !== localCalendarDay(nowMs, DEFAULT_TIMEZONE);
}

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
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  if (entry.clock_out_at !== null) return false;
  if (entry.requires_correction || canRecoverPriorDayPunch(entry, nowMs)) return true;
  const hours = recordedShiftHours(entry, nowMs);
  if (hours === null || hours > reviewHours) return true;

  // A previous-day open punch may be an overnight shift, but by the next
  // morning it must not silently masquerade as a fresh clock-in.
  const startMs = Date.parse(entry.clock_in_at);
  return hours > OVERNIGHT_GRACE_HOURS &&
    localCalendarDay(startMs, timeZone) !== localCalendarDay(nowMs, timeZone);
}

export function isActiveOpenPunch(
  entry: ClockInterval,
  nowMs = Date.now(),
  reviewHours = DEFAULT_REVIEW_HOURS,
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  return entry.clock_out_at === null && !isUnresolvedOpenPunch(entry, nowMs, reviewHours, timeZone);
}

/** Completed shifts > threshold and invalid intervals must be reviewed first. */
export function eligibleCompletedHours(
  entry: ClockInterval,
  reviewHours = DEFAULT_REVIEW_HOURS,
): number {
  if (entry.clock_out_at === null || entry.requires_correction) return 0;
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
