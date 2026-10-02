import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migration = read(
  'supabase/migrations/20261002114946_guard_future_attendance_and_action_alerts.sql'
);
const alert = read('app/attendance-finalization-alert.tsx');
const plannerPanel = read('app/planner-attendance-panel.tsx');
const layout = read('app/layout.tsx');

describe('attendance date and closeout safeguards', () => {
  it('uses the school timezone and rejects future attendance at the database boundary', () => {
    expect(migration).toContain('private.school_timezone(p_school_id uuid)');
    expect(migration).toContain('private.school_local_date(p_school_id uuid)');
    expect(migration).toContain('attendance_sessions_reject_future_date');
    expect(migration).toContain('new.attendance_date > v_school_date');
    expect(migration).toContain("raise sqlstate '22007'");
    expect(migration).toContain('Future attendance regression check failed');
  });

  it('also blocks the PVHS queue if a future-dated session somehow reaches reporting', () => {
    expect(migration).toContain(
      'v_school_date := private.school_local_date(v_session.school_id);'
    );
    expect(migration).toContain('Attendance report blocked because %s is a future school date');
    expect(migration).toContain("status in ('pending', 'failed')");
  });

  it('separates missing attendance from marked-but-unfinalized attendance', () => {
    expect(migration).toContain('public.get_attendance_action_alerts');
    expect(migration).toContain("'missing'::text as alert_type");
    expect(migration).toContain("'unfinalized'::text as alert_type");
    expect(migration).toContain('from public.planner_day_delivery d');
    expect(migration).toContain('a.primary_completed or a.completion_started');
    expect(migration).toContain('ar.initial_status is not null');
  });

  it('limits alerts to authorized staff and keeps the RPC unavailable to anonymous callers', () => {
    expect(migration).toContain('public.can_review_instruction(p.school_id)');
    expect(migration).toContain('si.instructor_id = auth.uid()');
    expect(migration).toContain(
      'revoke all on function public.get_attendance_action_alerts(date)\n  from public, anon;'
    );
    expect(migration).toContain(
      'grant execute on function public.get_attendance_action_alerts(date)\n  to authenticated;'
    );
  });

  it('shows separate dashboard actions for missing and unfinalized attendance', () => {
    expect(alert).toContain("alert_type: 'missing' | 'unfinalized'");
    expect(alert).toContain("supabase.rpc('get_attendance_action_alerts'");
    expect(alert).toContain('Attendance action required');
    expect(alert).toContain('These are attendance-record problems, not email-delivery failures.');
    expect(alert).toContain("isMissing ? 'Enter Attendance' : 'Review & Finalize'");
    expect(alert).toContain('/attendance?section=');
    expect(layout).toContain('<AttendanceFinalizationAlert pathname={pathname} />');
  });

  it('invalidates stale section-date lookups and locks a future planner date in the UI', () => {
    expect(plannerPanel).toContain('const sectionLookupRef = useRef(0)');
    expect(plannerPanel).toContain('const lookupId = ++sectionLookupRef.current');
    expect(plannerPanel).toContain('lookupId !== sectionLookupRef.current');
    expect(plannerPanel).toContain('const futureAttendanceDate = attendanceDate > localDate()');
    expect(plannerPanel).toContain('Future attendance is locked');
  });

  it('uses a low-frequency visibility-aware safety poll while preserving immediate refresh', () => {
    expect(alert).toContain('window.setInterval(refreshIfVisible, 120_000)');
    expect(alert).toContain("document.visibilityState !== 'hidden'");
    expect(alert).toContain("window.addEventListener('focus', onFocus)");
    expect(alert).toContain("document.addEventListener('visibilitychange', onVisibilityChange)");
    expect(alert).toContain("window.addEventListener('ltg:attendance-finalized', onAttendanceFinalized)");
  });
});
