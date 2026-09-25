import { describe, expect, it } from 'vitest';
import { selectedWatchdogAlerts, type WatchdogRow } from '../lib/class-watchdog';

const at = (iso: string) => new Date(iso).getTime();

function row(overrides: Partial<WatchdogRow>): WatchdogRow {
  return {
    sectionId: 'section',
    plannerDayId: 'day',
    scheduledDate: '2026-09-25',
    dayNumber: 13,
    sectionLabel: 'PVHS C - WLD 110',
    courseLabel: 'WLD 110',
    startTime: '11:30:00',
    endTime: '14:30:00',
    deliveryStatus: null,
    startedAt: '2026-09-25T15:30:00Z',
    completedAt: null,
    requiresFinalAttendance: true,
    attendanceFinalized: false,
    pairId: 'pair-c',
    pairName: 'PVHS Level 1 C · WLD 105/110',
    pairPrimarySectionId: 'c-105',
    pairCompletionSectionId: 'c-110',
    ...overrides,
  };
}

describe('selected watchdog alerts', () => {
  it('does not show alerts from another visible cohort', () => {
    const rows = [
      row({
        sectionId: 'b-105',
        plannerDayId: 'b-day',
        sectionLabel: 'PVHS B - WLD 105',
        courseLabel: 'WLD 105',
        startTime: '08:30:00',
        endTime: '09:30:00',
        pairId: 'pair-b',
        pairName: 'PVHS Level 1 B · WLD 105/110',
        pairPrimarySectionId: 'b-105',
        pairCompletionSectionId: 'b-110',
      }),
      row({ sectionId: 'c-110' }),
    ];

    const alerts = selectedWatchdogAlerts(rows, at('2026-09-25T19:15:00'), 'c-110');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].displayLabel).toBe('PVHS Level 1 C · WLD 105/110');
    expect(alerts[0].pairId).toBe('pair-c');
  });

  it('collapses both halves of a linked pair into one card using the worst condition', () => {
    const rows = [
      row({
        sectionId: 'c-105',
        plannerDayId: 'c-105-day',
        sectionLabel: 'PVHS C - WLD 105',
        courseLabel: 'WLD 105',
        startTime: '11:30:00',
        endTime: '12:30:00',
      }),
      row({
        sectionId: 'c-110',
        plannerDayId: 'c-110-day',
        startTime: '12:30:00',
        endTime: '14:30:00',
      }),
    ];

    const alerts = selectedWatchdogAlerts(rows, at('2026-09-25T19:15:00'), 'c-110');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('overdue');
    expect(alerts[0].sectionId).toBe('c-110');
    expect(alerts[0].displayLabel).toBe('PVHS Level 1 C · WLD 105/110');
  });

  it('shows nothing when the selected class itself has no outstanding watchdog condition', () => {
    const rows = [
      row({
        sectionId: 'b-105',
        plannerDayId: 'b-day',
        sectionLabel: 'PVHS B - WLD 105',
        courseLabel: 'WLD 105',
        pairId: 'pair-b',
        pairName: 'PVHS Level 1 B · WLD 105/110',
        pairPrimarySectionId: 'b-105',
        pairCompletionSectionId: 'b-110',
      }),
      row({
        sectionId: 'c-110',
        deliveryStatus: 'completed',
        completedAt: '2026-09-25T18:35:00Z',
        attendanceFinalized: true,
      }),
    ];

    expect(selectedWatchdogAlerts(rows, at('2026-09-25T19:15:00'), 'c-110')).toEqual([]);
  });

  it('keeps a standalone section scoped to itself', () => {
    const standalone = row({
      sectionId: 'standalone',
      pairId: null,
      pairName: null,
      pairPrimarySectionId: null,
      pairCompletionSectionId: null,
      sectionLabel: 'Standalone Lab',
      courseLabel: 'LAB 100',
    });

    const alerts = selectedWatchdogAlerts([standalone], at('2026-09-25T19:15:00'), 'standalone');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].displayLabel).toBe('Standalone Lab · LAB 100');
  });
});
