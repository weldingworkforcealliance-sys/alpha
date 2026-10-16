// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/app/dashboard/page';

const mocks = vi.hoisted(() => ({ selectedId: '110', search: '', from: vi.fn(), rpc: vi.fn(), push: vi.fn(), replace: vi.fn(), select: null as null | ((id: string) => void) }));
vi.mock('next/navigation', () => { const router = { push: mocks.push, replace: mocks.replace }; return { useRouter: () => router, useSearchParams: () => new URLSearchParams(mocks.search) }; });
vi.mock('@/lib/section-selection', () => ({ readSelectedSectionId: () => mocks.selectedId, publishSelectedSection: vi.fn(), subscribeSelectedSection: (fn: (id: string) => void) => { mocks.select = (id: string) => { mocks.selectedId = id; fn(id); }; return () => {}; } }));
const client = { from: mocks.from, rpc: mocks.rpc, auth: { getSession: async () => ({ data: { session: { user: { id: 'teacher' } } } }) } };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
vi.mock('@/app/planner-activity', () => ({ default: () => null }));
vi.mock('@/app/attendance/attendance-workspace', () => ({ default: ({ lockedSectionId, lockedDate }: { lockedSectionId: string; lockedDate: string }) => <div data-testid="attendance-context">{lockedSectionId}/{lockedDate}</div> }));
describe.each(['false', 'true'])('planner layout Teaching View=%s', (mode) => {
let delayedGuide: null | { id: string; result: Promise<unknown> };
let delayedIndex: null | Promise<unknown>;
let currentStarted = false;
let actualDay3: string | null;
let delayCalendar: null | Promise<unknown>;
const sections = ['110', '210'].map(section => ({ school_id: 'school', section_id: section, course_code: `WLD ${section}`, current_planner_day_number: 4, planner_day_id: `${section}-p4`, scheduled_date: '2026-09-28', guide_day_id: `${section}-g4` }));
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_TEACHING_VIEW_V2', mode);
  mocks.search = '';
  mocks.selectedId = '110'; currentStarted = false;
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
        if (table === 'planner_day_delivery' && currentStarted) data = [{ planner_day_id: `${f.section_id}-p4`, delivery_status: 'in_progress', actual_date: '2026-09-28', started_at: '2026-09-28T17:00:00Z' }];
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
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
function attendanceContext() {
  if (mode === 'false') return screen.queryByTestId('attendance-context');
  expect(screen.queryByTestId('attendance-context')).toBeNull();
  const link = screen.queryAllByRole('link', { name: 'Attendance' })[0];
  if (!link) return null;
  const url = new URL(link.getAttribute('href')!, 'https://staging.example');
  return { textContent: `${url.searchParams.get('section')}/${url.searchParams.get('date')}` };
}
async function expectDate(value: string) { await waitFor(() => expect(attendanceContext()?.textContent).toBe(value), { timeout: 5000 }); }
async function previewDay3() { fireEvent.change(screen.getByRole('combobox', { name: /Go to Day|Choose teaching day/i }), { target: { value: '3' } }); }

describe('planner attendance follows the viewed lesson', () => {
  it('loads September 24 while previewing Day 3, then returns to September 28 for Day 4', async () => {
    render(<Dashboard />); await expectDate('110/2026-09-28');
    await previewDay3(); await expectDate('110/2026-09-24');
    fireEvent.click(screen.getByRole('button', { name: /Back to current day/i }));
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
    await waitFor(() => expect(attendanceContext()).toBeNull());
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
    await waitFor(() => expect(attendanceContext()).toBeNull());
    act(() => mocks.select?.('210'));
    await expectDate('210/2026-09-28');
    await act(async () => resolve({ data: { id: '110-g3', guide_id: '110', planner_day_number: 3, title: 'Stale 110 lesson' }, error: null }));
    expect(attendanceContext()?.textContent).toBe('210/2026-09-28');
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
  expect(attendanceContext()?.textContent).toBe('210/2026-09-28');
});


it('blocks completion until attendance is finalized and passes the same notes to the live RPC', async () => {
  currentStarted = true;
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  let finalized = false;
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'attendance_completion_requirement' ? [{ attendance_required: true, finalized }] : false, error: null }));
  render(<Dashboard />); await expectDate('110/2026-09-28');
  fireEvent.change(screen.getByLabelText('Daily Comments / Deviation Summary'), {target:{value:'Review setup tomorrow'}});
  fireEvent.click(screen.getByRole('button', {name:'Complete Day'}));
  await screen.findByText(/must be finalized before this class day can be completed/);
  expect(mocks.rpc.mock.calls.some(([name]) => name === 'complete_current_planner_day')).toBe(false);
  finalized = true;
  fireEvent.click(screen.getByRole('button', {name:'Complete Day'}));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('complete_current_planner_day', expect.objectContaining({p_section_id:'110', p_actual_date:'2026-09-28', p_deviation_summary:'Review setup tomorrow'})));
});

if (mode === 'true') it('opens the detailed menu destination and retains unsaved notes across view navigation',async()=>{
  mocks.search='view=detailed';
  const view=render(<Dashboard/>);
  await screen.findByRole('button',{name:'Back to Teaching View'});
  await waitFor(()=>expect(screen.getByLabelText('Daily Comments / Deviation Summary')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Daily Comments / Deviation Summary'),{target:{value:'Keep these unsaved notes'}});
  fireEvent.click(screen.getByRole('button',{name:'Back to Teaching View'}));
  expect(mocks.replace).toHaveBeenCalledWith('/dashboard',{scroll:false});
  mocks.search='';view.rerender(<Dashboard/>);
  await screen.findByRole('main',{name:'Teaching View'});
  expect(screen.getByLabelText('Daily Comments / Deviation Summary')).toHaveProperty('value','Keep these unsaved notes');
  fireEvent.click(screen.getByRole('button',{name:'Open Full Detailed Planner →'}));
  expect(mocks.replace).toHaveBeenCalledWith('/dashboard?view=detailed',{scroll:false});
  expect(screen.getByLabelText('Daily Comments / Deviation Summary')).toHaveProperty('value','Keep these unsaved notes');
});

it.each([['Start Today', 'start_current_planner_day'], ['Complete Day', 'complete_current_planner_day']])('keeps the current class when a previous class %s finishes', async (button, rpc) => {
  currentStarted = button === 'Complete Day';
  render(<Dashboard />); await expectDate('110/2026-09-28');
  let resolve!: (value: unknown) => void;
  const pending = new Promise(r => { resolve = r; });
  mocks.rpc.mockImplementation((name: string) => name === rpc ? pending : Promise.resolve({ data: false }));
  fireEvent.click(screen.getByRole('button', { name: button }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(rpc, expect.objectContaining({ p_section_id: '110' })));
  act(() => mocks.select?.('210'));
  await expectDate('210/2026-09-28');
  await act(async () => resolve({ error: null }));
  expect(attendanceContext()?.textContent).toBe('210/2026-09-28');
});

});

