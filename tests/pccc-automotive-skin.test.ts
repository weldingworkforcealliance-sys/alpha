import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const automotive = readFileSync(
  join(process.cwd(), 'app/pccc-automotive-skin.css'),
  'utf8'
);
const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');
const registry = readFileSync(join(process.cwd(), 'lib/skin-registry.ts'), 'utf8');

describe('PCCC Welding automotive skin', () => {
  it('loads after the legacy PCCC compatibility skin', () => {
    const legacy = "import './pccc-welding-skin.css';";
    const automotiveImport = "import './pccc-automotive-skin.css';";
    expect(layout).toContain(legacy);
    expect(layout).toContain(automotiveImport);
    expect(layout.indexOf(automotiveImport)).toBeGreaterThan(layout.indexOf(legacy));
  });

  it('keeps school/admin red and instructor blue as independent role identities', () => {
    expect(automotive).toContain('body.pccc-school-skin');
    expect(automotive).toContain('--pccc-auto-frame-main: var(--pccc-auto-red)');
    expect(automotive).toContain('body.pccc-instructor-skin');
    expect(automotive).toContain('--pccc-auto-frame-main: var(--pccc-auto-blue)');
  });

  it('supports both dark and light modes without changing role identity', () => {
    expect(automotive).toContain("html[data-theme='dark'] body.pccc-welding-skin");
    expect(automotive).toContain("html[data-theme='light'] body.pccc-welding-skin");
    expect(automotive).toContain("html[data-theme='light'] body.pccc-school-skin");
    expect(automotive).toContain("html[data-theme='light'] body.pccc-instructor-skin");
  });

  it('uses a clear-coat painted steel shell and selected-state highlight', () => {
    expect(automotive).toContain('.app-container::before');
    expect(automotive).toContain('repeating-linear-gradient');
    expect(automotive).toContain('var(--pccc-auto-frame-glow)');
    expect(automotive).toContain("a[aria-current='page']");
  });

  it('does not request the retired missing PCCC stylesheet URLs', () => {
    expect(registry).not.toContain('/pccc-portal-shell.css');
    expect(registry).not.toContain('/pccc-light-mode.css');
  });
});
