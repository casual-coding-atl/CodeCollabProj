/**
 * Token encryption utility for localStorage
 *
 * ============================================================================
 * SECURITY LIMITATIONS - READ CAREFULLY
 * ============================================================================
 *
 * This utility provides OBFUSCATION, NOT TRUE SECURITY against XSS attacks.
 *
 * WHY THIS DOESN'T PROTECT AGAINST XSS:
 * 1. The encryption key is stored in sessionStorage - also accessible via XSS
 * 2. An attacker can simply import this module or copy the decrypt function
 * 3. XOR encryption is trivially reversible once the key is known
 * 4. Both localStorage and sessionStorage are accessible to any JavaScript
 *
 * WHAT THIS ACTUALLY PROVIDES:
 * - Prevents casual inspection of tokens in browser DevTools
 * - Stops basic automated token scrapers that look for raw JWT patterns
 * - Adds a small barrier that may slow down less sophisticated attackers
 *
 * FOR TRUE XSS PROTECTION:
 * Tokens must be stored in httpOnly cookies which are:
 * - Inaccessible to ALL JavaScript (including malicious scripts)
 * - Automatically sent by the browser without JS involvement
 *
 * See authService.js for the full httpOnly cookie migration plan.
 *
 * ============================================================================
 */

/**
 * Simple encryption using Web Crypto API (if available) or base64 encoding
 * In production, consider using a more robust encryption library
 */
class TokenEncryption {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Get or create encryption key from sessionStorage
   * Falls back to a simple key if Web Crypto API is not available
   */
  private getOrCreateEncryptionKey(): string {
    // SSR-safe: the SSR runtime (Nitro/unenv) provides THROWING stubs for
    // sessionStorage/window, so `import.meta.env.SSR` is the reliable signal.
    // The deprecated token layer is never exercised during server render.
    if (import.meta.env.SSR) {
      return 'ssr_noop_key';
    }
    try {
      // Use sessionStorage for encryption key (cleared on tab close)
      let key = sessionStorage.getItem('encryption_key');
      if (!key) {
        // Generate a random key
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        key = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem('encryption_key', key);
      }
      return key;
    } catch {
      // Fallback if sessionStorage is not available
      return 'fallback_key_' + window.location.hostname;
    }
  }

  /**
   * Simple XOR encryption (basic obfuscation)
   * Note: This is not cryptographically secure, but adds a layer of obfuscation
   * @param text - Text to encrypt
   * @returns Encrypted text or null if input is empty
   */
  encrypt(text: string | null | undefined): string | null {
    try {
      if (!text) return null;

      // Use simple base64 encoding with key mixing for basic obfuscation
      const key = this.encryptionKey;
      let result = '';

      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyChar);
      }

      // Base64 encode the result
      return btoa(result);
    } catch {
      // Fallback: return as-is if encryption fails
      return text ?? null;
    }
  }

  /**
   * Decrypt token
   * @param encryptedText - Encrypted text to decrypt
   * @returns Decrypted text or null if input is empty
   */
  decrypt(encryptedText: string | null | undefined): string | null {
    try {
      if (!encryptedText) return null;

      // Base64 decode first
      const decoded = atob(encryptedText);
      const key = this.encryptionKey;
      let result = '';

      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyChar);
      }

      return result;
    } catch {
      // If decryption fails, try returning as-is (for backward compatibility)
      return encryptedText ?? null;
    }
  }

  /**
   * Clear encryption key (on logout)
   */
  clearKey(): void {
    try {
      sessionStorage.removeItem('encryption_key');
    } catch {
      // Ignore errors
    }
  }
}

// Export singleton instance
export const tokenEncryption = new TokenEncryption();

export default tokenEncryption;
