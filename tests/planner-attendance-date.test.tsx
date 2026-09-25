// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/app/dashboard/page';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), push: vi.fn(), select: null as null | ((id: string) => void) }));
vi.mock('next/navigation', () => { const router = { push: mocks.push }; return { useRouter: () => router }; });
vi.mock('@/lib/section-selection', () => ({ readSelectedSectionId: () => '110', publishSelectedSection: vi.fn(), subscribeSelectedSection: (fn: (id: string) => void) => { mocks.select = fn; return () => {}; } }));
const client = { from: mocks.from, rpc: mocks.rpc, auth: { getSession: async () => ({ data: { session: { user: { id: 'teacher' } } } }) } };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
vi.mock('@/app/planner-activity', () => ({ default: () => null }));
vi.mock('@/app/attendance/attendance-workspace', () => ({ default: ({ lockedSectionId, lockedDate }: { lockedSectionId: string; lockedDate: string }) => <div data-testid="attendance-context">{lockedSectionId}/{lockedDate}</div> }));
let delayedGuide: null | { id: string; result: Promise<unknown> };
let delayedIndex: null | Promise<unknown>;
let actualDay3: string | null;
let delayCalendar: null | Promise<unknown>;
const sections = ['110', '210'].map(section => ({ school_id: 'school', section_id: section, course_code: `WLD ${section}`, current_planner_day_number: 4, planner_day_id: `${section}-p4`, scheduled_date: '2026-09-28', guide_day_id: `${section}-g4` }));
beforeEach(() => {
  actualDay3 = '2026-09-24'; delayCalendar = null; delayedGuide = null; delayedIndex = null;
  mocks.rpc.mockResolvedValue({ data: false });
  mocks.from.mockImplementation((table: string) => {
    const f: Record<string, string> = {};
    const q = { select: () => q, eq: (k: string, v: string) => { f[k] = v; return q; }, order: () => q, maybeSingle: () => q,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        let data: unknown = [];
        if (table === 'current_teaching_sections') data = sections;
        if (table === 'planner_days') {
          if (f.section_id === '210' && delayCalendar) return delayCalendar.then(resolve, reject);
          data = [3, 4].map(day => ({ id: `${f.section_id}-p${day}`, planner_day_number: day, scheduled_date: day === 3 ? '2026-09-23' : '2026-09-28', status: day === 3 ? 'completed' : 'planned' }));
        }
        if (table === 'planner_day_delivery') data = [{ planner_day_id: `${f.section_id}-p3`, delivery_status: 'completed', actual_date: actualDay3, completed_at: '2026-09-25T01:40:00Z' }];
        if (table === 'course_guide_days') {
          if (f.guide_id === '110' && delayedIndex) return delayedIndex.then(resolve, reject);
          if (delayedGuide && f.id === delayedGuide.id) return delayedGuide.result.then(resolve, reject);
          const guide = (id: string) => ({ id, guide_id: id.split('-')[0], planner_day_number: Number(id.slice(-1)), title: `Lesson ${id.slice(-1)}` });
          data = f.id ? guide(f.id) : [guide(`${f.guide_id}-g3`), guide(`${f.guide_id}-g4`)];
        }
        if (table === 'course_guide_day_math') data = null;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      } };
    return q;
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function expectDate(value: string) { await waitFor(() => expect(screen.getByTestId('attendance-context').textContent).toBe(value), { timeout: 5000 }); }
async function previewDay3() { fireEvent.change(screen.getByRole('combobox', { name: 'Go to Day' }), { target: { value: '3' } }); }

describe('planner attendance follows the viewed lesson', () => {
  it('loads September 24 while previewing Day 3, then returns to September 28 for Day 4', async () => {
    render(<Dashboard />); await expectDate('110/2026-09-28');
    await previewDay3(); await expectDate('110/2026-09-24');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Current Day' }));
    await expectDate('110/2026-09-28');
  });
  it('uses the scheduled date when the preview has no actual delivery date', async () => {
    actualDay3 = null; render(<Dashboard />); await expectDate('110/2026-09-28');
    await previewDay3(); await expectDate('110/2026-09-23');
  });
  it('keeps a current-day date edit out of historical previews', async () => {
    render(<Dashboard />); await expectDate('110/2026-09-28');
    fireEvent.change(screen.getByLabelText('Actual Date'), { target: { value: '2026-09-29' } });
    await expectDate('110/2026-09-29');
    await previewDay3(); await expectDate('110/2026-09-24');
  });
  it('hides the previous class roster while the next class calendar is loading', async () => {
    render(<Dashboard />); await expectDate('110/2026-09-28');
    let resolve!: (value: unknown) => void;
    delayCalendar = new Promise(r => { resolve = r; });
    act(() => mocks.select?.('210'));
    await waitFor(() => expect(screen.queryByTestId('attendance-context')).toBeNull());
    await act(async () => resolve({ data: [{ id: '210-p4', planner_day_number: 4, scheduled_date: '2026-09-30' }], error: null }));
    await expectDate('210/2026-09-30');
  });
});


describe('planner ignores stale lesson responses', () => {
  it('keeps the newly selected class when an older lesson finishes last', async () => {
    render(<Dashboard />); await expectDate('110/2026-09-28');
    let resolve!: (value: unknown) => void;
    delayedGuide = { id: '110-g3', result: new Promise(r => { resolve = r; }) };
    await previewDay3();
    await waitFor(() => expect(screen.queryByTestId('attendance-context')).toBeNull());
    act(() => mocks.select?.('210'));
    await expectDate('210/2026-09-28');
    await act(async () => resolve({ data: { id: '110-g3', guide_id: '110', planner_day_number: 3, title: 'Stale 110 lesson' }, error: null }));
    expect(screen.queryByTestId('attendance-context')?.textContent).toBe('210/2026-09-28');
    expect(screen.queryByText('Stale 110 lesson')).toBeNull();
  });
});


it('ignores a stale lesson index after switching class during initial loading', async () => {
  let resolve!: (value: unknown) => void;
  delayedIndex = new Promise(r => { resolve = r; });
  render(<Dashboard />);
  await waitFor(() => expect(mocks.from).toHaveBeenCalledWith('course_guide_days'));
  act(() => mocks.select?.('210'));
  await expectDate('210/2026-09-28');
  await act(async () => resolve({ data: [{ id: '110-g3', planner_day_number: 3, title: 'Stale index' }], error: null }));
  expect(screen.queryByRole('option', { name: /Stale index/ })).toBeNull();
  expect(screen.getByTestId('attendance-context').textContent).toBe('210/2026-09-28');
});
