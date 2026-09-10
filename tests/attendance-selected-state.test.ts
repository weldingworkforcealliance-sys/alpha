import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'app/attendance/attendance.module.css'), 'utf8');
const workspace = readFileSync(join(process.cwd(), 'app/attendance/attendance-workspace.tsx'), 'utf8');

describe('attendance selected-state visibility', () => {
  it('applies the active class from the saved initial attendance status', () => {
    expect(workspace).toContain("record.initialStatus === value ? styles.active : ''");
  });

  it('gives selected statuses a strong filled state and visible checkmark', () => {
    expect(css).toContain(".statusButton.active::before");
    expect(css).toContain("content: '✓ '");
    expect(css).toContain('background: var(--ltg-success, #4fa66c);');
    expect(css).toContain('.statusButton.absent.active');
    expect(css).toContain('.statusButton.late.active');
    expect(css).toContain('.statusButton.excused.active');
  });

  it('preserves the strong state in embedded planner attendance', () => {
    expect(css).toContain('.embeddedPanel .statusButton.active');
    expect(css).toContain('.embeddedPanel .statusButton.absent.active');
    expect(css).toContain('.embeddedPanel .statusButton.late.active');
    expect(css).toContain('.embeddedPanel .statusButton.excused.active');
  });
});
