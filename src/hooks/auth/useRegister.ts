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
 * cache is emptied and re-seeded exactly as after a login — a browser that was
 * showing someone else's data a moment ago must not still be showing it.
 */
export const useRegister = (): UseMutationResult<AppUser, AuthError, RegisterData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.register,
    // Never retry: the second attempt hits "email already taken" and reports
    // that instead of whatever actually went wrong with the first.
    retry: 0,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.auth.currentUser(), user);
    },
    onError: (error) => {
      logger.warn('Registration failed:', error.message);
    },
  });
};

export default useRegister;
