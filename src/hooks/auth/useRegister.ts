import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import type { RegisterData, RegisterResponse } from '../../types';

/**
 * Extended register response that might include token (dev mode)
 */
interface RegisterResponseWithToken extends RegisterResponse {
  token?: string;
}

/**
 * Axios error type for error handling
 */
interface AxiosError {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Array<{ field?: string; message: string }>;
    };
  };
  message?: string;
}

/**
 * Register mutation hook
 * Handles user registration
 */
export const useRegister = (): UseMutationResult<RegisterResponse, AxiosError, RegisterData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      console.log('✅ Registration successful:', data);

      // If registration auto-logs in (development mode), update auth state
      const dataWithToken = data as RegisterResponseWithToken;
      if (dataWithToken.token && data.user) {
        queryClient.setQueryData(queryKeys.auth.currentUser(), data.user);
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      }
    },
    onError: (error) => {
      console.error('❌ Registration failed:', error);
    },
  });
};

export default useRegister;
