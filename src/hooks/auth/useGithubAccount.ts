import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  githubAccountService,
  type LinkedGitHubAccount,
} from '../../services/githubAccountService';
import { queryKeys } from '../../config/queryClient';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * The member's Linked GitHub Account. Connecting leaves the app for GitHub and
 * comes back to /security, so there is nothing to invalidate on the way out —
 * the page is reloaded by the round trip. Disconnecting stays put, so it
 * refreshes the query.
 */
export const useLinkedGithubAccount = (): UseQueryResult<LinkedGitHubAccount | null, AuthError> =>
  useQuery<LinkedGitHubAccount | null, AuthError>({
    queryKey: queryKeys.auth.githubAccount(),
    queryFn: githubAccountService.get,
    staleTime: 60 * 1000,
    retry: (failureCount, err) => (err?.status === 401 ? false : failureCount < 2),
  });

/** Send the member to GitHub to authorize the connection. */
export const useConnectGithub = (): UseMutationResult<void, AuthError, void> =>
  useMutation<void, AuthError, void>({
    mutationFn: () => githubAccountService.connect(),
    retry: 0,
    onError: (error) => logger.warn('GitHub connect failed:', error.message),
  });

/** Remove the connection. Linked Repositories on projects are untouched. */
export const useDisconnectGithub = (): UseMutationResult<void, AuthError, string | undefined> => {
  const queryClient = useQueryClient();

  return useMutation<void, AuthError, string | undefined>({
    mutationFn: (accountId?: string) => githubAccountService.disconnect(accountId),
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.githubAccount() });
    },
    onError: (error) => logger.warn('GitHub disconnect failed:', error.message),
  });
};
