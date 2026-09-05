export const ATTENDANCE_STATUSES = [
  'unmarked',
  'present',
  'absent',
  'tardy',
  'excused',
  'left_early',
  'not_scheduled',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceGroup = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  attendance_mode: 'standard' | 'pvhs_daily_email';
  course_labels: string[];
  confirmation_course_labels: string[];
  roster_count: number;
};

export type AttendanceSession = {
  id: string;
  school_id: string;
  attendance_group_id: string;
  attendance_date: string;
  status: 'draft' | 'finalized' | 'reopened';
  finalized_at: string | null;
  report_due_at: string | null;
  report_sent_at: string | null;
  report_needs_resend: boolean;
  revision: number;
};

export type AttendanceRecord = {
  id: string;
  student_id: string;
  student_name: string;
  external_student_id: string | null;
  attendance_status: AttendanceStatus;
  arrival_time: string | null;
  departure_time: string | null;
  note: string | null;
};

export type RosterImportRow = {
  external_student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  source_line: number;
};

export type RosterParseResult = {
  rows: RosterImportRow[];
  errors: Array<{ line: number; message: string }>;
};

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitName(value: string) {
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name) return null;

  if (name.includes(',')) {
    const [last, ...firstParts] = name.split(',');
    const first = firstParts.join(',').trim();
    if (!first || !last.trim()) return null;
    return { first_name: first, last_name: last.trim() };
  }

  const parts = name.split(' ');
  if (parts.length < 2) return null;
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts.at(-1) ?? '',
  };
}

export function parseRosterPaste(value: string): RosterParseResult {
  const rows: RosterImportRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  value.split(/\r?\n/).forEach((rawLine, index) => {
    const sourceLine = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    const tabColumns = rawLine.split('\t').map((item) => item.trim());
    let externalStudentId = '';
    let email = '';
    let firstName = '';
    let lastName = '';

    if (tabColumns.length >= 3) {
      // Supported spreadsheet order: Student ID | Last Name | First Name | Email.
      [externalStudentId, lastName, firstName] = tabColumns;
      email = tabColumns[3] ?? '';
    } else {
      const emailMatch = line.match(/\s+([^\s]+@[^\s]+)$/);
      const namePart = emailMatch ? line.slice(0, emailMatch.index).trim() : line;
      email = emailMatch?.[1] ?? '';
      const parsedName = splitName(namePart);
      if (parsedName) {
        firstName = parsedName.first_name;
        lastName = parsedName.last_name;
      }
    }

    if (!firstName || !lastName) {
      errors.push({
        line: sourceLine,
        message: 'Use “Last, First”, “First Last”, or spreadsheet columns: ID, Last, First, Email.',
      });
      return;
    }
    if (email && !looksLikeEmail(email)) {
      errors.push({ line: sourceLine, message: 'The email address is not valid.' });
      return;
    }

    rows.push({
      external_student_id: externalStudentId,
      first_name: firstName,
      last_name: lastName,
      email,
      source_line: sourceLine,
    });
  });

  return { rows, errors };
}

export function localDateInputValue(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function attendanceStatusLabel(status: AttendanceStatus) {
  const labels: Record<AttendanceStatus, string> = {
    unmarked: 'Unmarked',
    present: 'Present',
    absent: 'Absent',
    tardy: 'Tardy',
    excused: 'Excused',
    left_early: 'Left Early',
    not_scheduled: 'Not Scheduled',
  };
  return labels[status];
}
