'use client';

import { useLtgTheme } from './theme-provider';

export default function ThemeToggle() {
  const { theme, setTheme, ready } = useLtgTheme();

  return (
    <div className={`ltg-theme-toggle ${ready ? 'ready' : ''}`} aria-label="Appearance">
      <span className="ltg-theme-toggle-label">Appearance</span>
      <div className="ltg-theme-toggle-buttons" role="group" aria-label="Choose LTG theme">
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          <span aria-hidden="true">☀</span>
          Light
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          <span aria-hidden="true">◐</span>
          Dark
        </button>
      </div>
    </div>
  );
}
