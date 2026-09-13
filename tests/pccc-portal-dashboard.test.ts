import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('PCCC portal dashboard', () => {
  it('mounts the role-aware portal on the dashboard', () => {
    const layout = read('app/layout.tsx');
    const portal = read('app/pccc-portal-dashboard.tsx');

    expect(layout).toContain("import PcccPortalDashboard from './pccc-portal-dashboard';");
    expect(layout).toContain("pathname === '/dashboard' && <PcccPortalDashboard />");
    expect(portal).toContain("skinId === 'pccc-welding'");
    expect(portal).toContain("accessMode === 'school'");
    expect(portal).toContain("accessMode === 'instructor'");
  });

  it('replaces the legacy dashboard surface only for the PCCC skin', () => {
    const css = read('app/pccc-portal-dashboard.css');

    expect(css).toContain("html[data-ltg-skin='pccc-welding'] body.ltg-dashboard-route .dashboard-container");
    expect(css).toContain('.pccc-portal-dashboard__education-strip');
    expect(css).toContain('var(--skin-role-metal-hi)');
  });

  it('keeps Finsen Sierra outside the PCCC skin build', () => {
    const portal = read('app/pccc-portal-dashboard.tsx');
    const css = read('app/pccc-portal-dashboard.css');

    expect(portal.toLowerCase()).not.toContain('finsen');
    expect(css).not.toContain("[class*='finsen']");
  });
});
