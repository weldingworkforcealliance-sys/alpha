import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getLtgSkinDefinition } from '../lib/skin-registry';

const css = readFileSync(join(process.cwd(), 'public/pccc-real-painted-steel.css'), 'utf8');
const texture = readFileSync(join(process.cwd(), 'public/skins/pccc-metalflake-texture.svg'), 'utf8');

describe('PCCC real painted-steel skin', () => {
  it('loads as the final PCCC runtime skin asset', () => {
    expect(getLtgSkinDefinition('pccc-welding').stylesheetHrefs).toContain(
      '/pccc-real-painted-steel.css?v=20260914-1'
    );
  });

  it('uses real reusable metallic flake texture', () => {
    expect(css).toContain("url('/skins/pccc-metalflake-texture.svg')");
    expect(texture).toContain('feTurbulence');
    expect(texture).toContain('feSpecularLighting');
  });

  it('keeps school and instructor paint identities distinct', () => {
    expect(css).toContain('body.pccc-school-skin');
    expect(css).toContain('#a70b1d');
    expect(css).toContain('body.pccc-instructor-skin');
    expect(css).toContain('#075f9e');
  });

  it('keeps the same physical frame in light and dark mode', () => {
    expect(css).toContain("html[data-theme='light'] body.pccc-welding-skin");
    expect(css).toContain("html[data-theme='dark'] body.pccc-welding-skin");
    expect(css).toContain('.app-container::before');
    expect(css).toContain('.app-container::after');
  });
});
