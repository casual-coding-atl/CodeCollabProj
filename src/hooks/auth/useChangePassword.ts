import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService, type PasswordChangeData } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * Change the signed-in member's password (`POST /api/auth/change-password`).
 *
 * Better Auth revokes every *other* session as part of the change, so the
 * member stays signed in here and is signed out everywhere else — the sessions
 * list is refreshed to show that.
 */
export const useChangePassword = (): UseMutationResult<void, AuthError, PasswordChangeData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions() });
    },
    onError: (error) => {
      logger.warn('Password change failed:', error.message);
    },
  });
};

export default useChangePassword;
