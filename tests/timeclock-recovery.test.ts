import { describe, expect, it } from 'vitest';
import { punchAction, preferredOpenPunch, isActiveOpenPunch, eligibleCompletedHours } from '../lib/timeclock-safety';

describe('database-compatible punch recovery', () => {
  const now = Date.parse('2026-11-05T15:00:00Z');
  const old = { clock_in_at: '2026-10-28T13:15:00Z', clock_out_at: null, requires_correction: true };
  it('allows a new shift without closing or counting the unresolved shift', () => {
    expect(punchAction(old, now)).toBe('in');
    expect(punchAction({ ...old, requires_correction: false }, now)).toBe('in');
    expect(isActiveOpenPunch(old, now)).toBe(false);
    expect(eligibleCompletedHours(old)).toBe(0);
    expect(old.clock_out_at).toBeNull();
  });
  it('selects the current shift regardless of history ordering', () => {
    const current = { clock_in_at: '2026-11-05T14:00:00Z', clock_out_at: null, requires_correction: false };
    expect(preferredOpenPunch([current, old])).toBe(current);
    expect(preferredOpenPunch([old, current])).toBe(current);
    expect(punchAction(current, now)).toBe('out');
  });
  it('matches Eastern midnight across DST instead of the browser timezone', () => {
    const overnight = { clock_in_at: '2026-11-05T04:30:00Z', clock_out_at: null };
    expect(punchAction(overnight, Date.parse('2026-11-05T04:59:59Z'))).toBe('out');
    expect(punchAction(overnight, Date.parse('2026-11-05T05:00:00Z'))).toBe('in');
  });
  it('does not send clock-in over an invalid or unflagged excessive same-day shift', () => {
    expect(punchAction({ clock_in_at: 'invalid', clock_out_at: null }, now)).toBe('review');
    expect(punchAction({ clock_in_at: '2026-11-06T15:00:00Z', clock_out_at: null }, now)).toBe('review');
    expect(punchAction({ clock_in_at: '2026-11-05T05:00:00Z', clock_out_at: null }, Date.parse('2026-11-05T22:00:00Z'))).toBe('review');
  });
});
