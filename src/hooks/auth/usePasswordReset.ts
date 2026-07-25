import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { authService, type PasswordResetData } from '../../services/authService';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * Password reset and email verification, over Better Auth.
 *
 * None of these retry. Every one of them is single-use or rate-limited at the
 * far end: a reset token is consumed by the first attempt, so a silent retry
 * fails against a token the first try just spent and reports "invalid token" for
 * a reset that actually worked; a resend sends a second email.
 *
 * There is deliberately no "is this reset token valid?" hook: Better Auth has no
 * such endpoint and validates the token when the new password is submitted, so
 * the reset page no longer pre-flights it.
 */

interface MessageResponse {
  message: string;
}

/** `POST /api/auth/request-password-reset` — emails a reset link. */
export const useRequestPasswordReset = (): UseMutationResult<MessageResponse, AuthError, string> =>
  useMutation({
    mutationFn: authService.requestPasswordReset,
    retry: 0,
    onError: (error) => logger.warn('Password reset request failed:', error.message),
  });

/** `POST /api/auth/reset-password` — consumes the token from the emailed link. */
export const useResetPassword = (): UseMutationResult<
  MessageResponse,
  AuthError,
  PasswordResetData
> =>
  useMutation({
    mutationFn: authService.resetPassword,
    retry: 0,
    onError: (error) => logger.warn('Password reset failed:', error.message),
  });

/** `POST /api/auth/send-verification-email`. */
export const useResendVerificationEmail = (): UseMutationResult<
  MessageResponse,
  AuthError,
  string
> =>
  useMutation({
    mutationFn: authService.resendVerificationEmail,
    retry: 0,
    onError: (error) => logger.warn('Failed to send verification email:', error.message),
  });

/** `GET /api/auth/verify-email?token=…`. */
export const useVerifyEmail = (): UseMutationResult<MessageResponse, AuthError, string> =>
  useMutation({
    mutationFn: authService.verifyEmail,
    retry: 0,
    onError: (error) => logger.warn('Email verification failed:', error.message),
  });
