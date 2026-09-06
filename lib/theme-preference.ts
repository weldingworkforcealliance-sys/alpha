export type LtgTheme = 'light' | 'dark';

export const LTG_THEME_STORAGE_KEY = 'ltg_theme';
export const DEFAULT_LTG_THEME: LtgTheme = 'dark';

export function isLtgTheme(value: unknown): value is LtgTheme {
  return value === 'light' || value === 'dark';
}
