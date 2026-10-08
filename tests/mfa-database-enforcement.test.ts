import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260925144500_data_api_mfa_enforcement_gate.sql'
  ),
  'utf8'
);

describe('Data API MFA enforcement gate', () => {
  it('installs disabled by default for a safe production rollout', () => {
    expect(migration).toContain("values ('require_authenticated_aal2', false)");
  });

  it('blocks authenticated AAL1 only when the feature flag is enabled', () => {
    expect(migration).toContain("v_role <> 'authenticated'");
    expect(migration).toContain("v_aal <> 'aal2'");
    expect(migration).toContain("'LTG_MFA_REQUIRED'");
  });

  it('keeps the hook private from application roles', () => {
    expect(migration).toContain(
      'revoke all on function public.enforce_ltg_request_security() from public, anon, authenticated, service_role'
    );
    expect(migration).toContain(
      'grant execute on function public.enforce_ltg_request_security() to authenticator'
    );
  });

  it('registers the request hook with PostgREST', () => {
    expect(migration).toContain(
      "set pgrst.db_pre_request = 'public.enforce_ltg_request_security'"
    );
    expect(migration).toContain("notify pgrst, 'reload config'");
  });
});
