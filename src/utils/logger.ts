/**
 * Client-side logging utility
 * Wraps console methods to prevent logging in production
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Sensitive fields that should be removed from logs in production
 */
const SENSITIVE_FIELDS: readonly string[] = [
  'token',
  'accessToken',
  'refreshToken',
  'password',
  'passwordHash',
];

/**
 * Sanitize an argument for production logging
 * Removes sensitive data from strings and objects
 */
const sanitizeArg = (arg: unknown): unknown => {
  if (typeof arg === 'string') {
    // Remove potential token patterns
    return arg.replace(/token['"]?\s*[:=]\s*['"]?[^'"]+/gi, 'token: [REDACTED]');
  }
  if (typeof arg === 'object' && arg !== null) {
    const sanitized = { ...arg } as Record<string, unknown>;
    // Remove sensitive fields
    for (const field of SENSITIVE_FIELDS) {
      delete sanitized[field];
    }
    return sanitized;
  }
  return arg;
};

/**
 * Logger interface for typed logging methods
 */
export interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export const logger: Logger = {
  log: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  error: (...args: unknown[]): void => {
    // Always log errors, but sanitize sensitive data in production
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, log errors but remove sensitive data
      const sanitized = args.map(sanitizeArg);
      console.error(...sanitized);
    }
  },

  warn: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  debug: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

export default logger;
