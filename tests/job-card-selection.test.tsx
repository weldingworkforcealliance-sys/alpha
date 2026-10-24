// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JobCardInstructor from '@/app/classroom/job-card/page';

const mock = vi.hoisted(() => ({ find: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => { const router = { replace: mock.replace, push: vi.fn() }; return { useRouter: () => router }; });
const sections = ['a', 'b'].map(id => ({ section_id: id, course_code: id.toUpperCase(), section_name: id, planner_day_title: `Job ${id}` }));
const client = { auth: { getSession: async () => ({ data: { session: {} } }) }, from: () => ({ select: async () => ({ data: sections, error: null }) }) };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
vi.mock('@/lib/job-card-session', () => ({ findActiveJobCardSession: (...args: unknown[]) => mock.find(...args), loadJobCardSubmissions: async () => [], subscribeJobCardSubmissions: () => () => {}, startJobCardSession: vi.fn(), endJobCardSession: vi.fn(), reviewJobCardSubmission: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => '' } }));
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, '', '/classroom/job-card'); mock.find.mockResolvedValue(null); });
afterEach(cleanup);

it('does not silently substitute the first class for an unavailable explicit link', async () => {
 window.history.replaceState({}, '', '/classroom/job-card?section=unavailable');
 render(<JobCardInstructor />);
 await screen.findByText('The requested class is unavailable. Select an available class to continue.');
 expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
 expect((screen.getByRole('button', { name: 'Start Live Job Card' }) as HTMLButtonElement).disabled).toBe(true);
 expect(mock.find).not.toHaveBeenCalled();
});

it('ignores a late session from the previously selected class', async () => {
 let resolveA!: (value: unknown) => void;
 mock.find.mockImplementation((_client: unknown, section: string) => section === 'a' ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve(null));
 render(<JobCardInstructor />);
 const selector = await screen.findByRole('combobox');
 await waitFor(() => expect(mock.find).toHaveBeenCalledWith(client, 'a'));
 fireEvent.change(selector, { target: { value: 'b' } });
 await waitFor(() => expect(mock.find).toHaveBeenCalledWith(client, 'b'));
 await act(async () => resolveA({ id: 'old', status: 'active', job_title: 'Wrong class session', join_code: 'OLD', expires_at: '2030-01-01', expected_students: 10 }));
 expect(screen.queryByText('Wrong class session')).toBeNull();
 expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('b');
});
