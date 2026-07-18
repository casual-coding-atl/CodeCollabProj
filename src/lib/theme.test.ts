import { describe, it, expect } from 'vitest';
import { resolveTheme, readPreference, THEME_STORAGE_KEY, type ThemePreference } from './theme';

describe('resolveTheme', () => {
  it('returns the explicit preference regardless of system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('follows the system preference when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('readPreference', () => {
  const get = (v: string | null) => (key: string) => (key === THEME_STORAGE_KEY ? v : null);

  it('reads a stored valid preference', () => {
    expect(readPreference(get('dark'))).toBe('dark');
    expect(readPreference(get('light'))).toBe('light');
    expect(readPreference(get('system'))).toBe('system');
  });

  it('defaults to system when missing or invalid', () => {
    expect(readPreference(get(null))).toBe('system');
    expect(readPreference(get('purple' as ThemePreference))).toBe('system');
  });
});
