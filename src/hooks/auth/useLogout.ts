import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * Sign out of this device (`POST /api/auth/sign-out`). Better Auth clears the
 * session cookie; we drop every cache that was scoped to the member so the next
 * render can't show their data.
 */
export const useLogout = (): UseMutationResult<void, AuthError, void> => {
  const queryClient = useQueryClient();

  const clearMemberCaches = (): void => {
    queryClient.removeQueries({ queryKey: queryKeys.auth.all });
    queryClient.removeQueries({ queryKey: queryKeys.projects.all });
    queryClient.removeQueries({ queryKey: queryKeys.users.all });
  };

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: clearMemberCaches,
    onError: (error) => {
      // The cookie may already be gone (expired or revoked elsewhere) — from the
      // member's point of view they are signed out either way.
      logger.warn('Logout failed:', error.message);
      clearMemberCaches();
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
    onSuccess: () => queryClient.clear(),
    onError: (error) => {
      logger.warn('Logout from all devices failed:', error.message);
      queryClient.clear();
    },
  });
};

export default useLogout;
