import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260915000500_bound_demo_session_creation.sql'
  ),
  'utf8'
);

describe('public demo session creation guard', () => {
  it('serializes anonymous session creation before checking capacity', () => {
    expect(migration).toContain(
      "pg_advisory_xact_lock(hashtext('ltg_demo_session_creation'))"
    );
  });

  it('limits burst creation and total active demo sessions', () => {
    expect(migration).toContain(") >= 30 then");
    expect(migration).toContain(") >= 200 then");
    expect(migration).toContain("interval '1 minute'");
  });

  it('uses eight-character random codes for newly created demo sessions', () => {
    expect(migration).toContain("extensions.gen_random_bytes(8),'hex'),1,8");
  });

  it('keeps creation intentionally available only through the explicit anon/authenticated RPC grant', () => {
    expect(migration).toContain(
      'revoke all on function public.create_demo_classroom_session(text,text,text,integer)'
    );
    expect(migration).toContain('to anon, authenticated;');
  });
});
