import { describe, expect, it } from 'vitest';
import { attendanceNeedsReview } from '../lib/attendance-review';

describe('attendance review badge', () => {
  it('counts one student once when a final exception and multiple flags overlap', () => {
    const rows = [
      { initial_status: 'present', final_status: 'left_early', completion_flags: ['left_early', 'other'] },
      { initial_status: 'present', final_status: 'present', completion_flags: [] },
    ];
    expect(rows.filter(attendanceNeedsReview)).toHaveLength(1);
  });
  it('uses the final correction while still including flags and missing marks', () => {
    expect(attendanceNeedsReview({ initial_status: 'absent', final_status: 'present', completion_flags: [] })).toBe(false);
    expect(attendanceNeedsReview({ initial_status: 'excused', final_status: null, completion_flags: [] })).toBe(false);
    expect(attendanceNeedsReview({ initial_status: 'present', final_status: null, completion_flags: ['other'] })).toBe(true);
    expect(attendanceNeedsReview({ initial_status: null, final_status: null, completion_flags: null })).toBe(true);
  });
});

