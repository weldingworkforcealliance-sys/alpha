// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Guard from '@/app/components/planner-schedule-start-guard';
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: null as null | ((id: string) => void) }));
vi.mock('@/lib/section-selection', () => ({ readSelectedSectionId: () => 'future', subscribeSelectedSection: (fn: (id: string) => void) => { mocks.select = fn; return () => {}; } }));
const client = { from: mocks.from };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('does not let a previous class restriction intercept Start Today while the new class loads', async () => {
  let resolve!: (value: unknown) => void;
  const pending = new Promise(r => { resolve = r; });
  mocks.from.mockImplementation(() => {
    let id = '';
    const q = { select: () => q, eq: (_key: string, value: string) => { id = value; return q; }, maybeSingle: () => id === 'future' ? Promise.resolve({ data: { scheduled_date: '2099-01-01', current_planner_day_number: 4 } }) : pending };
    return q;
  });
  const onStart = vi.fn();
  render(<><Guard /><button onClick={onStart}>Start Today</button></>);
  await screen.findByRole('status');
  fireEvent.click(screen.getByRole('button', { name: 'Start Today' }));
  expect(onStart).not.toHaveBeenCalled();
  act(() => mocks.select?.('today'));
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Start Today' }));
  expect(onStart).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: { scheduled_date: '2020-01-01' }, error: null }));
  expect(screen.queryByRole('status')).toBeNull();
});
