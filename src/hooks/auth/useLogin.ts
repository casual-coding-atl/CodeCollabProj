import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService, type AppUser } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';
import type { LoginCredentials } from '../../types';

/**
 * Sign in with email and password (`POST /api/auth/sign-in/email`).
 *
 * On success Better Auth has already set the session cookie, so the only local
 * work is seeding the current-user cache with the member the server returned —
 * the guarded routes then render without a round-trip.
 */
export const useLogin = (): UseMutationResult<AppUser, AuthError, LoginCredentials> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.currentUser(), user);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (error) => {
      logger.warn('Login failed:', error.message);
      queryClient.removeQueries({ queryKey: queryKeys.auth.all });
    },
  });
};

/**
 * Sign in with a registered passkey (`POST /api/auth/passkey/authenticate`).
 * The WebAuthn prompt is raised by the browser inside the mutation.
 */
export const useLoginWithPasskey = (): UseMutationResult<AppUser, AuthError, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.loginWithPasskey(),
    // Never retry: a retry would raise a second WebAuthn prompt at the member,
    // including after they deliberately cancelled the first one.
    retry: 0,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.currentUser(), user);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (error) => {
      logger.warn('Passkey sign-in failed:', error.message);
    },
  });
};

export default useLogin;
