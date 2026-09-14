import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914234000_harden_anonymous_demo_classroom.sql'
  ),
  'utf8'
);
const helperMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914234500_harden_demo_cleanup_helper.sql'
  ),
  'utf8'
);

describe('anonymous demo classroom hardening', () => {
  it('moves all intentional anonymous demo SECURITY DEFINER RPCs to an empty search path', () => {
    for (const signature of [
      'create_demo_classroom_session(text,text,text,integer)',
      'end_demo_classroom_session(uuid,uuid)',
      'get_demo_classroom_assessment(text)',
      'get_demo_classroom_results(uuid,uuid)',
      'get_demo_classroom_submission_report(uuid,uuid)',
    ]) {
      expect(migration).toContain(`alter function public.${signature}`);
    }
    expect(migration.match(/set search_path = ''/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });

  it('hardens the privileged cleanup helper and keeps it off the public RPC surface', () => {
    expect(helperMigration).toContain(
      'alter function public.cleanup_demo_classroom_sessions()'
    );
    expect(helperMigration).toContain("set search_path = ''");
    expect(helperMigration).toContain(
      'revoke all on function public.cleanup_demo_classroom_sessions()'
    );
    expect(helperMigration).toContain('from public, anon, authenticated;');
  });

  it('bounds anonymous demo participant growth', () => {
    expect(migration).toContain(") >= 60 then");
    expect(migration).toContain('This demo session has reached its participant limit');
  });

  it('bounds anonymous assessment payload and answer sizes', () => {
    expect(migration).toContain('pg_column_size(p_answers) > 65536');
    expect(migration).toContain("length(coalesce(p_answers->>q.question_key,'')) > 2000");
  });

  it('keeps direct execution limited to the intentional demo RPC contract', () => {
    expect(migration).toContain(
      'revoke all on function public.connect_demo_classroom_student(text,text)'
    );
    expect(migration).toContain(
      'revoke all on function public.submit_demo_classroom_assessment(text,text,jsonb)'
    );
    expect(migration).toContain('to anon, authenticated;');
  });
});
