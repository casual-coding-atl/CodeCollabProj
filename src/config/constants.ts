/**
 * Application-wide constants
 * Centralized configuration for maintainability
 */

// Token expiration times (in milliseconds)
export const TOKEN_EXPIRATION = {
  ACCESS_TOKEN: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 days
  TOKEN_REFRESH_THRESHOLD: 2 * 60 * 1000, // Refresh if less than 2 minutes remaining
} as const;

// Query client configuration
export const QUERY_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  RETRY_DELAY_BASE: 1000, // Base delay for exponential backoff
  RETRY_DELAY_MAX: 30000, // Maximum retry delay
  MAX_RETRIES: 2,
} as const;

// API configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_DELAY: 1000,
} as const;

// Password requirements
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
} as const;

// Rate limiting
export const RATE_LIMITS = {
  GENERAL_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  GENERAL_MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  AUTH_MAX_ATTEMPTS: 50,
  ADMIN_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  ADMIN_MAX_REQUESTS: 200,
} as const;

// Session configuration
export const SESSION_CONFIG = {
  MAX_CONCURRENT_SESSIONS: 3,
  SESSION_TIMEOUT_MINUTES: 30,
  REFRESH_TOKEN_EXPIRE_DAYS: 7,
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  EMAIL_MAX_LENGTH: 255,
  BIO_MAX_LENGTH: 500,
  PROJECT_TITLE_MIN: 3,
  PROJECT_TITLE_MAX: 100,
  PROJECT_DESCRIPTION_MIN: 10,
  PROJECT_DESCRIPTION_MAX: 2000,
  COMMENT_MAX_LENGTH: 1000,
  MESSAGE_SUBJECT_MAX: 100,
  MESSAGE_CONTENT_MAX: 1000,
} as const;

// Security constants
export const SECURITY = {
  JWT_SECRET_MIN_LENGTH: 32,
  PASSWORD_RESET_TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour
  EMAIL_VERIFICATION_TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Type exports for use in other modules
export type TokenExpirationConfig = typeof TOKEN_EXPIRATION;
export type QueryConfig = typeof QUERY_CONFIG;
export type ApiConfig = typeof API_CONFIG;
export type PasswordRequirementsConfig = typeof PASSWORD_REQUIREMENTS;
export type RateLimitsConfig = typeof RATE_LIMITS;
export type SessionConfig = typeof SESSION_CONFIG;
export type ValidationLimitsConfig = typeof VALIDATION_LIMITS;
export type SecurityConfig = typeof SECURITY;
