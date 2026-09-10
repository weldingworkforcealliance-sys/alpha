import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migrationPath =
  'supabase/migrations/20260910190000_harden_audit_write_surface.sql';
const ownerAdminPath = 'app/owner/admin/page.tsx';

describe('audit write surface hardening', () => {
  it('removes the generic audit writer from authenticated browser RPC access', () => {
    const migration = read(migrationPath);

    expect(migration).toContain(
      'revoke execute on function public.write_audit_event(uuid, text, text, uuid, jsonb)'
    );
    expect(migration).toContain('from public, anon, authenticated;');
    expect(migration).toContain(
      'grant execute on function public.write_audit_event(uuid, text, text, uuid, jsonb)\n  to service_role;'
    );
  });

  it('provides a narrow owner-only password reset audit endpoint', () => {
    const migration = read(migrationPath);

    expect(migration).toContain(
      'create or replace function public.record_owner_password_reset_request('
    );
    expect(migration).toContain('if not public.is_platform_owner() then');
    expect(migration).toContain("'owner_send_password_reset'");
    expect(migration).toContain("'profile'");
    expect(migration).toContain(
      'grant execute on function public.record_owner_password_reset_request(uuid, text, text)'
    );
  });

  it('routes the owner browser through the narrow audit endpoint', () => {
    const ownerAdmin = read(ownerAdminPath);

    expect(ownerAdmin).toContain(
      "supabase.rpc('record_owner_password_reset_request'"
    );
    expect(ownerAdmin).not.toContain("supabase.rpc('write_audit_event'");
  });
});
