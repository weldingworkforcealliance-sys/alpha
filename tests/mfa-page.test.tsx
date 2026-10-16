// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MfaPage from '@/app/mfa/page';
const mock = vi.hoisted(() => ({ auth: { getUser: vi.fn(), signOut: vi.fn(), mfa: { getAuthenticatorAssuranceLevel: vi.fn(), listFactors: vi.fn(), challengeAndVerify: vi.fn() } }, rpc: vi.fn() }));
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => mock }));
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.getUser.mockResolvedValue({ data: { user: { id: 'synthetic' } }, error: null });
  mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
  mock.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor-1', status: 'verified' }, { id: 'unverified', status: 'unverified' }] }, error: null });
  mock.auth.mfa.challengeAndVerify.mockResolvedValue({ error: null });
});
afterEach(cleanup);
it('keeps rejected codes on the challenge and never activates membership', async () => {
  mock.auth.mfa.challengeAndVerify.mockResolvedValue({ error: new Error('expired') });
  render(<MfaPage />);
  fireEvent.change(await screen.findByLabelText('Authenticator Code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
  await screen.findByText(/That code was not accepted/);
  expect(mock.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('checks AAL2 after successful verification instead of trusting the form', async () => {
  render(<MfaPage />);
  fireEvent.change(await screen.findByLabelText('Authenticator Code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
  await screen.findByText(/Verification is incomplete/);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('does not offer an unverified factor as a bypass', async () => {
  mock.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'pending', status: 'unverified' }] }, error: null });
  render(<MfaPage />);
  await screen.findByText(/requires another verification method/);
  expect(screen.queryByLabelText('Authenticator Code')).toBeNull();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('recovers from an assurance lookup failure with an explicit retry', async () => {
  mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  render(<MfaPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry verification check' }));
  await screen.findByLabelText('Authenticator Code');
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
