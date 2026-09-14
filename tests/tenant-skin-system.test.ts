import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LTG_SKIN_KEY,
  getLtgSkinDefinition,
  registeredSkinKeys,
} from '../lib/skin-registry';

const provider = readFileSync(
  join(process.cwd(), 'app/tenant-skin-provider.tsx'),
  'utf8'
);
const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');

describe('LTG tenant skin rollback', () => {
  it('keeps historical skin definitions available without applying them', () => {
    expect(registeredSkinKeys()).toEqual(
      expect.arrayContaining(['ltg-default', 'pccc-welding', 'clinical-learning'])
    );
    expect(getLtgSkinDefinition('not-a-real-skin').key).toBe(DEFAULT_LTG_SKIN_KEY);
  });

  it('runs the application in the unskinned LTG default state', () => {
    expect(provider).toContain('UNSKINNED_STATE');
    expect(provider).toContain("skinKey: DEFAULT_LTG_SKIN_KEY");
    expect(provider).toContain('branding: null');
    expect(provider).not.toContain('resolveSkin');
    expect(provider).not.toContain('subscribeSelectedSection');
  });

  it('actively removes stale tenant and PCCC skin state from the DOM', () => {
    expect(provider).toContain('clearSkinFromDom');
    expect(provider).toContain("link[data-ltg-skin-stylesheet='true']");
    expect(provider).toContain("target.classList.remove('ltg-tenant-skin')");
    expect(provider).toContain("delete target.dataset.ltgSkin");
    expect(provider).toContain("delete target.dataset.pcccAccess");
  });

  it('keeps the provider mounted only as a compatibility boundary', () => {
    expect(layout).toContain("import TenantSkinProvider from './tenant-skin-provider'");
    expect(layout).toContain('<TenantSkinProvider pathname={pathname}>');
    expect(layout).toContain('</TenantSkinProvider>');
    expect(layout).not.toContain('PcccSkinController');
  });
});
