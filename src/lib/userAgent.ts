/**
 * Turn a raw User-Agent string into something a member can recognise in their
 * sessions list.
 *
 * Better Auth stores the User-Agent verbatim on each session row, and a raw UA
 * is unreadable ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) …"). This is a
 * deliberately small, best-effort parser: it names the common browsers and
 * platforms and says "Unknown device" rather than guessing when it can't tell.
 */

export interface DeviceLabel {
  browser: string;
  platform: string;
  /** e.g. "Chrome on macOS" — what the UI shows as the row's title. */
  label: string;
}

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  // Order matters: Edge/Opera/Brave all claim to be Chrome, and Chrome claims
  // to be Safari, so the more specific patterns have to be tried first.
  [/\bEdg(?:e|A|iOS)?\//i, 'Edge'],
  [/\bOPR\/|\bOpera\//i, 'Opera'],
  [/\bFirefox\/|\bFxiOS\//i, 'Firefox'],
  [/\bCriOS\//i, 'Chrome'],
  [/\bChrome\//i, 'Chrome'],
  [/\bSafari\//i, 'Safari'],
];

const PLATFORMS: ReadonlyArray<[RegExp, string]> = [
  [/\biPhone\b|\biPod\b/i, 'iPhone'],
  [/\biPad\b/i, 'iPad'],
  [/\bAndroid\b/i, 'Android'],
  [/\bWindows\b/i, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/i, 'macOS'],
  [/\bCrOS\b/i, 'ChromeOS'],
  [/\bLinux\b/i, 'Linux'],
];

function match(patterns: ReadonlyArray<[RegExp, string]>, ua: string): string | null {
  for (const [pattern, name] of patterns) {
    if (pattern.test(ua)) return name;
  }
  return null;
}

export function describeUserAgent(userAgent?: string | null): DeviceLabel {
  const ua = userAgent?.trim();
  if (!ua) return { browser: 'Unknown browser', platform: 'Unknown device', label: 'Unknown device' };

  const browser = match(BROWSERS, ua);
  const platform = match(PLATFORMS, ua);

  if (browser && platform) return { browser, platform, label: `${browser} on ${platform}` };
  if (browser) return { browser, platform: 'Unknown device', label: browser };
  if (platform) return { browser: 'Unknown browser', platform, label: platform };
  return { browser: 'Unknown browser', platform: 'Unknown device', label: 'Unknown device' };
}
