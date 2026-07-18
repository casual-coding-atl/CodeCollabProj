import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';

/**
 * Password change data for the API
 */
interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

/**
 * Response from password change endpoint
 */
interface PasswordChangeResponse {
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
      errors?: Array<{ field?: string; message: string }>;
    };
  };
  message?: string;
}

/**
 * Change password mutation hook
 * Handles password changes and session revocation
 */
export const useChangePassword = (): UseMutationResult<
  PasswordChangeResponse,
  AxiosError,
  PasswordChangeData
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.changePassword,
    onSuccess: (data) => {
      // Clear all auth data since sessions are revoked
      queryClient.removeQueries({ queryKey: queryKeys.auth.all });

      console.log('✅ Password changed successfully:', data.message);
    },
    onError: (error) => {
      console.error('❌ Password change failed:', {
        status: error?.response?.status,
        message: error?.response?.data?.message || error.message,
        errors: error?.response?.data?.errors,
      });
    },
  });
};

export default useChangePassword;
