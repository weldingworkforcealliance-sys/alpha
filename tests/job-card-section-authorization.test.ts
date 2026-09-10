import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const migrationPath =
  'supabase/migrations/20260910193000_harden_job_card_section_authorization.sql';

describe('Live Job Card section authorization hardening', () => {
  it('requires actual section authority for ordinary instructors', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('public.is_platform_owner()');
    expect(migration).toContain('public.can_review_instruction(v_section.school_id)');
    expect(migration).toContain(
      'public.is_section_instructor(v_section.school_id, p_section_id)'
    );
    expect(migration).toContain(
      "raise exception 'Assigned instructor or school management access required'"
    );
    expect(migration).not.toContain(
      'if not private.job_card_can_instruct(v_section.school_id, v_uid) then'
    );
  });

  it('preserves the existing capacity and requirement validation', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('p_expected_students > 17');
    expect(migration).toContain(
      "raise exception 'Expected students must be between 1 and 17'"
    );
    expect(migration).toContain('jsonb_array_length(p_requirements) < 1');
    expect(migration).toContain('jsonb_array_length(p_requirements) > 4');
    expect(migration).toContain(
      "raise exception 'Job requirement keys must be unique'"
    );
  });

  it('keeps the RPC unavailable to anonymous callers', () => {
    const migration = read(migrationPath);

    expect(migration).toContain('from public, anon;');
    expect(migration).toContain('to authenticated, service_role;');
  });
});
