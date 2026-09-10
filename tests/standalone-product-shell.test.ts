import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('standalone LTG product shell', () => {
  it('keeps the public home page separate from the authenticated workspace', () => {
    const layout = read('app/layout.tsx');
    const home = read('app/page.tsx');

    expect(layout).toContain("const isMarketingRoute = pathname === '/';");
    expect(layout).toContain('isMarketingRoute || isAuthRoute');
    expect(home).toContain('Founding School Beta');
    expect(home).toContain('href="/login"');
  });

  it('presents LTG as program-neutral while retaining welding as the proof case', () => {
    const layout = read('app/layout.tsx');
    const home = read('app/page.tsx');

    expect(layout).toContain('LTG | Education Operating System');
    expect(layout).toContain('Education');
    expect(layout).toContain('Operating System');
    expect(home).toContain('Welding is the first proof, not the boundary.');
    expect(home).toContain('Nursing');
  });

  it('does not run authenticated usage tracking on the public marketing route', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain("{!isMarketingRoute && <UsageTracker pathname={pathname} />}");
  });
});
