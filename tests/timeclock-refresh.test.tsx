// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPunchClock from '@/app/dashboard-punch-clock';
import TimeClockPage from '@/app/time-clock/page';
import { notifyTimeclockChanged } from '@/lib/timeclock-events';

const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => { const router = { push: mock.push }; return { useRouter: () => router }; });
const client = { from: mock.from, rpc: mock.rpc, auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) } };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));

type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;
let owner: boolean;
let correctionError: Error | null;
let delayedOpen: null | { started: () => void; result: Promise<{ data: Row | null; error: null }> };
const inTime = new Date('2001-01-02T08:00:00').toISOString();
const outTime = new Date('2001-01-02T16:00:00').toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/time-clock?school=mine&review=my-punch');
  Element.prototype.scrollIntoView = vi.fn();
  owner = true;
  correctionError = null;
  delayedOpen = null;
  rows = {
    schools: [{ id: 'first', name: 'Another school', status: 'active' }, { id: 'mine', name: 'My school', status: 'active' }],
    school_memberships: [{ user_id: 'me', school_id: 'mine', role: 'instructor', status: 'active' }],
    profiles: [{ id: 'me', display_name: 'My Employee' }],
    timeclock_employees: [
      { id: 'other', school_id: 'mine', profile_id: 'other-user', display_name: 'Other Employee', active: true, clocking_enabled: true },
      { id: 'my-employee', school_id: 'mine', profile_id: 'me', display_name: 'My Employee', active: true, clocking_enabled: true },
    ],
    timeclock_entries: [
      { id: 'other-punch', school_id: 'mine', employee_id: 'other', clock_in_at: inTime, clock_out_at: null, requires_correction: false },
      { id: 'my-punch', school_id: 'mine', employee_id: 'my-employee', clock_in_at: inTime, clock_out_at: null, requires_correction: false },
    ],
  };
  mock.rpc.mockImplementation(async (name: string, args: Record<string, string | null>) => {
    if (name === 'is_platform_owner') return { data: owner, error: null };
    if (name === 'timeclock_adjust_entry') {
      if (correctionError) return { error: correctionError };
      const entry = rows.timeclock_entries.find((row) => row.id === args.p_entry_id)!;
      entry.clock_in_at = args.p_new_clock_in_at;
      entry.clock_out_at = args.p_new_clock_out_at;
    }
    return { data: null, error: null };
  });
  mock.from.mockImplementation((table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let single = false;
    let open = false;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      is: (key: string, value: unknown) => { open = key === 'clock_out_at'; return query.eq(key, value); },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      gte: (key: string, value: string) => { filters.push(row => String(row[key]) >= value); return query; },
      lte: (key: string, value: string) => { filters.push(row => String(row[key]) <= value); return query; },
      order: () => query,
      limit: () => query,
      maybeSingle: () => { single = true; return query; },
      then: (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) => {
        if (table === 'timeclock_entries' && single && open && delayedOpen) {
          const delayed = delayedOpen;
          delayedOpen = null;
          delayed.started();
          return delayed.result.then(resolve, reject);
        }
        const selected = (rows[table] ?? []).filter(row => filters.every(filter => filter(row))).map(row => ({ ...row }));
        return Promise.resolve({ data: single ? selected[0] ?? null : selected, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
});
afterEach(cleanup);

const sidebar = () => within(screen.getByRole('region', { name: 'Punch clock summary' }));
const correction = () => screen.findByRole('region', { name: 'Correct Time Entry' });
async function saveClockOut() {
  const form = within(await correction());
  fireEvent.change(form.getByLabelText('Clock out'), { target: { value: '2001-01-02T16:00' } });
  fireEvent.change(form.getByLabelText('Reason'), { target: { value: 'Synthetic correction' } });
  fireEvent.click(form.getByRole('button', { name: 'Save Correction' }));
}

describe('persistent sidebar punch clock', () => {
  it('identifies the employee and links to that exact punch and authorized school', async () => {
    render(<DashboardPunchClock pathname="/dashboard" />);
    await sidebar().findByText('Previous Punch Needs Review');
    expect(sidebar().getByText('My Employee')).toBeTruthy();
    expect(sidebar().getByRole('link', { name: 'Review Previous Punch →' }).getAttribute('href')).toBe('/time-clock?school=mine&review=my-punch');
    expect((sidebar().getByRole('button', { name: 'Start New Shift' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('opens the linked employee correction and refreshes the sidebar after saving', async () => {
    render(<><DashboardPunchClock pathname="/time-clock" /><TimeClockPage /></>);
    const form = await correction();
    expect(within(form).getByText('My Employee')).toBeTruthy();
    await sidebar().findByText('Previous Punch Needs Review');
    await saveClockOut();
    await sidebar().findByText('Clocked Out');
    expect(mock.rpc).toHaveBeenCalledWith('timeclock_adjust_entry', {
      p_entry_id: 'my-punch', p_new_clock_in_at: inTime, p_new_clock_out_at: outTime, p_reason: 'Synthetic correction',
    });
    expect(screen.getByText('My Employee: time entry corrected and audit history recorded.')).toBeTruthy();
    expect(rows.timeclock_entries.find(row => row.id === 'other-punch')?.clock_out_at).toBeNull();
    expect((sidebar().getByRole('button', { name: 'Clock In' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps my warning when a different employee is corrected and names that employee in the receipt', async () => {
    window.history.replaceState({}, '', '/time-clock?school=mine&review=other-punch');
    render(<><DashboardPunchClock pathname="/time-clock" /><TimeClockPage /></>);
    await sidebar().findByText('Previous Punch Needs Review');
    await saveClockOut();
    await screen.findByText('Other Employee: time entry corrected and audit history recorded.');
    await sidebar().findByText('Previous Punch Needs Review');
    expect(rows.timeclock_entries.find(row => row.id === 'my-punch')?.clock_out_at).toBeNull();
  });

  it('keeps a failed correction visible and does not clear the warning', async () => {
    correctionError = new Error('Adjusted entry overlaps another shift');
    render(<><DashboardPunchClock pathname="/time-clock" /><TimeClockPage /></>);
    await sidebar().findByText('Previous Punch Needs Review');
    await saveClockOut();
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Correct Time Entry' })).getByRole('alert').textContent).toBe('Adjusted entry overlaps another shift'));
    expect(sidebar().getByText('Previous Punch Needs Review')).toBeTruthy();
    expect(rows.timeclock_entries.find(row => row.id === 'my-punch')?.clock_out_at).toBeNull();
  });

  it('does not open a correction form for a non-manager even with a review URL', async () => {
    owner = false;
    render(<TimeClockPage />);
    await screen.findByText('My Employee');
    expect(screen.queryByRole('region', { name: 'Correct Time Entry' })).toBeNull();
    expect(mock.rpc.mock.calls.some(([name]) => name === 'timeclock_adjust_entry')).toBe(false);
  });

  it('does not use a requested school outside the authorized school list', async () => {
    owner = false;
    window.history.replaceState({}, '', '/time-clock?school=forbidden&review=unknown');
    render(<TimeClockPage />);
    await screen.findByText('My Employee');
    expect(screen.getByText('My school')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Correct Time Entry' })).toBeNull();
  });

  it.each(['focus', 'storage', 'route'])('reloads corrected data on %s', async (trigger) => {
    const view = render(<DashboardPunchClock pathname="/dashboard" />);
    await sidebar().findByText('Previous Punch Needs Review');
    rows.timeclock_entries[1].clock_out_at = outTime;
    if (trigger === 'focus') fireEvent(window, new Event('focus'));
    if (trigger === 'storage') fireEvent(window, new StorageEvent('storage', { key: 'ltg_timeclock_change', newValue: 'changed' }));
    if (trigger === 'route') view.rerender(<DashboardPunchClock pathname="/time-clock" />);
    await sidebar().findByText('Clocked Out');
  });

  it('ignores an older in-flight response after a successful correction refresh', async () => {
    render(<DashboardPunchClock pathname="/dashboard" />);
    await sidebar().findByText('Previous Punch Needs Review');
    let resolve!: (result: { data: Row | null; error: null }) => void;
    const started = vi.fn();
    const stale = { ...rows.timeclock_entries[1] };
    delayedOpen = { started, result: new Promise(r => { resolve = r; }) };
    act(() => notifyTimeclockChanged('workspace'));
    await waitFor(() => expect(started).toHaveBeenCalled());
    rows.timeclock_entries[1].clock_out_at = outTime;
    act(() => notifyTimeclockChanged('workspace'));
    await sidebar().findByText('Clocked Out');
    await act(async () => resolve({ data: stale, error: null }));
    expect(sidebar().queryByText('Previous Punch Needs Review')).toBeNull();
    expect(sidebar().getByText('Clocked Out')).toBeTruthy();
  });
});


it('starts a fresh shift through recovery without fabricating an old clock-out', async () => {
 render(<DashboardPunchClock pathname="/dashboard" />);
 const button = await sidebar().findByRole('button', { name: 'Start New Shift' });
 fireEvent.click(button);
 await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('timeclock_clock_in', { p_employee_id: 'my-employee', p_pin: null }));
 expect(mock.rpc.mock.calls.some(([name]) => name === 'timeclock_clock_out')).toBe(false);
 expect(rows.timeclock_entries[1].clock_out_at).toBeNull();
});
