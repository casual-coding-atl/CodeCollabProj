import { useMutation, useQueryClient, UseMutationResult, QueryClient } from '@tanstack/react-query';
import { authService, type AppUser } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';
import type { LoginCredentials } from '../../types';

/**
 * Start a session in a cache that holds nobody else's data.
 *
 * The cache is emptied *before* the new member's identity is seeded into it.
 * Signing in is the moment a browser changes hands — the previous member's
 * projects, messages, notifications and admin lists must not survive it, and
 * clearing only the auth keys (as this used to) left all of those visible to
 * whoever signed in next.
 */
function startSession(queryClient: QueryClient, user: AppUser): void {
  queryClient.clear();
  queryClient.setQueryData(queryKeys.auth.currentUser(), user);
}

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
    // Never retry. A retried sign-in posts the same wrong password twice, which
    // counts twice against any rate limit or lockout the server applies.
    retry: 0,
    onSuccess: (user) => startSession(queryClient, user),
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
    onSuccess: (user) => startSession(queryClient, user),
    onError: (error) => {
      logger.warn('Passkey sign-in failed:', error.message);
    },
  });
};

export default useLogin;
