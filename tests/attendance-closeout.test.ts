import { describe, expect, it } from 'vitest';
import { attendanceCloseoutAction } from '../lib/attendance-closeout';

describe('attendance closeout routing', () => {
  it('routes missing initial attendance to the primary course', () => {
    expect(attendanceCloseoutAction({
      attendance_required: true,
      session_id: 'session-1',
      finalized: false,
      primary_section_id: 'wld105',
      completion_section_id: 'wld110',
      active_student_count: 6,
      initial_marked_count: 0,
      missing_initial_count: 6,
    })).toEqual({
      targetSectionId: 'wld105',
      stage: 'initial',
      heading: 'Initial attendance required before Complete Day',
      message: '6 of 6 students still need Present, Absent, Late, or Excused. Enter those statuses in the primary course first. Then return to the completion course to review and finalize the pair.',
      actionLabel: 'Enter Initial Attendance',
    });
  });

  it('routes completed initial attendance to final confirmation', () => {
    expect(attendanceCloseoutAction({
      attendance_required: true,
      session_id: 'session-1',
      finalized: false,
      primary_section_id: 'wld105',
      completion_section_id: 'wld110',
      active_student_count: 6,
      initial_marked_count: 6,
      missing_initial_count: 0,
    })).toEqual({
      targetSectionId: 'wld110',
      stage: 'final',
      heading: 'Attendance confirmation required before Complete Day',
      message: 'Initial attendance is saved. Review final attendance and press Finalize Pair Attendance. Complete Day will work after attendance is finalized.',
      actionLabel: 'Review & Finalize Attendance',
    });
  });

  it('returns no action when attendance is finalized or not required', () => {
    expect(attendanceCloseoutAction({
      attendance_required: true,
      finalized: true,
      primary_section_id: 'wld105',
      completion_section_id: 'wld110',
    })).toBeNull();
    expect(attendanceCloseoutAction({ attendance_required: false })).toBeNull();
  });
});
