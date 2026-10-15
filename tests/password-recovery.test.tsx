// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recoveryCallbackPath, RECOVERY_REQUEST_KEY } from '@/lib/password-recovery';
import ResetPasswordPage from '@/app/reset-password/page';

const mock = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), setSession: vi.fn(), exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), resetPasswordForEmail: vi.fn() },
}));
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => mock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/reset-password');
  window.localStorage.clear();
  mock.auth.getSession.mockResolvedValue({ data: { session: null } });
  mock.auth.setSession.mockResolvedValue({ error: null });
  mock.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  mock.auth.verifyOtp.mockResolvedValue({ error: null });
  mock.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe('recovery callbacks', () => {
  it('routes explicit recovery fragments locally without following a supplied next URL', () => {
    expect(recoveryCallbackPath('?next=https://example.com', '#type=recovery&access_token=test', null)).toBe('/reset-password?next=https://example.com#type=recovery&access_token=test');
  });
  it('routes PKCE callbacks only with a recent reset request', () => {
    expect(recoveryCallbackPath('?code=test', '', '1000', 2000)).toBe('/reset-password?code=test');
    expect(recoveryCallbackPath('?code=test', '', null, 2000)).toBeNull();
    expect(recoveryCallbackPath('?code=test', '', '1000', 3601001)).toBeNull();
    expect(recoveryCallbackPath('', '', '1000', 2000)).toBeNull();
  });
  it('accepts implicit recovery links and removes credentials from the address bar', async () => {
    window.history.replaceState({}, '', '/reset-password#type=recovery&access_token=test-access&refresh_token=test-refresh');
    render(<ResetPasswordPage />);
    await screen.findByLabelText('New Password');
    expect(mock.auth.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
    expect(window.location.hash).toBe('');
  });
  it('accepts recovery token hashes', async () => {
    window.history.replaceState({}, '', '/reset-password?token_hash=test-hash&type=recovery');
    render(<ResetPasswordPage />);
    await screen.findByLabelText('New Password');
    expect(mock.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'test-hash', type: 'recovery' });
    expect(window.location.search).toBe('');
  });
  it('does not exchange an already consumed PKCE code again', async () => {
    window.history.replaceState({}, '', '/reset-password?code=test');
    mock.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'synthetic' } } } });
    render(<ResetPasswordPage />);
    await screen.findByLabelText('New Password');
    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('exchanges an unconsumed PKCE code', async () => {
    window.history.replaceState({}, '', '/reset-password?code=test');
    render(<ResetPasswordPage />);
    await screen.findByLabelText('New Password');
    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledWith('test');
  });
  it('shows expired-link errors instead of silently returning to a code prompt', async () => {
    window.history.replaceState({}, '', '/reset-password#error_description=expired');
    render(<ResetPasswordPage />);
    await screen.findByText(/This reset link is expired or invalid/);
    expect(screen.queryByLabelText('New Password')).toBeNull();
    expect(window.location.hash).toBe('');
  });
  it('describes link recovery and keeps codes optional', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }));
    await screen.findByLabelText('Verification Code (optional)');
    expect(screen.getByText(/Open the newest link in this browser/)).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem(RECOVERY_REQUEST_KEY)).not.toBeNull());
    expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith('synthetic@example.com', { redirectTo: `${window.location.origin}/reset-password` });
  });
});
