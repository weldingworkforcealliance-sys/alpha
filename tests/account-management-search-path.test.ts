import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914232000_harden_account_management_search_paths.sql'
  ),
  'utf8'
);

describe('account management SECURITY DEFINER hardening', () => {
  it('moves sensitive account-management helpers to an empty search path', () => {
    for (const signature of [
      'activate_my_invited_memberships()',
      'can_invite_school_role(uuid, text)',
      'admin_add_existing_user_to_school(uuid, text, text, text)',
      'admin_lookup_user_by_email(uuid, text)',
      'admin_prepare_invited_user(uuid, uuid, text, text, text, text)',
      'owner_update_profile_display_name(uuid, text, text)',
      'owner_update_school_membership(uuid, text, text, text)',
      'write_audit_event(uuid, text, text, uuid, jsonb)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(8);
  });

  it('does not change grants or redefine account behavior', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
