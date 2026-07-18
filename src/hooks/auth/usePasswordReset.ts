import { useMutation, useQuery, UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import type {
  PasswordResetRequestResponse,
  VerifyPasswordResetTokenResponse,
  EmailVerificationResponse,
} from '../../types';

/**
 * Password reset data for the API
 */
interface PasswordResetData {
  token: string;
  password: string;
}

/**
 * Response from password reset endpoint
 */
interface PasswordResetResponse {
  message: string;
}

/**
 * Axios error type for error handling
 */
interface AxiosError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

/**
 * Options for usePasswordResetTokenQuery
 */
interface PasswordResetTokenQueryOptions {
  enabled?: boolean;
  retry?: boolean | number;
  staleTime?: number;
  gcTime?: number;
}

/**
 * Request password reset hook
 */
export const useRequestPasswordReset = (): UseMutationResult<
  PasswordResetRequestResponse,
  AxiosError,
  string
> => {
  return useMutation({
    mutationFn: authService.requestPasswordReset,
    onSuccess: (data) => {
      console.log('✅ Password reset request successful:', data);
    },
    onError: (error) => {
      console.error('❌ Password reset request failed:', error);
    },
  });
};

/**
 * Verify password reset token hook (mutation for manual verification)
 */
export const useVerifyPasswordResetToken = (): UseMutationResult<
  VerifyPasswordResetTokenResponse,
  AxiosError,
  string
> => {
  return useMutation({
    mutationFn: authService.verifyPasswordResetToken,
    onSuccess: (data) => {
      console.log('✅ Password reset token verified:', data);
    },
    onError: (error) => {
      console.error('❌ Password reset token verification failed:', error);
    },
  });
};

/**
 * Query hook for automatic token verification on component mount
 */
export const usePasswordResetTokenQuery = (
  token: string | undefined | null,
  options: PasswordResetTokenQueryOptions = {}
): UseQueryResult<VerifyPasswordResetTokenResponse, AxiosError> => {
  return useQuery({
    queryKey: queryKeys.auth.passwordResetToken(token || ''),
    queryFn: () => authService.verifyPasswordResetToken(token as string),
    enabled: !!token, // Only run if token exists
    retry: false, // Don't retry on failure
    staleTime: 0, // Always fresh
    gcTime: 0, // Don't cache
    ...options,
  });
};

/**
 * Reset password hook
 */
export const useResetPassword = (): UseMutationResult<
  PasswordResetResponse,
  AxiosError,
  PasswordResetData
> => {
  return useMutation({
    mutationFn: authService.resetPassword,
    onSuccess: (data) => {
      console.log('✅ Password reset successful:', data);
    },
    onError: (error) => {
      console.error('❌ Password reset failed:', error);
    },
  });
};

/**
 * Resend verification email hook
 */
export const useResendVerificationEmail = (): UseMutationResult<
  EmailVerificationResponse,
  AxiosError,
  string
> => {
  return useMutation({
    mutationFn: authService.resendVerificationEmail,
    onSuccess: (data) => {
      console.log('✅ Verification email sent:', data);
    },
    onError: (error) => {
      console.error('❌ Failed to send verification email:', error);
    },
  });
};

/**
 * Verify email hook
 */
export const useVerifyEmail = (): UseMutationResult<
  EmailVerificationResponse,
  AxiosError,
  string
> => {
  return useMutation({
    mutationFn: authService.verifyEmail,
    onSuccess: (data) => {
      console.log('✅ Email verified successfully:', data);
    },
    onError: (error) => {
      console.error('❌ Email verification failed:', error);
    },
  });
};
