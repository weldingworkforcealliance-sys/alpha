import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migration = read(
  'supabase/migrations/20260910194500_add_unfinalized_attendance_alerts.sql'
);
const alert = read('app/attendance-finalization-alert.tsx');
const layout = read('app/layout.tsx');

describe('attendance finalization safeguard', () => {
  it('only alerts on started attendance that is not finalized and is not future dated', () => {
    expect(migration).toContain("ses.status <> 'finalized'");
    expect(migration).toContain('ses.attendance_date <= p_as_of');
    expect(migration).toContain('ar.initial_status is not null');
  });

  it('limits instructor alerts to assigned attendance pairs while preserving management oversight', () => {
    expect(migration).toContain('public.can_review_instruction(p.school_id)');
    expect(migration).toContain('from public.section_instructors si');
    expect(migration).toContain('si.instructor_id = auth.uid()');
    expect(migration).toContain('si.section_id in (p.primary_section_id, p.completion_section_id)');
  });

  it('keeps the alert RPC unavailable to anonymous callers', () => {
    expect(migration).toContain(
      'revoke all on function public.get_unfinalized_attendance_alerts(date)\n  from public, anon;'
    );
    expect(migration).toContain(
      'grant execute on function public.get_unfinalized_attendance_alerts(date)\n  to authenticated;'
    );
  });

  it('shows a persistent dashboard action with a direct completion-section attendance link', () => {
    expect(alert).toContain('Attendance still needs final confirmation');
    expect(alert).toContain('PVHS email');
    expect(alert).toContain('/attendance?section=');
    expect(alert).toContain('Review &amp; Finalize');
    expect(alert).toContain("window.setInterval(() => void refresh(), 30_000)");
    expect(layout).toContain('<AttendanceFinalizationAlert pathname={pathname} />');
  });
});
