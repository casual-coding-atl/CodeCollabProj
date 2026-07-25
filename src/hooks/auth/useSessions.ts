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
  /**
   * False until we know which row is this browser. Until then no row can be
   * safely offered for revocation — see `useSessions`.
   */
  isCurrentSessionKnown: boolean;

  // Error states
  error: AuthError | null;
  isError: boolean;

  // Functions
  refetch: () => void;
  revokeSession: UseMutationResult<void, AuthError, string>;
  revokeOtherSessions: UseMutationResult<void, AuthError, void>;

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
 * session is fetched alongside and matched by id. The two queries settle
 * independently, which is why `isCurrentSessionKnown` exists: in the window
 * before the current-session answer lands, *every* row looks like someone
 * else's, and the UI would cheerfully offer a Revoke button for the session the
 * member is sitting in. Callers must not render revocation until it is true.
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

  const { data: currentSession, isSuccess: currentSessionKnown } = useQuery<
    AuthSession | null,
    AuthError
  >({
    queryKey: queryKeys.auth.currentSession(),
    queryFn: authService.getCurrentSession,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions() });
  };

  const revokeSession = useMutation<void, AuthError, string>({
    mutationFn: (token: string) => authService.revokeSession(token),
    retry: 0,
    onSuccess: invalidate,
    onError: (err) => logger.warn('Revoking a session failed:', err.message),
  });

  const revokeOtherSessions = useMutation<void, AuthError, void>({
    mutationFn: () => authService.revokeOtherSessions(),
    retry: 0,
    onSuccess: invalidate,
    onError: (err) => logger.warn('Revoking other sessions failed:', err.message),
  });

  const isCurrentSession = (session: AuthSession): boolean =>
    !!currentSession && session.id === currentSession.id;

  return {
    sessions: sessions || [],
    sessionCount: sessions?.length || 0,

    isLoading,
    isCurrentSessionKnown: currentSessionKnown,

    error: (error as AuthError | null) ?? null,
    isError,

    refetch,
    revokeSession,
    revokeOtherSessions,

    getCurrentSession: () => sessions?.find(isCurrentSession),
    getOtherSessions: () => (sessions || []).filter((s) => !isCurrentSession(s)),
    isCurrentSession,
  };
};

export default useSessions;
