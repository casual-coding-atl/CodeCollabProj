/**
 * Authentication-related TypeScript types
 */

import type { User, UserRole, Permission } from './models';

// ============================================================================
// Authentication State
// ============================================================================

/**
 * Authentication state for the application
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Extended auth state with additional flags
 */
export interface AuthStateExtended extends AuthState {
  isInitialized: boolean;
  error: string | null;
}

// ============================================================================
// Login / Registration
// ============================================================================

/**
 * Credentials for user login
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Data required for user registration
 */
export interface RegisterData {
  email: string;
  password: string;
  username: string;
}

/**
 * User data returned after login/registration
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role?: UserRole;
  permissions?: Permission[];
  isActive?: boolean;
  isSuspended?: boolean;
  isEmailVerified?: boolean;
}

/**
 * Response from login endpoint
 */
export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: AuthUser;
}

/**
 * Response from registration endpoint
 */
export interface RegisterResponse {
  message: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: AuthUser;
}

/**
 * Generic auth response with user and message
 */
export interface AuthResponse {
  user: AuthUser;
  message?: string;
}

// ============================================================================
// Password Reset
// ============================================================================

/**
 * Request to initiate password reset
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Response from password reset request (production)
 */
export interface PasswordResetRequestResponse {
  message: string;
}

/**
 * Response from password reset request (development mode)
 */
export interface PasswordResetRequestResponseDev extends PasswordResetRequestResponse {
  resetToken: string;
  resetUrl: string;
}

/**
 * Data to confirm password reset with new password
 */
export interface PasswordResetConfirm {
  token: string;
  password: string;
}

/**
 * Response from verify password reset token endpoint
 */
export interface VerifyPasswordResetTokenResponse {
  message: string;
  email: string;
}

// ============================================================================
// Email Verification
// ============================================================================

/**
 * Request to resend verification email
 */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * Response from email verification endpoint
 */
export interface EmailVerificationResponse {
  message: string;
}

// ============================================================================
// Token Refresh
// ============================================================================

/**
 * Request body for token refresh
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Response from token refresh endpoint
 */
export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

// ============================================================================
// Cookie Auth Check
// ============================================================================

/**
 * Result of checking authentication via httpOnly cookie
 */
export interface CookieAuthCheckResult {
  authenticated: boolean;
  user: User | null;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Response from logout endpoint
 */
export interface LogoutResponse {
  message: string;
}

/**
 * Response from logout all devices endpoint
 */
export interface LogoutAllResponse {
  message: string;
}

// ============================================================================
// Login Error States
// ============================================================================

/**
 * Error response when email verification is needed
 */
export interface NeedsVerificationError {
  message: string;
  needsVerification: true;
}

/**
 * Check if an error response requires email verification
 */
export function isNeedsVerificationError(
  error: unknown
): error is NeedsVerificationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'needsVerification' in error &&
    (error as NeedsVerificationError).needsVerification === true
  );
}
