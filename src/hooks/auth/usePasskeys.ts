import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError, type Passkey } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * The member's registered passkeys (`/api/auth/passkey/*`).
 *
 * Registering and using a passkey both raise a browser WebAuthn prompt from
 * inside the mutation, which is why none of these retry: a retry would put a
 * second system dialog in front of a member who just dismissed the first.
 */
export const usePasskeys = (): UseQueryResult<Passkey[], AuthError> =>
  useQuery<Passkey[], AuthError>({
    queryKey: queryKeys.auth.passkeys(),
    queryFn: authService.listPasskeys,
    staleTime: 60 * 1000,
    retry: (failureCount, err) => (err?.status === 401 ? false : failureCount < 2),
  });

/** Register a new passkey for this device/authenticator. */
export const useAddPasskey = (): UseMutationResult<void, AuthError, string | undefined> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name?: string) => authService.addPasskey(name),
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.passkeys() });
    },
    onError: (error) => logger.warn('Passkey registration failed:', error.message),
  });
};

/** Remove a passkey the member no longer uses. */
export const useDeletePasskey = (): UseMutationResult<void, AuthError, string> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => authService.deletePasskey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.passkeys() });
    },
    onError: (error) => logger.warn('Passkey removal failed:', error.message),
  });
};
