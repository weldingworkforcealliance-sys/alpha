import ExcelJS from 'exceljs';

export type ReportPunch = {
  employeeId: string;
  employee: string;
  date: string; // Local calendar date, matching the attendance report.
  clockIn: string;
  clockOut: string;
  hours: number; // Existing LTG export hours, never recalculated here.
  status: string;
  methodIn: string;
  methodOut: string;
  entryId?: string;
  clockInAt?: string;
  clockOutAt?: string | null;
};

const DAY = 86_400_000;
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const isoDay = (value: number) => new Date(value).toISOString().slice(0, 10);
const dateMs = (value: string) => Date.parse(`${value}T00:00:00Z`);
const shortDate = (value: string) => `${value.slice(5, 7)}/${value.slice(8, 10)}`;

function clockMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return null;
  return (Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
}

export function punchExceptions(punch: ReportPunch): string[] {
  const flags: string[] = [];
  if (punch.status === 'Clocked In') flags.push('Open punch — provisional hours');
  if (punch.hours > 12) flags.push('High hours (>12)');
  const start = clockMinutes(punch.clockIn);
  const end = clockMinutes(punch.clockOut);
  if (punch.status !== 'Clocked In' && start !== null && end !== null) {
    const displayedHours = ((end - start + 1440) % 1440) / 60;
    // Time-only exports conceal multi-day punches. Flag them; retain their hours.
    if (Math.abs(punch.hours - displayedHours) > 2 / 60) {
      flags.push('Clock-time/hour mismatch — check punch dates');
    }
  }
  return flags;
}

export function buildTimeclockWorkbook(punches: readonly ReportPunch[], start: string, end: string) {
  const first = dateMs(start);
  const last = dateMs(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) {
    throw new Error('Select a valid report date range.');
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Living Teacher Guide';
  workbook.calcProperties.fullCalcOnLoad = true;
  const selected = punches.filter(punch => punch.date >= start && punch.date <= end);
  const monday = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY;
  const navy = '17365D';
  const paleBlue = 'EAF1F8';
  const yellow = 'FFF2CC';

  for (let week = monday; week <= last; week += 7 * DAY) {
    const weekStart = isoDay(week);
    const weekEnd = isoDay(week + 6 * DAY);
    const sheet = workbook.addWorksheet(`Week ${weekStart}`, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 5, showGridLines: false }],
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    sheet.columns = [{ width: 26 }, ...dayNames.map(() => ({ width: 17 })), { width: 19 }, { width: 18 }, { width: 60 }];
    sheet.mergeCells('A1:K1');
    sheet.getCell('A1').value = 'LTG Employee Time Clock Attendance Report';
    sheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: navy } };
    sheet.getRow(1).height = 30;
    sheet.mergeCells('A2:K2');
    sheet.getCell('A2').value = `Payroll week: ${weekStart} – ${weekEnd} | Selected range: ${start} – ${end}`;
    sheet.mergeCells('A3:K3');
    sheet.getCell('A3').value = 'Hours use existing LTG calculations. Open punches are provisional. Enter approved paid hours in the yellow Payroll Hours column.';
    sheet.mergeCells('A4:K4');
    sheet.getCell('A4').value = 'Review flags: punch/day >12 hours; week >40 hours; displayed clock interval differs by >2 minutes. Outside-range days are shaded.';
    sheet.getRow(5).values = ['Instructor', ...dayNames.map((day, i) => `${day}\n${shortDate(isoDay(week + i * DAY))}`), 'LTG Weekly Total', 'Payroll Hours', 'Review / Exceptions'];
    sheet.getRow(5).height = 34;
    sheet.getRow(5).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navy } };
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    const byEmployee = new Map<string, ReportPunch[]>();
    for (const punch of selected) {
      if (punch.date < weekStart || punch.date > weekEnd) continue;
      const group = byEmployee.get(punch.employeeId) ?? [];
      group.push(punch);
      byEmployee.set(punch.employeeId, group);
    }
    const groups = [...byEmployee.values()].sort((a, b) => a[0].employee.localeCompare(b[0].employee) || a[0].employeeId.localeCompare(b[0].employeeId));
    for (const group of groups) {
      const flags = group.flatMap(p => punchExceptions(p).map(flag => `${shortDate(p.date)}: ${flag}`));
      const hours = dayNames.map((_, i) => {
        const date = isoDay(week + i * DAY);
        if (date < start || date > end) return null;
        const daily = group.filter(p => p.date === date).reduce((sum, p) => sum + p.hours, 0);
        if (daily > 12 && !group.some(p => p.date === date && p.hours > 12)) flags.push(`${shortDate(date)}: Daily total >12 hours`);
        return daily;
      });
      const total = hours.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      if (total > 40) flags.push('Weekly total >40 hours');
      const row = sheet.addRow([group[0].employee, ...hours, null, null, [...new Set(flags)].join('\n') || null]);
      row.getCell(9).value = { formula: `SUM(B${row.number}:H${row.number})`, result: total };
      row.height = Math.max(30, [...new Set(flags)].length * 15);
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.font = { name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', wrapText: column === 1 || column === 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.number % 2 ? 'FFFFFF' : paleBlue } };
        if (column >= 2 && column <= 10) cell.numFmt = '0.00';
      });
      for (let i = 0; i < 7; i++) {
        if (hours[i] === null) row.getCell(i + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
      }
      row.getCell(9).font = { bold: true };
      row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: yellow } };
      row.getCell(10).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Enter zero or a positive number of approved payroll hours.' };
      if (flags.length) row.getCell(11).font = { color: { argb: '9C0006' }, size: 11 };
    }
    if (!groups.length) sheet.addRow(['No punches in this payroll week.']);
    sheet.autoFilter = { from: 'A5', to: `K${Math.max(5, 5 + groups.length)}` };
    sheet.pageSetup.printTitlesRow = '1:5';
    sheet.pageSetup.printArea = `A1:K${sheet.rowCount}`;
  }

  const raw = workbook.addWorksheet('Raw Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  raw.columns = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Method In', 'Method Out', 'Employee ID', 'Entry ID', 'Clock In Timestamp', 'Clock Out Timestamp'].map(header => ({ header, width: header.includes('Timestamp') ? 30 : 23 }));
  for (const punch of selected) raw.addRow([punch.employee, punch.date, punch.clockIn, punch.clockOut, punch.hours, punch.status, punch.methodIn, punch.methodOut || null, punch.employeeId, punch.entryId ?? null, punch.clockInAt ?? null, punch.clockOutAt ?? null]);
  raw.getColumn(5).numFmt = '0.0000';
  raw.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  raw.getRow(1).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navy } }; });
  raw.autoFilter = { from: 'A1', to: `L${raw.rowCount}` };
  return workbook;
}
