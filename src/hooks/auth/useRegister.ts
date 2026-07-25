import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService, type AppUser } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';
import type { RegisterData } from '../../types';

/**
 * Register a new member (`POST /api/auth/sign-up/email`).
 *
 * Better Auth signs the new member in as part of sign-up (`autoSignIn`), so the
 * returned user is seeded into the current-user cache exactly as after a login.
 */
export const useRegister = (): UseMutationResult<AppUser, AuthError, RegisterData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.register,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.currentUser(), user);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
    onError: (error) => {
      logger.warn('Registration failed:', error.message);
    },
  });
};

export default useRegister;
