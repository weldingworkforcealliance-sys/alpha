import { describe, expect, it, vi } from 'vitest';
import { formatError } from '../lib/format-error';
import { safePostLoginRoute } from '../lib/auth-routes';
import { pageHandler } from './helpers/page-handler';

const invalidCredentials = 'Email/password not recognized. First-time users should complete account setup. Existing users can reset their password below.';

function loginHarness() {
  const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const setError = vi.fn();
  const setIsLoading = vi.fn();
  const router = { replace: vi.fn(), refresh: vi.fn() };
  const event = { preventDefault: vi.fn() };
  const handleLogin = pageHandler<(event: { preventDefault: () => void }) => Promise<void>>(
    'app/login/page.tsx', 'handleLogin', {
      email: ' Teacher@Example.com ', password: 'test-password',
      supabase: { auth: { signInWithPassword }, rpc },
      setError, setIsLoading, router, formatError, safePostLoginRoute,
      console: { error: vi.fn() }, URLSearchParams,
      window: { location: { search: '?next=%2Faccounts' } },
    }
  );
  return { signInWithPassword, rpc, setError, setIsLoading, router, event, handleLogin };
}

describe('Live Sign In', () => {
  it('activates memberships before navigating and normalizes the email', async () => {
    const h = loginHarness();
    let completeActivation!: (value: { error: null }) => void;
    h.rpc.mockImplementation(() => new Promise((resolve) => { completeActivation = resolve; }));
    const pending = h.handleLogin(h.event);
    await vi.waitFor(() => expect(h.rpc).toHaveBeenCalledOnce());
    expect(h.event.preventDefault).toHaveBeenCalledOnce();
    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: 'teacher@example.com', password: 'test-password',
    });
    expect(h.rpc).toHaveBeenCalledWith('activate_my_invited_memberships');
    expect(h.router.replace).not.toHaveBeenCalled();
    expect(h.router.refresh).not.toHaveBeenCalled();
    completeActivation({ error: null });
    await pending;
    expect(h.router.replace).toHaveBeenCalledWith('/accounts');
    expect(h.router.refresh).toHaveBeenCalledOnce();
    expect(h.setError).toHaveBeenCalledExactlyOnceWith('');
    expect(h.setIsLoading.mock.calls).toEqual([[true], [false]]);
  });

  it.each([
    [{ code: '42501', message: 'internal authorization detail', details: 'secret', hint: 'secret' },
      "You don't have permission to perform this action."],
    [{ message: 'relation private.memberships does not exist', details: 'secret' },
      'Live sign in could not be completed.'],
    [{ details: 'secret', hint: 'secret' }, 'Live sign in could not be completed.'],
    [{ message: 'Your invitation has expired.' }, 'Your invitation has expired.'],
  ])('surfaces returned activation errors safely and stops navigation', async (error, expected) => {
    const h = loginHarness();
    h.rpc.mockResolvedValue({ error });
    await h.handleLogin(h.event);
    expect(h.setError).toHaveBeenLastCalledWith(expected);
    expect(h.router.replace).not.toHaveBeenCalled();
    expect(h.router.refresh).not.toHaveBeenCalled();
    expect(h.setIsLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('handles rejected activation requests and permits retry after a failure', async () => {
    const h = loginHarness();
    h.rpc.mockRejectedValueOnce(new Error('relation private.memberships does not exist'));
    await h.handleLogin(h.event);
    expect(h.setError).toHaveBeenLastCalledWith('Live sign in could not be completed.');
    expect(h.router.replace).not.toHaveBeenCalled();
    expect(h.setIsLoading).toHaveBeenLastCalledWith(false);
    await h.handleLogin(h.event);
    expect(h.setError).toHaveBeenLastCalledWith('');
    expect(h.router.replace).toHaveBeenCalledExactlyOnceWith('/accounts');
  });

  it.each([
    [{ message: 'Invalid login credentials' }, invalidCredentials],
    [{ message: 'relation private.users does not exist' }, 'Failed to sign in'],
    [{ message: '' }, 'Failed to sign in'],
    [{ message: 'Email not confirmed' }, 'Email not confirmed'],
  ])('preserves credential guidance and sanitizes other sign-in errors', async (error, expected) => {
    const h = loginHarness();
    h.signInWithPassword.mockResolvedValue({ error });
    await h.handleLogin(h.event);
    expect(h.setError).toHaveBeenLastCalledWith(expected);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.router.replace).not.toHaveBeenCalled();
    expect(h.router.refresh).not.toHaveBeenCalled();
    expect(h.setIsLoading).toHaveBeenLastCalledWith(false);
  });
});
