import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getLtgSkinDefinition } from '../lib/skin-registry';

const css = readFileSync(join(process.cwd(), 'public/pccc-real-painted-steel.css'), 'utf8');
const texture = readFileSync(join(process.cwd(), 'public/skins/pccc-metalflake-texture.svg'), 'utf8');
const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');

describe('archived PCCC real painted-steel assets', () => {
  it('keeps the historical registry entry without mounting the skin runtime', () => {
    expect(getLtgSkinDefinition('pccc-welding').stylesheetHrefs).toContain(
      '/pccc-real-painted-steel.css?v=20260914-1'
    );
    expect(layout).not.toContain('TenantSkinProvider');
    expect(layout).not.toContain('TenantBrandLockup');
  });

  it('retains reusable texture assets for rollback or future design reference only', () => {
    expect(css).toContain("url('/skins/pccc-metalflake-texture.svg')");
    expect(texture).toContain('feTurbulence');
    expect(texture).toContain('feSpecularLighting');
  });

  it('keeps archived school and instructor rules isolated from the live shell', () => {
    expect(css).toContain('body.pccc-school-skin');
    expect(css).toContain('body.pccc-instructor-skin');
    expect(layout).not.toContain("./pccc-welding-skin.css");
    expect(layout).not.toContain("./pccc-automotive-skin.css");
  });
});
