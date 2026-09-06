import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LTG_THEME,
  isLtgTheme,
  LTG_THEME_STORAGE_KEY,
} from '../lib/theme-preference';

describe('LTG theme preference contract', () => {
  it('supports exactly light and dark themes', () => {
    expect(isLtgTheme('light')).toBe(true);
    expect(isLtgTheme('dark')).toBe(true);
    expect(isLtgTheme('system')).toBe(false);
    expect(isLtgTheme(null)).toBe(false);
  });

  it('defaults users without an explicit selection to dark', () => {
    expect(DEFAULT_LTG_THEME).toBe('dark');
  });

  it('uses one stable browser storage key', () => {
    expect(LTG_THEME_STORAGE_KEY).toBe('ltg_theme');
  });
});
