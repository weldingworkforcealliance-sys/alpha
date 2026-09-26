import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const login = read('app/login/page.tsx');
const setup = read('app/account-setup/page.tsx');
const mfa = read('app/mfa/page.tsx');
const gate = read('app/mfa-gate.tsx');
const layout = read('app/layout.tsx');

describe('LTG multi-factor authentication flow', () => {
  it('checks authenticator assurance immediately after password sign-in', () => {
    expect(login).toContain('getAuthenticatorAssuranceLevel()');
    expect(login).toContain("NEXT_PUBLIC_REQUIRE_MFA === 'true'");
    expect(login).toContain('router.replace(`/mfa?next=${encodeURIComponent(nextRoute)}`)');
  });

  it('supports TOTP enrollment, challenge, and verification', () => {
    expect(mfa).toContain("factorType: 'totp'");
    expect(mfa).toContain('supabase.auth.mfa.challenge({ factorId })');
    expect(mfa).toContain('supabase.auth.mfa.verify({');
    expect(mfa).toContain("aal.currentLevel !== 'aal2'");
  });

  it('routes first-time setup through MFA when enforcement is enabled', () => {
    expect(setup).toContain("NEXT_PUBLIC_REQUIRE_MFA === 'true'");
    expect(setup).toContain("router.replace('/mfa?next=%2Fdashboard')");
  });

  it('gates existing authenticated sessions when MFA is required or already enrolled', () => {
    expect(gate).toContain("aal.nextLevel === 'aal2' || REQUIRE_MFA");
    expect(gate).toContain('router.replace(`/mfa?next=${next}`)');
    expect(layout).toContain('<MfaGate pathname={pathname} />');
    expect(layout).toContain("pathname === '/mfa'");
  });
});
