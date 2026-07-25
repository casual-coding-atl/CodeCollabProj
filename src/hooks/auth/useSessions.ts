import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import { AuthError, type AuthSession } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * Return type for the useSessions hook
 */
export interface UseSessionsReturn {
  // Session data
  sessions: AuthSession[];
  sessionCount: number;

  // Loading states
  isLoading: boolean;

  // Error states
  error: AuthError | null;
  isError: boolean;

  // Functions
  refetch: () => void;
  revokeSession: UseMutationResult<void, AuthError, string>;
  revokeOtherSessions: UseMutationResult<void, AuthError, void>;
  logoutAll: () => void;
  isLoggingOutAll: boolean;

  // Helper functions
  getCurrentSession: () => AuthSession | undefined;
  getOtherSessions: () => AuthSession[];
  isCurrentSession: (session: AuthSession) => boolean;
}

/**
 * The member's active sessions, from Better Auth's `list-sessions`, plus the
 * two things they can do about them: revoke one, or revoke all the others.
 *
 * `list-sessions` doesn't flag which row is this browser, so the current
 * session is fetched alongside and matched by id — that's what keeps the UI
 * from offering to revoke the session you're using.
 */
export const useSessions = (): UseSessionsReturn => {
  const queryClient = useQueryClient();

  const {
    data: sessions,
    isLoading,
    error,
    isError,
    refetch,
  } = useQuery<AuthSession[], AuthError>({
    queryKey: queryKeys.auth.sessions(),
    queryFn: authService.getActiveSessions,
    staleTime: 30 * 1000,
    retry: (failureCount, err) => (err?.status === 401 ? false : failureCount < 2),
  });

  const { data: currentSession } = useQuery<AuthSession | null, AuthError>({
    queryKey: queryKeys.auth.currentSession(),
    queryFn: authService.getCurrentSession,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions() });
  };

  const revokeSession = useMutation<void, AuthError, string>({
    mutationFn: (token: string) => authService.revokeSession(token),
    onSuccess: invalidate,
    onError: (err) => logger.warn('Revoking a session failed:', err.message),
  });

  const revokeOtherSessions = useMutation<void, AuthError, void>({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: invalidate,
    onError: (err) => logger.warn('Revoking other sessions failed:', err.message),
  });

  const logoutAllMutation = useMutation<void, AuthError, void>({
    mutationFn: authService.logoutAll,
    onSuccess: () => queryClient.clear(),
    onError: (err) => {
      logger.warn('Logout from all devices failed:', err.message);
      queryClient.clear();
    },
  });

  const isCurrentSession = (session: AuthSession): boolean =>
    !!currentSession && session.id === currentSession.id;

  return {
    sessions: sessions || [],
    sessionCount: sessions?.length || 0,

    isLoading,

    error: (error as AuthError | null) ?? null,
    isError,

    refetch,
    revokeSession,
    revokeOtherSessions,
    logoutAll: logoutAllMutation.mutate,
    isLoggingOutAll: logoutAllMutation.isPending,

    getCurrentSession: () => sessions?.find(isCurrentSession),
    getOtherSessions: () => (sessions || []).filter((s) => !isCurrentSession(s)),
    isCurrentSession,
  };
};

export default useSessions;
