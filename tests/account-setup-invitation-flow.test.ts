import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const accountSetup = readFileSync('app/account-setup/page.tsx', 'utf8');

describe('account setup invitation flow', () => {
  it('consumes the default Supabase implicit confirmation session from the URL fragment', () => {
    expect(accountSetup).toContain("hashParams.get('access_token')");
    expect(accountSetup).toContain("hashParams.get('refresh_token')");
    expect(accountSetup).toContain('supabase.auth.setSession');
    expect(accountSetup).toContain("window.history.replaceState({}, '', window.location.pathname)");
  });

  it('keeps alternate token-hash and numeric OTP confirmation paths available', () => {
    expect(accountSetup).toContain("params.get('token_hash')");
    expect(accountSetup).toContain('supabase.auth.verifyOtp');
    expect(accountSetup).toContain('Optional code fallback');
  });

  it('activates invited school memberships only after the user creates a password', () => {
    expect(accountSetup).toContain('supabase.auth.updateUser');
    expect(accountSetup).toContain("supabase.rpc('activate_my_invited_memberships')");
  });
});
