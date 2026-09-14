import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914235000_harden_attendance_vault_helpers.sql'
  ),
  'utf8'
);

describe('attendance worker Vault helper hardening', () => {
  it('moves both service-only Vault helpers to an empty search path', () => {
    expect(migration).toContain('alter function public.get_attendance_worker_config()');
    expect(migration).toContain('alter function public.verify_attendance_worker_secret(text)');
    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(2);
  });

  it('does not redefine functions or modify grants', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
