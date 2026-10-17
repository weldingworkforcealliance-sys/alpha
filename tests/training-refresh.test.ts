// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { startTrainingRefresh } from '@/lib/training-refresh';
afterEach(() => vi.useRealTimers());
it('refreshes without a Realtime deletion event, on focus and after 30 seconds', async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue(undefined);
  const updates = startTrainingRefresh(load, vi.fn());
  await vi.advanceTimersByTimeAsync(30000);
  expect(load).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('focus'));
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(2);
  updates.stop();
  window.dispatchEvent(new Event('focus'));
  await vi.advanceTimersByTimeAsync(60000);
  expect(load).toHaveBeenCalledTimes(2);
});
it('does not overlap slow requests and recovers after a failed authorized refresh', async () => {
  vi.useFakeTimers();
  let reject!: (error: Error) => void;
  const load = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, rejectRequest) => { reject = rejectRequest; })).mockResolvedValue(undefined);
  const onError = vi.fn();
  const updates = startTrainingRefresh(load, onError);
  const pending = updates.refresh();
  await vi.advanceTimersByTimeAsync(60000);
  window.dispatchEvent(new Event('focus'));
  expect(load).toHaveBeenCalledTimes(1);
  reject(new Error('Temporary connection failure'));
  await pending;
  expect(onError).toHaveBeenCalledOnce();
  await updates.refresh();
  expect(load).toHaveBeenCalledTimes(2);
  updates.stop();
});
