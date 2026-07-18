import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  readPreference,
  resolveTheme,
  writePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mq.matches);
    setPreferenceState(readPreference((k) => localStorage.getItem(k)));
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    applyTheme(document.documentElement, resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    writePreference((k, v) => localStorage.setItem(k, v), p);
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolveTheme(preference, systemPrefersDark) === 'dark' ? 'light' : 'dark');
  }, [preference, systemPrefersDark, setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
