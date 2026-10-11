import { describe, expect, it } from 'vitest';
import { parseRecoveryRedirect } from '../lib/auth-recovery-redirect';

describe('reset-password email callback formats', () => {
  it('supports GoTrue implicit-flow tokens used by recovery emails', () => {
    expect(parseRecoveryRedirect('', '#access_token=one&refresh_token=two&type=recovery')).toEqual({
      kind: 'implicit',
      accessToken: 'one',
      refreshToken: 'two',
    });
  });
  it('supports PKCE code callbacks without exposing the code to UI state', () => {
    expect(parseRecoveryRedirect('?code=verifier123', '')).toEqual({
      kind: 'pkce',
      code: 'verifier123',
    });
  });
  it('supports recovery token hashes in custom email templates', () => {
    expect(parseRecoveryRedirect('?token_hash=abc123&type=recovery', '')).toEqual({
      kind: 'token_hash',
      tokenHash: 'abc123',
    });
  });
  it('rejects an incomplete pair of tokens', () => {
    expect(parseRecoveryRedirect('', '#access_token=one&type=recovery')).toEqual({
      kind: 'error',
      message: 'Incomplete recovery link. Request a new password reset email.',
    });
  });
  it('does not confuse invite or signup links with recovery', () => {
    expect(parseRecoveryRedirect('?code=one&type=invite', '').kind).toBe('error');
    expect(parseRecoveryRedirect('', '#access_token=one&refresh_token=two&type=signup').kind)
      .toBe('error');
  });
  it('surfaces expired-link responses rather than silently returning to login', () => {
    expect(parseRecoveryRedirect('', '#error=access_denied&error_description=Link+expired')).toEqual({
      kind: 'error',
      message: 'Link expired',
    });
  });
  it('allows initial recovery request pages without a callback', () => {
    expect(parseRecoveryRedirect('', '')).toEqual({ kind: 'none' });
  });
});
