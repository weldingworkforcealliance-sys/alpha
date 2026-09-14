import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914235500_strengthen_live_join_code_entropy.sql'
  ),
  'utf8'
);

describe('live anonymous join-code entropy', () => {
  it('creates eight-character random classroom codes for new sessions', () => {
    expect(migration).toContain('create or replace function public.make_classroom_join_code()');
    expect(migration).toContain("extensions.gen_random_bytes(8),'hex'),1,8");
  });

  it('uses the same stronger generator length for new job-card sessions', () => {
    expect(migration).toContain('create or replace function private.job_card_generate_code()');
    expect(migration.match(/,1,8\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('keeps generator helpers off the client RPC surface', () => {
    expect(migration).toContain(
      'revoke all on function public.make_classroom_join_code()'
    );
    expect(migration).toContain(
      'revoke all on function private.job_card_generate_code()'
    );
    expect(migration).toContain('from public, anon, authenticated;');
  });
});
