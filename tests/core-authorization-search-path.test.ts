import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914231500_harden_core_authorization_search_path.sql'
  ),
  'utf8'
);

describe('core authorization SECURITY DEFINER hardening', () => {
  it('moves the hot authorization helpers to an empty search path', () => {
    for (const signature of [
      'is_platform_owner()',
      'is_school_member(uuid)',
      'has_school_role(uuid, public.app_school_role[])',
      'is_section_instructor(uuid, uuid)',
      'can_manage_school(uuid)',
      'can_manage_memberships(uuid)',
      'can_review_instruction(uuid)',
      'is_school_instructional_staff(uuid)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }

    expect(migration.match(/set search_path = '';/g)?.length ?? 0).toBe(8);
  });

  it('does not redefine authorization behavior in this migration', () => {
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migration).not.toMatch(/grant\s+/i);
    expect(migration).not.toMatch(/revoke\s+/i);
  });
});
