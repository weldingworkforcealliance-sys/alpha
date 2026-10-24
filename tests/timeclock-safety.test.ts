import { describe, expect, it } from 'vitest';
import {
  canRecoverPriorDayPunch,
  DEFAULT_REVIEW_HOURS,
  eligibleCompletedHours,
  eligibleWorkbookHours,
  isActiveOpenPunch,
  isUnresolvedOpenPunch,
  recordedShiftHours,
} from '../lib/timeclock-safety';
import { buildTimeclockWorkbook, punchExceptions, type ReportPunch } from '../lib/timeclock-workbook';

const at = (local: string) => new Date(local).toISOString();

describe('time-clock stale-session protections', () => {
  const now = Date.parse('2026-10-12T10:39:00-04:00');

  it('never treats last Thursday or Friday as a Monday live punch', () => {
    const naji = { clock_in_at: at('2026-10-08T08:29:43-04:00'), clock_out_at: null };
    const anthony = { clock_in_at: at('2026-10-09T11:58:33-04:00'), clock_out_at: null };
    expect(isActiveOpenPunch(naji, now)).toBe(false);
    expect(isActiveOpenPunch(anthony, now)).toBe(false);
    expect(isUnresolvedOpenPunch(naji, now)).toBe(true);
    expect(isUnresolvedOpenPunch(anthony, now)).toBe(true);
    expect(eligibleCompletedHours(naji)).toBe(0);
    expect(eligibleCompletedHours(anthony)).toBe(0);
  });

  it('matches the production prior-day boundary and retains same-day long-shift review', () => {
    const clockIn = at('2026-10-11T22:00:00-04:00');
    const open = { clock_in_at: clockIn, clock_out_at: null };
    expect(isActiveOpenPunch(open, Date.parse('2026-10-12T02:00:00-04:00'))).toBe(false);
    expect(isUnresolvedOpenPunch(open, Date.parse('2026-10-12T14:00:01-04:00'))).toBe(true);
    expect(isActiveOpenPunch(open, Date.parse('2026-10-12T14:00:00-04:00'))).toBe(false);
    // An open shift that starts today can reach exactly 16 hours before
    // crossing the long-shift cutoff.
    const sameDay = { clock_in_at: at('2026-10-13T00:00:00-04:00'), clock_out_at: null };
    expect(isActiveOpenPunch(sameDay, Date.parse('2026-10-13T16:00:00-04:00'))).toBe(true);
    expect(DEFAULT_REVIEW_HOURS).toBe(16);
    expect(isUnresolvedOpenPunch({ clock_in_at: at('2026-10-13T11:00:00-04:00'), clock_out_at: null }, now)).toBe(true);
  });

  it('flags yesterday\'s unclosed punch this morning before the 16-hour limit', () => {
    const overnight = { clock_in_at: at('2026-10-12T16:59:08-04:00'), clock_out_at: null };
    const nextMorning = Date.parse('2026-10-13T08:37:00-04:00');
    expect(recordedShiftHours(overnight, nextMorning)).toBeLessThan(16);
    expect(isUnresolvedOpenPunch(overnight, nextMorning)).toBe(true);
    expect(isActiveOpenPunch(overnight, nextMorning)).toBe(false);

    // The current production RPC requires recovery after New York midnight.
    const nightShift = { clock_in_at: at('2026-10-12T22:00:00-04:00'), clock_out_at: null };
    expect(isActiveOpenPunch(nightShift, Date.parse('2026-10-13T06:00:00-04:00'))).toBe(false);
    expect(isUnresolvedOpenPunch(nightShift, Date.parse('2026-10-13T09:00:00-04:00'))).toBe(true);
  });

  it('excludes unfinished and over-16-hour completed shifts from automated totals', () => {
    const excessive = {
      clock_in_at: at('2026-10-09T11:58:33-04:00'),
      clock_out_at: at('2026-10-12T08:42:47-04:00'),
    };
    expect(recordedShiftHours(excessive)).toBeGreaterThan(68);
    expect(eligibleCompletedHours(excessive)).toBe(0);
    expect(eligibleWorkbookHours('Clocked In', 96.2)).toBe(0);
    expect(eligibleWorkbookHours('Complete', 68.7)).toBe(0);
    expect(eligibleWorkbookHours('Complete', 16)).toBe(16);
    expect(eligibleWorkbookHours('Complete', Number.NaN)).toBe(0);
  });

  it('counts the user-confirmed split shift and Friday correction correctly', () => {
    const entries = [
      { clock_in_at: at('2026-10-08T08:00:00-04:00'), clock_out_at: at('2026-10-08T14:00:00-04:00') },
      { clock_in_at: at('2026-10-08T17:00:00-04:00'), clock_out_at: at('2026-10-08T22:00:00-04:00') },
      { clock_in_at: at('2026-10-09T11:00:00-04:00'), clock_out_at: at('2026-10-09T14:00:00-04:00') },
    ];
    expect(entries.map(entry => eligibleCompletedHours(entry))).toEqual([6, 5, 3]);
    expect(entries.reduce((sum, entry) => sum + eligibleCompletedHours(entry), 0)).toBe(14);
  });
});

describe('weekly Excel payroll exception isolation', () => {
  const base = (employee: string, date: string, hours: number, status = 'Complete'): ReportPunch => ({
    employeeId: employee,
    employee,
    date,
    clockIn: '8:00 AM',
    clockOut: status === 'Complete' ? '2:00 PM' : '—',
    hours,
    status,
    methodIn: 'self',
    methodOut: status === 'Complete' ? 'self' : '',
    clockInAt: at(date + 'T08:00:00-04:00'),
    clockOutAt: status === 'Complete' ? at(date + 'T14:00:00-04:00') : null,
  });

  it('retains raw open/long punches without counting them in payable completed totals', () => {
    const samples = [
      base('Anthony Ruffino', '2026-10-09', 3),
      base('Naji Halil', '2026-10-08', 6),
      { ...base('Naji Halil', '2026-10-08', 5), clockIn: '5:00 PM', clockOut: '10:00 PM' },
      base('Finsen Sierra', '2026-10-07', 68.7),
      base('Elena Rizal', '2026-10-08', 96.2, 'Clocked In'),
    ];
    const book = buildTimeclockWorkbook(samples, '2026-10-05', '2026-10-11');
    const sheet = book.getWorksheet('Week 2026-10-05');
    expect(sheet).toBeDefined();
    const rows = [6, 7, 8, 9].map(number => sheet!.getRow(number));
    const totals = new Map(rows.map(row => [
      String(row.getCell(1).value),
      [2, 3, 4, 5, 6, 7, 8].reduce((sum, col) => sum + Number(row.getCell(col).value ?? 0), 0),
    ]));
    for (const row of rows) expect(row.getCell(9).formula).toBe(`SUM(B${row.number}:H${row.number})`);
    expect(totals.get('Anthony Ruffino')).toBe(3);
    expect(totals.get('Naji Halil')).toBe(11);
    expect(totals.get('Finsen Sierra')).toBe(0);
    expect(totals.get('Elena Rizal')).toBe(0);

    const raw = book.getWorksheet('Raw Data');
    expect(raw?.rowCount).toBe(6);
    expect(raw!.getRow(5).getCell(13).value).toBe(0);
    expect(raw!.getRow(6).getCell(13).value).toBe(0);
    expect(punchExceptions(samples[3]).join(' ')).toContain('EXCLUDED');
    expect(punchExceptions(samples[4]).join(' ')).toContain('EXCLUDED');
  });
});


describe('production overdue recovery contract', () => {
 it('uses New York midnight regardless of the browser timezone', () => {
  const entry = { clock_in_at: '2026-10-23T23:00:00-04:00', clock_out_at: null };
  expect(canRecoverPriorDayPunch(entry, Date.parse('2026-10-24T03:59:59Z'))).toBe(false);
  expect(canRecoverPriorDayPunch(entry, Date.parse('2026-10-24T04:00:00Z'))).toBe(true);
  expect(canRecoverPriorDayPunch({ ...entry, clock_out_at: '2026-10-24T03:30:00Z' })).toBe(false);
  expect(canRecoverPriorDayPunch({ clock_in_at: 'invalid', clock_out_at: null })).toBe(false);
 });
 it('does not count a completed entry still marked for correction', () => {
  expect(eligibleCompletedHours({ clock_in_at: '2026-10-15T12:09:00Z', clock_out_at: '2026-10-15T18:10:00Z', requires_correction: true })).toBe(0);
 });
});
