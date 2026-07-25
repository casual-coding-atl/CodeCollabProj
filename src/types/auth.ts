/**
 * Authentication-related TypeScript types.
 *
 * Since the move to Better Auth (ADR 0002) the wire shapes belong to the auth
 * client — `SessionUser`, `AuthSession` and `Passkey` are inferred from the
 * server config in `src/lib/auth-client.ts`. What remains here is what the app's
 * own forms and screens speak: credentials in, and the app's `User` out.
 */

import type { User } from './models';

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
 * Data required for user registration. Better Auth also wants a display `name`;
 * the service derives it from the username, which is the only name a member
 * picks here.
 */
export interface RegisterData {
  email: string;
  password: string;
  username: string;
}

// ============================================================================
// Password Reset / Email Verification
// ============================================================================

/**
 * Request to initiate password reset
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Data to confirm password reset with new password
 */
export interface PasswordResetConfirm {
  token: string;
  password: string;
}

/**
 * Request to resend verification email
 */
export interface ResendVerificationRequest {
  email: string;
}
