import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { formatError } from '../lib/format-error';
import { pageEffect, pageHandler } from './helpers/page-handler';

const accounts = 'app/accounts/page.tsx';
const diagnostics = 'app/accounts/diagnostics/page.tsx';
const permissionMessage = "You don't have permission to perform this action.";
const technicalError = {
  message: 'relation private.invitation_tokens does not exist',
  details: 'secret-token', hint: 'Inspect private.invitation_tokens',
};

function harness(path: string, name: string) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const signUp = vi.fn().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
  const resend = vi.fn().mockResolvedValue({ error: null });
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  const queryDiagnostic = vi.fn().mockResolvedValue({
    exists: true, membership_status: 'invited',
    email_confirmed_at: name === 'sendRecovery' ? '2026-09-01' : null,
  });
  const setError = vi.fn();
  const setBusy = vi.fn();
  const setNotice = vi.fn();
  const load = vi.fn().mockResolvedValue(undefined);
  const handler = pageHandler<() => Promise<void>>(path, name, {
    supabase: { rpc }, signupClient: { auth: { signUp, resend } },
    mailClient: { auth: { resend, resetPasswordForEmail } },
    formatError, setError, setBusy, setNotice, load, queryDiagnostic,
    schoolId: 'school', newName: 'Teacher', newEmail: 'Teacher@Example.com',
    newReason: 'Invitation', newRole: 'instructor', roleOptions: ['instructor'],
    existingEmail: 'Teacher@Example.com', existingReason: 'Add user',
    existingRole: 'instructor', resendEmail: 'Teacher@Example.com',
    email: 'Teacher@Example.com',
    schoolMap: new Map([['school', { name: 'Test School' }]]),
    setLookupResult: vi.fn(), setNewName: vi.fn(), setNewEmail: vi.fn(),
    setExistingEmail: vi.fn(), setDiagnostic: vi.fn(),
    makeTemporaryPassword: () => 'test-only-password',
    window: { location: { origin: 'https://example.test' } },
  });
  return { handler, rpc, signUp, resend, resetPasswordForEmail,
    queryDiagnostic, setError, setBusy, setNotice, load };
}

const actions = [
  [accounts, 'inviteNewUser', 'Invitation could not be created.'],
  [accounts, 'lookupExisting', 'Existing user could not be looked up.'],
  [accounts, 'addExisting', 'User could not be added to the school.'],
  [accounts, 'resendSetupEmail', 'Account setup email could not be resent.'],
  [diagnostics, 'checkStatus', 'Invitation status could not be checked.'],
  [diagnostics, 'resendSetup', 'Account setup email could not be resent.'],
  [diagnostics, 'sendRecovery', 'Password recovery email could not be sent.'],
] as const;

describe.each(actions)('%s: %s', (path, name, fallback) => {
  it.each([
    [technicalError, fallback],
    [{ details: 'secret-token', hint: 'internal table' }, fallback],
    [{ code: '42501', message: 'internal permission detail' }, permissionMessage],
    [{ message: 'Please try again later.' }, 'Please try again later.'],
  ])('sanitizes failed lookups or mutations and clears busy state', async (error, expected) => {
    const h = harness(path, name);
    h.rpc.mockResolvedValue({ data: null, error });
    h.queryDiagnostic.mockRejectedValue(error);
    await h.handler();
    expect(h.setError).toHaveBeenLastCalledWith(expected);
    expect(h.setBusy.mock.calls).toEqual([[true], [false]]);
    expect(h.setNotice).toHaveBeenCalledExactlyOnceWith('');
    expect(h.signUp).not.toHaveBeenCalled();
    expect(h.resend).not.toHaveBeenCalled();
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(h.load).not.toHaveBeenCalled();
  });

  it('sanitizes rejected requests', async () => {
    const h = harness(path, name);
    h.rpc.mockRejectedValue(new Error(technicalError.message));
    h.queryDiagnostic.mockRejectedValue(new Error(technicalError.message));
    await h.handler();
    expect(h.setError).toHaveBeenLastCalledWith(fallback);
    expect(h.setBusy).toHaveBeenLastCalledWith(false);
  });
});

describe('account and invitation downstream operations', () => {
  it.each([
    [accounts, 'inviteNewUser', 'signUp', 'Invitation could not be created.'],
    [accounts, 'resendSetupEmail', 'resend', 'Account setup email could not be resent.'],
    [diagnostics, 'resendSetup', 'resend', 'Account setup email could not be resent.'],
    [diagnostics, 'sendRecovery', 'resetPasswordForEmail', 'Password recovery email could not be sent.'],
  ] as const)('sanitizes %s %s provider errors', async (path, name, operation, fallback) => {
    const h = harness(path, name);
    h.rpc.mockResolvedValue({ data: { exists: name !== 'inviteNewUser', membership_status: 'invited' }, error: null });
    h[operation].mockResolvedValue({ data: null, error: technicalError });
    await h.handler();
    expect(h[operation]).toHaveBeenCalledOnce();
    expect(h.setError).toHaveBeenLastCalledWith(fallback);
    expect(h.setNotice).toHaveBeenCalledExactlyOnceWith('');
    expect(h.load).not.toHaveBeenCalled();
    expect(h.setBusy).toHaveBeenLastCalledWith(false);
  });

  it('preserves the error code when preparing a newly invited membership fails', async () => {
    const h = harness(accounts, 'inviteNewUser');
    h.rpc.mockResolvedValueOnce({ data: { exists: false }, error: null })
      .mockResolvedValueOnce({ error: { code: '23505', message: 'internal duplicate detail' } });
    await h.handler();
    expect(h.signUp).toHaveBeenCalledOnce();
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.setError).toHaveBeenLastCalledWith('That record already exists.');
    expect(h.load).not.toHaveBeenCalled();
    expect(h.setBusy).toHaveBeenLastCalledWith(false);
  });

  it.each(actions)('preserves successful %s %s behavior', async (path, name) => {
    const h = harness(path, name);
    h.rpc.mockResolvedValue({ data: { exists: name !== 'inviteNewUser', membership_status: 'invited' }, error: null });
    await h.handler();
    expect(h.setError).toHaveBeenCalledExactlyOnceWith('');
    expect(h.setBusy.mock.calls).toEqual([[true], [false]]);
    if (name === 'inviteNewUser' || name === 'addExisting') expect(h.load).toHaveBeenCalledOnce();
    if (name === 'resendSetup' || name === 'resendSetupEmail') expect(h.resend).toHaveBeenCalledOnce();
    if (name === 'sendRecovery') expect(h.resetPasswordForEmail).toHaveBeenCalledOnce();
  });

  it.each([
    [accounts, 'inviteNewUser', { exists: true },
      'An account already exists for this email. Use Add Existing User instead.'],
    [accounts, 'resendSetupEmail', { exists: false },
      'No Living Teacher Planner account exists for this email.'],
    [diagnostics, 'resendSetup', { exists: true, membership_status: 'active' },
      'This school membership is not currently INVITED.'],
    [diagnostics, 'sendRecovery', { exists: true, membership_status: 'invited' },
      'The email is not confirmed yet. Resend Account Setup instead.'],
  ] as const)('preserves application guidance in %s %s', async (path, name, data, expected) => {
    const h = harness(path, name);
    h.rpc.mockResolvedValue({ data, error: null });
    h.queryDiagnostic.mockResolvedValue(data);
    await h.handler();
    expect(h.setError).toHaveBeenLastCalledWith(expected);
    expect(h.signUp).not.toHaveBeenCalled();
    expect(h.resend).not.toHaveBeenCalled();
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(h.setBusy).toHaveBeenLastCalledWith(false);
  });
});

describe.each([
  [accounts, ['owner', 'schools', 'school_memberships', 'profiles'], 'Account management failed to load.'],
  [diagnostics, ['owner', 'schools', 'school_memberships'], 'Invitation diagnostics could not be loaded.'],
] as const)('%s initial load', (path, errorSources, fallback) => {
  function initialLoad(errorSource: string, error: unknown) {
    const setError = vi.fn();
    const setLoading = vi.fn();
    const setAuthorized = vi.fn();
    const formatter = vi.fn(formatError);
    const result = (source: string) => Promise.resolve({
      data: [], error: source === errorSource ? error : null,
    });
    const context = {
      supabase: {
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'admin' } } } }) },
        rpc: () => result('owner'),
        from: (table: string) => ({
          select: () => Object.assign(result(table), { order: () => result(table) }),
        }),
      },
      setError, setLoading, setAuthorized, formatError: formatter,
      setCurrentUserId: vi.fn(), router: { replace: vi.fn() },
    };
    const load = pageHandler<() => Promise<void>>(path, 'load', context);
    pageEffect(path, { ...context, load })();
    return { setError, setLoading, setAuthorized, formatter };
  }

  it.each(errorSources)('preserves the %s error object for safe code mapping', async (errorSource) => {
    const error = { code: '42501', message: 'internal permission detail', details: 'secret' };
    const h = initialLoad(errorSource, error);
    await vi.waitFor(() => expect(h.setLoading).toHaveBeenLastCalledWith(false));
    expect(h.formatter).toHaveBeenCalledWith(error, fallback);
    expect(h.setError).toHaveBeenLastCalledWith(permissionMessage);
    expect(h.setAuthorized).not.toHaveBeenCalled();
  });

  it('uses its contextual fallback for schema errors', async () => {
    const h = initialLoad('owner', technicalError);
    await vi.waitFor(() => expect(h.setLoading).toHaveBeenLastCalledWith(false));
    expect(h.setError).toHaveBeenLastCalledWith(fallback);
  });
});

describe('account error formatter wiring', () => {
  it.each([accounts, diagnostics])('%s imports the shared formatter without raw error coercion', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain("import { formatError } from '@/lib/format-error';");
    expect(source).not.toContain('String(err)');
    expect(source).not.toContain('err.message');
    expect(source).not.toContain('firstError?.message');
  });
});

