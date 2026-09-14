import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const automotive = readFileSync(
  join(process.cwd(), 'app/pccc-automotive-skin.css'),
  'utf8'
);
const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');
const registry = readFileSync(join(process.cwd(), 'lib/skin-registry.ts'), 'utf8');

describe('archived PCCC Welding automotive skin', () => {
  it('keeps all PCCC skin CSS outside the live application shell', () => {
    expect(layout).not.toContain("import './pccc-welding-skin.css';");
    expect(layout).not.toContain("import './pccc-automotive-skin.css';");
    expect(layout).not.toContain('TenantSkinProvider');
    expect(layout).not.toContain('PcccSkinController');
  });

  it('retains the historical school/admin and instructor assets for rollback only', () => {
    expect(automotive).toContain('body.pccc-school-skin');
    expect(automotive).toContain('--pccc-auto-frame-main: var(--pccc-auto-red)');
    expect(automotive).toContain('body.pccc-instructor-skin');
    expect(automotive).toContain('--pccc-auto-frame-main: var(--pccc-auto-blue)');
  });

  it('retains historical light and dark rules without activating them', () => {
    expect(automotive).toContain("html[data-theme='dark'] body.pccc-welding-skin");
    expect(automotive).toContain("html[data-theme='light'] body.pccc-welding-skin");
    expect(layout).not.toContain('pccc-welding-skin');
  });

  it('does not request the retired missing PCCC stylesheet URLs', () => {
    expect(registry).not.toContain('/pccc-portal-shell.css');
    expect(registry).not.toContain('/pccc-light-mode.css');
  });
});
