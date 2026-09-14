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

  it('keeps the dormant compatibility provider in the repository only', () => {
    expect(provider).toContain('UNSKINNED_STATE');
    expect(provider).toContain("skinKey: DEFAULT_LTG_SKIN_KEY");
    expect(provider).toContain('branding: null');
    expect(provider).not.toContain('resolveSkin');
    expect(provider).not.toContain('subscribeSelectedSection');
  });

  it('does not mount tenant skin runtime or skin CSS in the application shell', () => {
    expect(layout).not.toContain('TenantSkinProvider');
    expect(layout).not.toContain('TenantBrandLockup');
    expect(layout).not.toContain("./pccc-welding-skin.css");
    expect(layout).not.toContain("./pccc-automotive-skin.css");
    expect(layout).not.toContain('PcccSkinController');
  });

  it('renders the stable default LTG brand directly in the shell', () => {
    expect(layout).toContain('<span className="ltg-brand-mark">LTG</span>');
    expect(layout).toContain('Education');
    expect(layout).toContain('Operating System');
  });
});
