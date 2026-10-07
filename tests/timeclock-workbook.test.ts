import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTimeclockWorkbook, punchExceptions, type ReportPunch } from '../lib/timeclock-workbook';

const punch = (overrides: Partial<ReportPunch> = {}): ReportPunch => ({
  employeeId: 'one', employee: 'Instructor', date: '2026-09-28',
  clockIn: '8:00 AM', clockOut: '4:00 PM', hours: 8, status: 'Complete',
  methodIn: 'self', methodOut: 'self', ...overrides,
});

describe('weekly attendance workbook', () => {
  it('groups by employee ID and Monday week, preserves precision and raw records, and leaves payroll editable', async () => {
    const rows = [punch({ hours: 8.1234 }), punch({ hours: 1.2345 }), punch({ employeeId: 'two' }), punch({ date: '2026-10-04' }), punch({ date: '2026-10-05' })];
    const before = JSON.stringify(rows);
    const book = buildTimeclockWorkbook(rows, '2026-09-28', '2026-10-07');
    expect(book.worksheets.map(s => s.name)).toEqual(['Week 2026-09-28', 'Week 2026-10-05', 'Raw Data']);
    const first = book.worksheets[0];
    expect(first.getCell('B6').value).toBeCloseTo(9.3579, 8);
    expect(first.getCell('H6').value).toBe(8);
    expect(first.getCell('I6').value).toEqual({ formula: 'SUM(B6:H6)', result: 17.3579 });
    expect(first.getCell('J6').value).toBeNull();
    first.getCell('J6').value = 16;
    expect(first.getCell('I6').result).toBeCloseTo(17.3579);
    expect(book.worksheets[1].getCell('E6').value).toBeNull();
    expect(book.getWorksheet('Raw Data')?.rowCount).toBe(rows.length + 1);
    expect(JSON.stringify(rows)).toBe(before);
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await book.xlsx.writeBuffer());
    expect(reloaded.worksheets[0].getCell('I6').formula).toBe('SUM(B6:H6)');
    expect(reloaded.worksheets[0].getCell('J6').value).toBe(16);
    expect(reloaded.getWorksheet('Raw Data')?.getCell('E2').value).toBe(8.1234);
  });

  it('flags open, high, multi-day and clock-hour mismatches without changing hours', () => {
    expect(punchExceptions(punch({ status: 'Clocked In', clockOut: '—' }))).toEqual(['Open punch — provisional hours']);
    expect(punchExceptions(punch({ hours: 32 }))).toContain('Clock-time/hour mismatch — check punch dates');
    expect(punchExceptions(punch({ hours: 32 }))).toContain('High hours (>12)');
    expect(punchExceptions(punch({ clockIn: '10:00 PM', clockOut: '6:00 AM' }))).toEqual([]);
    expect(punchExceptions(punch({ hours: 8.01 }))).toEqual([]);
    expect(punchExceptions(punch({ hours: 7 }))).toContain('Clock-time/hour mismatch — check punch dates');
  });

  it('flags high daily totals across multiple punches and weekly totals', () => {
    const book = buildTimeclockWorkbook([punch(), punch(), ...[29, 30].map(day => punch({ date: `2026-09-${day}`, hours: 13 }))], '2026-09-28', '2026-10-04');
    expect(book.worksheets[0].getCell('K6').text).toContain('Daily total >12 hours');
    expect(book.worksheets[0].getCell('K6').text).toContain('Weekly total >40 hours');
  });

  it('handles partial and empty weeks, year boundaries, and rejects reversed ranges', () => {
    expect(buildTimeclockWorkbook([], '2026-12-30', '2027-01-05').worksheets.map(s => s.name)).toEqual(['Week 2026-12-28', 'Week 2027-01-04', 'Raw Data']);
    expect(() => buildTimeclockWorkbook([], '2026-10-07', '2026-09-28')).toThrow();
    const book = buildTimeclockWorkbook([punch()], '2026-09-29', '2026-10-04');
    expect(book.getWorksheet('Raw Data')?.rowCount).toBe(1);
  });

  it('stores formula-like names as literal strings', () => {
    const book = buildTimeclockWorkbook([punch({ employee: '=HYPERLINK("bad")' })], '2026-09-28', '2026-09-28');
    expect(book.worksheets[0].getCell('A6').type).toBe(ExcelJS.ValueType.String);
  });
});
