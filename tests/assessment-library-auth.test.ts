import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260910211500_harden_assessment_library_listing.sql'
  ),
  'utf8'
);

describe('assessment library authorization', () => {
  it('requires an authenticated user inside the SECURITY DEFINER function', () => {
    expect(migration).toContain('if auth.uid() is null then');
    expect(migration).toContain("raise exception 'Authentication required'");
    expect(migration).toContain("set search_path = ''");
  });

  it('keeps anonymous callers revoked and authenticated callers enabled', () => {
    expect(migration).toContain(
      'revoke all on function public.list_assessment_modules_v2()\n  from public, anon, authenticated;'
    );
    expect(migration).toContain(
      'grant execute on function public.list_assessment_modules_v2()\n  to authenticated;'
    );
  });
});
