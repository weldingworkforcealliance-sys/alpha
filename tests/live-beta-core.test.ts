import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('live beta core safety', () => {
  it('filters student resources by both safe metadata and allowed type', () => {
    const display = read('app/student-display/[guideDayId]/page.tsx');
    expect(display).toContain('resource_url,student_safe');
    expect(display).toContain('resource.student_safe && SAFE_RESOURCE_TYPES.has');
  });

  it('uses the shared client and clock-aware sign-out throughout Training Mode', () => {
    for (const path of [
      'app/training/page.tsx',
      'app/training/session/[id]/teacher/page.tsx',
      'app/training/session/[id]/school/page.tsx',
    ]) {
      const source = read(path);
      expect(source).toContain("from '@/lib/guarded-signout'");
      expect(source).toContain('guardedSignOut(');
      expect(source).not.toContain('supabase.auth.signOut()');
      expect(source).not.toContain("from '@supabase/ssr'");
    }
  });
});
