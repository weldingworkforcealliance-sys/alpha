'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  DEFAULT_LTG_THEME,
  isLtgTheme,
  LTG_THEME_STORAGE_KEY,
  type LtgTheme,
} from '@/lib/theme-preference';

type ThemeContextValue = {
  theme: LtgTheme;
  setTheme: (theme: LtgTheme) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: LtgTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readLocalTheme(): LtgTheme {
  if (typeof window === 'undefined') return DEFAULT_LTG_THEME;
  const saved = window.localStorage.getItem(LTG_THEME_STORAGE_KEY);
  return isLtgTheme(saved) ? saved : DEFAULT_LTG_THEME;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(getSupabase);
  const [theme, setThemeState] = useState<LtgTheme>(DEFAULT_LTG_THEME);
  const [ready, setReady] = useState(false);

  const persistToProfile = useCallback(
    async (nextTheme: LtgTheme) => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) return;

      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: nextTheme })
        .eq('id', userId);

      if (error) {
        console.error('Unable to save LTG theme preference:', error);
      }
    },
    [supabase]
  );

  const setTheme = useCallback(
    (nextTheme: LtgTheme) => {
      setThemeState(nextTheme);
      applyTheme(nextTheme);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LTG_THEME_STORAGE_KEY, nextTheme);
      }
      void persistToProfile(nextTheme);
    },
    [persistToProfile]
  );

  useEffect(() => {
    let cancelled = false;
    const localTheme = readLocalTheme();
    setThemeState(localTheme);
    applyTheme(localTheme);

    const loadAccountPreference = async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        const userId = auth.session?.user.id;
        if (!userId || cancelled) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('id', userId)
          .maybeSingle();

        if (error || cancelled) return;
        const accountTheme = data?.theme_preference;
        if (isLtgTheme(accountTheme)) {
          setThemeState(accountTheme);
          applyTheme(accountTheme);
          window.localStorage.setItem(LTG_THEME_STORAGE_KEY, accountTheme);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void loadAccountPreference();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LTG_THEME_STORAGE_KEY || !isLtgTheme(event.newValue)) return;
      setThemeState(event.newValue);
      applyTheme(event.newValue);
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, [supabase]);

  const value = useMemo(
    () => ({ theme, setTheme, ready }),
    [theme, setTheme, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useLtgTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useLtgTheme must be used inside ThemeProvider');
  return context;
}
