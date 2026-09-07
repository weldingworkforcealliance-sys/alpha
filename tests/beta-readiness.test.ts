import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('live beta safety gates', () => {
  it('filters student-display resources by both safe metadata and allowed type', () => {
    const display = read('app/student-display/[guideDayId]/page.tsx');
    expect(display).toContain('resource_url,student_safe');
    expect(display).toContain('resource.student_safe && SAFE_RESOURCE_TYPES.has');
  });

  it('keeps the Live Job Card launcher instructor-only', () => {
    const migration = read('supabase/migrations/202609070002_level2_job_card_resource_links.sql');
    expect(migration).toContain("'job_card'");
    expect(migration).toMatch(/'school_owned',\s*false/);
  });

  it('enforces one active Job Card and the configured student capacity in the database', () => {
    const migration = read('supabase/migrations/202609070001_live_job_cards.sql');
    expect(migration).toContain('job_card_sessions_one_active_per_section_uq');
    expect(migration).toContain('submission_count >= s.expected_students');
    expect(migration).toContain('lower(trim(sub.student_id))=lower(trim(p_student_id))');
  });

  it('uses clock-aware sign-out throughout Training Mode', () => {
    for (const path of [
      'app/training/page.tsx',
      'app/training/session/[id]/teacher/page.tsx',
      'app/training/session/[id]/school/page.tsx',
    ]) {
      const source = read(path);
      expect(source).toContain("from '@/lib/guarded-signout'");
      expect(source).toContain('guardedSignOut(');
      expect(source).not.toContain('supabase.auth.signOut()');
    }
  });
});
