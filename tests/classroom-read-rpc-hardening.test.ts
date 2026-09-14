import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260914230000_harden_classroom_read_search_path.sql'
  ),
  'utf8'
);

describe('anonymous classroom read RPC hardening', () => {
  it('runs the SECURITY DEFINER read RPC with an empty search path', () => {
    expect(migration).toContain('create or replace function public.get_classroom_assessment');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
  });

  it('keeps assessment answers and accepted-answer data out of the anonymous payload', () => {
    expect(migration).not.toContain('correct_answer');
    expect(migration).not.toContain('accepted_answers');
    expect(migration).toContain("'options', q.options");
  });

  it('preserves only intentional anonymous execute access', () => {
    expect(migration).toContain('revoke all on function public.get_classroom_assessment(text)');
    expect(migration).toContain('to anon, authenticated;');
  });
});
