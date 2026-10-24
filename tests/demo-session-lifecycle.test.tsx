// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WeldingDemoLiveWorkspace from '@/app/demo/welding/WeldingDemoLiveWorkspace';
import type { DemoProgram } from '@/app/demo/_lib/demo-types';

const api = vi.hoisted(() => ({ create: vi.fn(), end: vi.fn(), results: vi.fn() }));
const key = 'ltg_demo_test_full_system_v1';
const live = { activityKey: 'math', title: 'Math', courseCode: 'WEL', dayNumber: 1, startedAt: 123, joinCode: 'SIMULATED' };
const program = { id: 'test', courses: [] } as unknown as DemoProgram;
vi.mock('@/app/demo/welding/_lib/demo-classroom-api', () => ({
  createDemoClassroomSession: (...args: unknown[]) => api.create(...args),
  endDemoClassroomSession: (...args: unknown[]) => api.end(...args),
  getDemoClassroomResults: (...args: unknown[]) => api.results(...args),
  getDemoClassroomSubmissionReport: vi.fn(),
}));
vi.mock('@/app/demo/_components/DemoProgramWorkspace', () => ({ default: () => (
  <button onClick={() => sessionStorage.setItem(key, JSON.stringify({ activeModule: 'classroom', liveSession: null }))}>End Demo Session</button>
) }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem(key, JSON.stringify({ activeModule: 'classroom', liveSession: live }));
  api.create.mockResolvedValue({ session_id: 'remote', instructor_token: 'owner', join_code: 'REAL' });
  api.end.mockResolvedValue(undefined);
  api.results.mockResolvedValue({ participants: [], submissions: [] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('ending a remote session does not recreate it before the storage poll', async () => {
  await act(async () => { render(<WeldingDemoLiveWorkspace program={program} />); });
  const region = screen.getByRole('region', { name: 'Working Live Classroom demo' });
  await act(async () => { fireEvent.click(within(region).getByRole('button', { name: 'End Demo Session' })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(900); });
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.end).toHaveBeenCalledWith('remote', 'owner');
  expect(within(region).getByText('READY')).toBeTruthy();
  expect(sessionStorage.getItem('ltg_demo_remote_owner_test_123')).toBeNull();
});

it('discards a late creation after the underlying demo has ended', async () => {
  let resolve!: (value: unknown) => void;
  api.create.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => { render(<WeldingDemoLiveWorkspace program={program} />); });
  fireEvent.click(screen.getByRole('button', { name: 'End Demo Session' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  await act(async () => { resolve({ session_id: 'late', instructor_token: 'owner', join_code: 'LATE' }); });
  expect(api.end).toHaveBeenCalledWith('late', 'owner');
  expect(screen.getByText('READY')).toBeTruthy();
  expect(sessionStorage.getItem('ltg_demo_remote_owner_test_123')).toBeNull();
});
