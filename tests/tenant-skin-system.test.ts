import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LTG_SKIN_KEY,
  allSkinDomClasses,
  getDemoSkinKey,
  getLtgSkinDefinition,
  registeredSkinKeys,
} from '../lib/skin-registry';

const provider = readFileSync(
  join(process.cwd(), 'app/tenant-skin-provider.tsx'),
  'utf8'
);

describe('LTG tenant skin registry', () => {
  it('registers default, welding, and non-welding skin packages', () => {
    expect(registeredSkinKeys()).toEqual(
      expect.arrayContaining(['ltg-default', 'pccc-welding', 'clinical-learning'])
    );
  });

  it('falls back safely to the LTG default skin for an unknown key', () => {
    expect(getLtgSkinDefinition('not-a-real-skin').key).toBe(DEFAULT_LTG_SKIN_KEY);
  });

  it('maps demo programs to independent skins', () => {
    expect(getDemoSkinKey('/demo/welding')).toBe('pccc-welding');
    expect(getDemoSkinKey('/demo/time-clock')).toBe('pccc-welding');
    expect(getDemoSkinKey('/demo/nursing')).toBe('clinical-learning');
    expect(getDemoSkinKey('/demo/programs')).toBe(DEFAULT_LTG_SKIN_KEY);
  });

  it('loads the clinical skin as a standalone package', () => {
    const clinical = getLtgSkinDefinition('clinical-learning');
    expect(clinical.className).toBe('ltg-skin-clinical-learning');
    expect(clinical.stylesheetHrefs).toContain(
      '/skins/clinical-learning.css?v=20260914-1'
    );
  });

  it('keeps PCCC legacy classes isolated inside the PCCC skin adapter', () => {
    const pccc = getLtgSkinDefinition('pccc-welding');
    expect(pccc.legacyBaseClasses).toContain('pccc-welding-skin');
    expect(pccc.legacyAccessClasses?.school).toContain('pccc-school-skin');
    expect(pccc.legacyAccessClasses?.instructor).toContain('pccc-instructor-skin');
    expect(allSkinDomClasses()).toContain('pccc-demo-skin');
  });
});

describe('LTG tenant skin resolution contract', () => {
  it('resolves program branding before the school default', () => {
    const programLookup = 'profiles.find((row) => row.program_id === programId)';
    const schoolLookup = 'profiles.find((row) => row.program_id === null)';
    expect(provider.indexOf(programLookup)).toBeGreaterThan(-1);
    expect(provider.indexOf(schoolLookup)).toBeGreaterThan(-1);
    expect(provider.indexOf(programLookup)).toBeLessThan(provider.indexOf(schoolLookup));
  });

  it('changes skins when the selected teaching section changes', () => {
    expect(provider).toContain('subscribeSelectedSection');
    expect(provider).toContain('void resolveSkin(sectionId)');
  });

  it('keeps access mode independent from skin identity', () => {
    expect(provider).toContain('target.dataset.ltgSkin = skin.key');
    expect(provider).toContain('target.dataset.ltgAccess = state.accessMode');
  });

  it('does not hard-code a PCCC school id or PCCC name in the generic provider', () => {
    expect(provider).not.toContain('08ccb452-83ab-482f-bb28-5576e02741b2');
    expect(provider).not.toMatch(/Passaic County Community College/i);
  });
});
