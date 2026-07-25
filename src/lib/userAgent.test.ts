import { describe, it, expect } from 'vitest';
import { describeUserAgent } from './userAgent';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const FIREFOX_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';

describe('describeUserAgent', () => {
  it('names the browser and the platform', () => {
    expect(describeUserAgent(CHROME_MAC).label).toBe('Chrome on macOS');
    expect(describeUserAgent(SAFARI_IPHONE).label).toBe('Safari on iPhone');
    expect(describeUserAgent(FIREFOX_WINDOWS).label).toBe('Firefox on Windows');
  });

  it('prefers the specific browser over the one it impersonates', () => {
    // Edge and Chrome both advertise Safari; Edge also advertises Chrome.
    expect(describeUserAgent(EDGE_WINDOWS).browser).toBe('Edge');
    expect(describeUserAgent(CHROME_MAC).browser).toBe('Chrome');
  });

  it('falls back to whichever half it recognises', () => {
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0)').label).toBe('Windows');
    expect(describeUserAgent('Chrome/131.0.0.0').label).toBe('Chrome');
  });

  it('says "Unknown device" rather than guessing', () => {
    expect(describeUserAgent(undefined).label).toBe('Unknown device');
    expect(describeUserAgent(null).label).toBe('Unknown device');
    expect(describeUserAgent('  ').label).toBe('Unknown device');
    expect(describeUserAgent('curl/8.4.0').label).toBe('Unknown device');
  });
});
