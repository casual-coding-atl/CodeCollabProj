export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ccp-theme';

/** Resolve the effective theme from a preference and the system's dark setting. Pure. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** Read the stored preference via an injected getter; default to 'system' when missing/invalid. Pure. */
export function readPreference(get: (key: string) => string | null): ThemePreference {
  const raw = get(THEME_STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

/** Persist the preference via an injected setter. */
export function writePreference(set: (key: string, value: string) => void, pref: ThemePreference): void {
  set(THEME_STORAGE_KEY, pref);
}

/** Apply the resolved theme to the document root by toggling the `.dark` class. */
export function applyTheme(root: { classList: { toggle: (c: string, on: boolean) => void } }, theme: ResolvedTheme): void {
  root.classList.toggle('dark', theme === 'dark');
}

/**
 * Inline, SSR-safe script (stringified) that sets the initial theme class before
 * first paint, preventing a flash of the wrong theme. Injected in the document head.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var s=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=p==='dark'||((p==='system'||!p)&&s);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
