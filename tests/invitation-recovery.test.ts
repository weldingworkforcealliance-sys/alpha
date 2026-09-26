import { describe, expect, it, vi } from 'vitest';
import { formatError } from '../lib/format-error';
import { pageHandler } from './helpers/page-handler';

const pages = [
  ['app/account-setup/page.tsx', 'finishSetup', 'verifyCode'],
  ['app/reset-password/page.tsx', 'updatePassword', 'verifyResetCode'],
] as const;
const technicalError = { message: 'relation private.accounts does not exist', details: 'secret', hint: 'secret' };

function harness(path: string, name: string, search = '') {
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 'test@example.invalid' } } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'test@example.invalid' } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  };
  const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
  const setReady = vi.fn();
  const setError = vi.fn();
  const setMessage = vi.fn();
  const setBusy = vi.fn();
  const setSaving = vi.fn();
  const setTimeout = vi.fn();
  const replaceState = vi.fn();
  const push = vi.fn();
  const handler = pageHandler<() => Promise<void>>(path, name, {
    supabase: { auth, rpc }, formatError, URLSearchParams,
    process: { env: { NEXT_PUBLIC_REQUIRE_MFA: 'false' } },
    setReady, setError, setMessage, setBusy, setSaving, setEmail: vi.fn(),
    password: 'test-password', confirmPassword: 'test-password',
    email: 'test@example.invalid', otp: '123456',
    router: { push },
    window: { location: { search, hash: '', pathname: path.includes('account-setup') ? '/account-setup' : '/reset-password' },
      history: { replaceState }, setTimeout },
  });
  return { handler, auth, rpc, setReady, setError, setMessage, setBusy, setSaving, setTimeout, replaceState, push };
}

describe.each(pages)('%s verification and partial completion', (path, update, verify) => {
  it('does not accept a failed callback by falling back to an existing session', async () => {
    const h = harness(path, 'prepare', '?code=expired-code');
    h.auth.exchangeCodeForSession.mockResolvedValue({ error: { message: 'This link has expired.' } });
    await h.handler();
    expect(h.setReady).not.toHaveBeenCalled();
    expect(h.auth.getSession).not.toHaveBeenCalled();
    expect(h.setError).toHaveBeenLastCalledWith('This link has expired.');
  });

  it('shows a safe recovery message for missing PKCE verifier errors', async () => {
    const h = harness(path, 'prepare', '?code=invalid-code');
    h.auth.exchangeCodeForSession.mockResolvedValue({
      error: new Error('PKCE code verifier not found in storage. Use @supabase/ssr.'),
    });
    await h.handler();
    expect(h.setError.mock.lastCall?.[0]).toContain('could not be verified');
    expect(h.setError.mock.lastCall?.[0]).not.toContain('PKCE');
    expect(h.setError.mock.lastCall?.[0]).not.toContain('@supabase');
    expect(h.setReady).not.toHaveBeenCalled();
  });

  it('checks returned session lookup errors', async () => {
    const h = harness(path, 'prepare');
    h.auth.getSession.mockResolvedValue({ data: { session: null }, error: technicalError });
    await h.handler();
    expect(h.setReady).not.toHaveBeenCalled();
    expect(h.setError.mock.lastCall?.[0]).toContain('could not be verified');
    expect(h.setError.mock.lastCall?.[0]).not.toContain('private.');
  });

  it('accepts a valid callback and removes its code from the URL', async () => {
    const h = harness(path, 'prepare', '?code=valid-code');
    await h.handler();
    expect(h.setReady).toHaveBeenCalledWith(true);
    expect(h.replaceState).toHaveBeenCalledOnce();
    expect(h.auth.getSession).not.toHaveBeenCalled();
  });

  it('still supports a valid existing session without a callback', async () => {
    const h = harness(path, 'prepare');
    await h.handler();
    expect(h.setReady).toHaveBeenCalledWith(true);
  });

  it('keeps expired numeric verification codes on the verification form', async () => {
    const h = harness(path, verify);
    h.auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    await h.handler();
    expect(h.setReady).not.toHaveBeenCalled();
    expect(h.setError).toHaveBeenLastCalledWith('Token has expired or is invalid');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([false, true])('reports a saved password when activation fails (rejected=%s)', async (rejected) => {
    const h = harness(path, update);
    if (rejected) h.rpc.mockRejectedValue(technicalError);
    else h.rpc.mockResolvedValue({ error: technicalError });
    await h.handler();
    expect(h.auth.updateUser).toHaveBeenCalledOnce();
    expect(h.rpc).toHaveBeenCalledWith('activate_my_invited_memberships');
    expect(h.setError).toHaveBeenLastCalledWith(expect.stringContaining('Your password was saved'));
    expect(h.setError).toHaveBeenLastCalledWith(expect.stringContaining('Sign in with your new password'));
    expect(h.setError.mock.lastCall?.[0]).not.toContain('private.');
    expect(h.setError.mock.lastCall?.[0]).not.toContain('secret');
    expect(h.setTimeout).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
    expect(path.includes('account-setup') ? h.setBusy : h.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('does not claim the password was saved when the password update fails', async () => {
    const h = harness(path, update);
    h.auth.updateUser.mockResolvedValue({ error: { message: 'Choose a different password.' } });
    await h.handler();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.setTimeout).not.toHaveBeenCalled();
    expect(h.setError).toHaveBeenLastCalledWith('Choose a different password.');
  });

  it('still opens the dashboard after password and activation both succeed', async () => {
    const h = harness(path, update);
    await h.handler();
    expect(h.setError).toHaveBeenCalledExactlyOnceWith('');
    expect(h.setTimeout).toHaveBeenCalledOnce();
    const navigate = h.setTimeout.mock.calls[0][0] as () => void;
    navigate();
    expect(h.push).toHaveBeenCalledWith('/dashboard');
  });
});

it('Account Setup checks user lookup errors after a successful code exchange', async () => {
  const h = harness('app/account-setup/page.tsx', 'prepare', '?code=valid-code');
  h.auth.getUser.mockResolvedValue({ data: { user: null }, error: technicalError });
  await h.handler();
  expect(h.setReady).not.toHaveBeenCalled();
  expect(h.setError.mock.lastCall?.[0]).toContain('could not be verified');
});
