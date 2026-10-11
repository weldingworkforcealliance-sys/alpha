import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPublicRoute, safePostLoginRoute } from '../lib/auth-routes';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const page = read('app/wld205-review/page.tsx');
const client = read('app/wld205-review/ReviewClient.tsx');
const layout = read('app/layout.tsx');
const login = read('app/login/page.tsx');

describe('WLD205 one-click, public-safe layout review', () => {
  it('is accessible without login only at the exact intended route', () => {
    expect(isPublicRoute('/wld205-review')).toBe(true);
    expect(isPublicRoute('/wld205-review/admin')).toBe(false);
    expect(isPublicRoute('/planner')).toBe(false);
    expect(safePostLoginRoute('/wld205-review')).toBe('/dashboard');
  });

  it('is disabled outside staging, and not indexed', () => {
    expect(page).toContain("process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'staging'");
    expect(page).toContain('notFound()');
    expect(page).toContain('index: false');
    expect(page).toContain('follow: false');
  });

  it('contains 30 example days and uses the actual LTG teaching console', () => {
    const topics = client.match(/^  \{ title: '[^\n]+', focus: '[^\n]+', kind: '[a-z]+' \},$/gm);
    expect(topics).toHaveLength(30);
    expect(client).toContain('PlannerTeachingConsole');
    expect(client).toContain('compactInstructorView={compact}');
    expect(client).toContain('onSelectDay={changeDay}');
    expect(client).toContain('READ');
    expect(client).toContain('anthonyDaySupport(day)');
    expect(client).toContain('sampleResources(day, topic)');
  });

  it('does not connect to staging or production Supabase or persist edits', () => {
    expect(client).not.toContain('getSupabase');
    expect(client).not.toMatch(/supabase[.]|from\(['"]|\.rpc\(|fetch\(/i);
    expect(client).not.toContain('sessionStorage');
    expect(client).not.toContain('localStorage');
    expect(client).toContain('Read-only');
    expect(client).toContain('Student records');
    expect(client).toContain('FABTECH is a separate demo');
  });

  it('keeps FABTECH routes and authenticated operations isolated', () => {
    expect(layout).toContain("pathname === '/wld205-review'");
    expect(layout).toContain('!isDemoRoute && !isWld205ReviewRoute');
    expect(layout).toContain('!isWld205ReviewRoute && <UsageTracker');
    expect(login).toContain("process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'");
    expect(login).toContain("router.push('/wld205-review')");
    expect(isPublicRoute('/demo/welding')).toBe(true);
  });
});
