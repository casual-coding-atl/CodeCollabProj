import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';

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
 * Enhanced logout mutation hook
 * Handles logout from current device or all devices
 */
export const useLogout = (): UseMutationResult<void, AxiosError, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      // Clear all auth-related cache
      queryClient.removeQueries({ queryKey: queryKeys.auth.all });
      queryClient.removeQueries({ queryKey: queryKeys.projects.all });
      queryClient.removeQueries({ queryKey: queryKeys.users.all });

      console.log('✅ Logout successful');
    },
    onError: (error) => {
      console.error('❌ Logout failed:', error.message);

      // Even if server logout fails, clear local tokens
      authService.clearTokens();
      queryClient.removeQueries({ queryKey: queryKeys.auth.all });
    },
  });
};

/**
 * Logout from all devices mutation hook
 */
export const useLogoutAll = (): UseMutationResult<void, AxiosError, void> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logoutAll,
    onSuccess: () => {
      // Clear all cache
      queryClient.clear();

      console.log('✅ Logout from all devices successful');
    },
    onError: (error) => {
      console.error('❌ Logout from all devices failed:', error.message);

      // Even if server logout fails, clear local tokens
      authService.clearTokens();
      queryClient.clear();
    },
  });
};

export default useLogout;
