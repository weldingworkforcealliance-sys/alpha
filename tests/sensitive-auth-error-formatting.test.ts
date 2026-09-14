import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const accountSetup = read('app/account-setup/page.tsx');
const resetPassword = read('app/reset-password/page.tsx');
const trainingLogin = read('app/training/login/page.tsx');

describe('sensitive auth surfaces use sanitized user-facing errors', () => {
  for (const [name, source] of [
    ['account setup', accountSetup],
    ['password reset', resetPassword],
    ['training sign in', trainingLogin],
  ] as const) {
    it(`${name} uses the shared safe error formatter`, () => {
      expect(source).toContain("import { formatError } from '@/lib/format-error';");
      expect(source).toContain('formatError(err');
      expect(source).not.toContain('String(err)');
    });
  }

  it('keeps context-specific fallback messages instead of a generic database dump', () => {
    expect(accountSetup).toContain('Account setup could not be completed.');
    expect(resetPassword).toContain('Password could not be updated.');
    expect(trainingLogin).toContain('Training sign in could not be completed.');
  });

  it('does not silently ignore invited-membership activation failures', () => {
    for (const source of [resetPassword, trainingLogin]) {
      expect(source).toContain("const { error: activationError } = await supabase.rpc(");
      expect(source).toContain("'activate_my_invited_memberships'");
      expect(source).toContain('if (activationError) throw activationError;');
    }
  });
});
