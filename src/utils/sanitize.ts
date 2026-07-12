/**
 * Client-side input sanitization utility
 * Provides XSS protection for user-generated content
 */

/**
 * HTML escape character map
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

/**
 * Dangerous URL protocols that should be blocked
 */
const DANGEROUS_PROTOCOLS: readonly string[] = ['javascript:', 'data:', 'vbscript:', 'file:'];

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes potentially dangerous HTML tags and attributes
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export const sanitizeHTML = (html: unknown): string => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Create a temporary div element
  const tempDiv = document.createElement('div');
  tempDiv.textContent = html;

  // Return the text content (strips all HTML)
  return tempDiv.innerHTML;
};

/**
 * Sanitize text input (removes HTML tags)
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export const sanitizeText = (text: unknown): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove HTML tags
  return text.replace(/<[^>]*>/g, '');
};

/**
 * Sanitize URL to prevent javascript: and data: protocols
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export const sanitizeURL = (url: unknown): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Remove whitespace
  const trimmed = url.trim();

  // Check for dangerous protocols
  const lowerUrl = trimmed.toLowerCase();

  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }

  // Only allow http, https, and relative URLs
  if (!trimmed.match(/^(https?:\/\/|\/)/i)) {
    return '';
  }

  return trimmed;
};

/**
 * Escape special characters for use in HTML
 * @param text - Text to escape
 * @returns Escaped text
 */
export const escapeHTML = (text: unknown): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text.replace(/[&<>"']/g, (char: string) => HTML_ESCAPE_MAP[char] || char);
};

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  escapeHTML,
};
