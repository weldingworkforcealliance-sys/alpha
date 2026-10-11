// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SharedMath from '@/app/classroom/shared-math/page';

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
const router = { push: mocks.push, replace: mocks.replace };
const client = { auth: { getSession: async () => ({ data: { session: {} } }) }, from: mocks.from, rpc: mocks.rpc };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
beforeEach(() => {
  mocks.rpc.mockResolvedValue({ data: Array.from({ length: 22 }, (_, i) => ({ slug: `wld205_shared_math_v1_d${String(i + 1).padStart(2, '0')}`, title: `Math ${i + 1}` })) });
  mocks.from.mockImplementation(table => {
    const result = table === 'current_teaching_sections' ? { data: [{ section_id: 'class-a', section_name: 'WLD 205 A', guide_day_id: 'guide-a' }] } : { data: { shared_math_day_number: 7 } };
    const q = { select: () => q, eq: () => q, maybeSingle: async () => result, then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve) };
    return q;
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(Array.from({ length: 22 }, (_, i) => i + 1))('opens exact shared math day %i in the existing classroom workflow', async day => {
  window.history.replaceState(null, '', `/classroom/shared-math?section=class-a&day=${day}`);
  render(<SharedMath />);
  const open = await screen.findByRole('button', { name: 'Open classroom' });
  fireEvent.click(open);
  expect(mocks.push).toHaveBeenCalledWith(`/classroom/planner?section=class-a&assessment=wld205_shared_math_v1_d${String(day).padStart(2, '0')}`);
  expect(mocks.rpc.mock.calls.map(c => c[0])).toEqual(['list_assessment_modules_v2']);
});
it('uses the shared day mapping rather than the local course day for generic links', async () => {
  window.history.replaceState(null, '', '/classroom/shared-math?section=class-a');
  render(<SharedMath />);
  await waitFor(() => expect((screen.getByLabelText('Math lesson') as HTMLSelectElement).value).toBe('7'));
});
it.each(['day=99&section=class-a', 'day=1&section=other-class'])('blocks invalid launch context %s', async query => {
  window.history.replaceState(null, '', `/classroom/shared-math?${query}`);
  render(<SharedMath />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button')).toBeNull();
  expect(mocks.push).not.toHaveBeenCalled();
});
it('requires a deliberate lesson choice when the current day has no shared mapping', async () => {
  mocks.from.mockImplementation(table => {
    const result = table === 'current_teaching_sections' ? { data: [{ section_id: 'class-a', section_name: 'WLD 205 A', guide_day_id: null }] } : { data: null };
    const q = { select: () => q, eq: () => q, then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve) };
    return q;
  });
  window.history.replaceState(null, '', '/classroom/shared-math?section=class-a');
  render(<SharedMath />);
  const open = await screen.findByRole('button', { name: 'Open classroom' });
  expect((open as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Math lesson'), { target: { value: '3' } });
  fireEvent.click(open);
  expect(mocks.push).toHaveBeenCalledWith('/classroom/planner?section=class-a&assessment=wld205_shared_math_v1_d03');
});
