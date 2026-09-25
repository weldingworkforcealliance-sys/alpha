// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TeacherIdentityBar from '@/app/teacher-identity-bar';
import { publishSelectedSection, readSelectedSectionId } from '@/lib/section-selection';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const client = { from: mocks.from, rpc: mocks.rpc, auth: { getSession: async () => ({ data: { session: { user: { id: 'teacher' } } } }) } };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
it('does not publish an old fallback class after the instructor selects another class', async () => {
  publishSelectedSection('110');
  let resolve!: (value: unknown) => void;
  const pending = new Promise(r => { resolve = r; });
  const fallbackRequested = vi.fn();
  mocks.from.mockImplementation(() => {
    let id = '';
    const q = { select: () => q, eq: (_key: string, value: string) => { id = value; return q; }, limit: () => q,
      maybeSingle: () => {
        if (!id) { fallbackRequested(); return pending; }
        return Promise.resolve({ data: id === '110' ? null : { section_id: id, course_code: 'WLD 210', cohort_name: 'Day Level 2' }, error: null });
      } };
    return q;
  });
  mocks.rpc.mockResolvedValue({ data: [{ display_name: 'Instructor' }], error: null });
  render(<TeacherIdentityBar pathname="/dashboard" />);
  await waitFor(() => expect(fallbackRequested).toHaveBeenCalled());
  act(() => publishSelectedSection('210'));
  await screen.findByText('WLD 210 · Day Level 2');
  await act(async () => resolve({ data: { section_id: '105', course_code: 'WLD 105', cohort_name: 'Old class' }, error: null }));
  expect(readSelectedSectionId()).toBe('210');
  expect(screen.queryByText('WLD 210 · Day Level 2')).not.toBeNull();
});
