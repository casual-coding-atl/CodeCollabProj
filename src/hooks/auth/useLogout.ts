import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * Sign out of this device (`POST /api/auth/sign-out`).
 *
 * Better Auth clears the session cookie; the whole query cache goes with it.
 * Not the auth keys, not "auth plus projects plus users" — everything. A cache
 * entry is only ever an answer the server gave *this member*, and the next
 * person to use this browser is entitled to none of them: notifications, unread
 * message counts and admin user lists all survived the previous, narrower
 * clearing and were served straight to whoever signed in next.
 */
export const useLogout = (): UseMutationResult<void, AuthError, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    retry: 0,
    onSuccess: () => queryClient.clear(),
    onError: (error) => {
      // The cookie may already be gone (expired or revoked elsewhere) — from the
      // member's point of view they are signed out either way, so the caches go
      // regardless.
      logger.warn('Logout failed:', error.message);
      queryClient.clear();
    },
  });
};

/**
 * Sign out of every device: revoke the other sessions first (that call needs
 * this session to authorize it), then end this one.
 */
export const useLogoutAll = (): UseMutationResult<void, AuthError, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logoutAll,
    retry: 0,
    onSuccess: () => queryClient.clear(),
    onError: (error) => {
      logger.warn('Logout from all devices failed:', error.message);
      queryClient.clear();
    },
  });
};

export default useLogout;
