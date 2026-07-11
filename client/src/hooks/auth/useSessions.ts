import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import type { Session } from '../../types';

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
 * Return type for the useSessions hook
 */
export interface UseSessionsReturn {
  // Session data
  sessions: Session[];
  sessionCount: number;

  // Loading states
  isLoading: boolean;

  // Error states
  error: AxiosError | null;
  isError: boolean;

  // Functions
  refetch: () => void;
  logoutAll: () => void;
  isLoggingOutAll: boolean;

  // Helper functions
  getCurrentSession: () => Session | undefined;
  getOtherSessions: () => Session[];
}

/**
 * Hook for managing user sessions
 */
export const useSessions = (): UseSessionsReturn => {
  const queryClient = useQueryClient();

  // Fetch active sessions
  const {
    data: sessions,
    isLoading,
    error,
    isError,
    refetch,
  } = useQuery<Session[], AxiosError>({
    queryKey: queryKeys.auth.sessions(),
    queryFn: authService.getActiveSessions,
    staleTime: 30 * 1000, // Consider stale after 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: (failureCount, err) => {
      if (err?.response?.status === 401) return false;
      return failureCount < 2;
    },
  });

  // Logout from all devices mutation
  const logoutAllMutation = useMutation<void, AxiosError, void>({
    mutationFn: authService.logoutAll,
    onSuccess: () => {
      // Clear all cache and force user to login again
      queryClient.clear();
      console.log('✅ Logged out from all devices');
    },
    onError: (err) => {
      console.error('❌ Logout all failed:', err.message);
      // Even if server logout fails, clear local tokens
      authService.clearTokens();
      queryClient.clear();
    },
  });

  /**
   * Get the current session based on user agent
   */
  const getCurrentSession = (): Session | undefined => {
    // Find current session (this is a best guess based on browser info)
    return sessions?.find((session) =>
      session.deviceInfo?.userAgent?.includes(navigator.userAgent.split(' ')[0])
    );
  };

  /**
   * Get all sessions except the current one
   */
  const getOtherSessions = (): Session[] => {
    const currentSession = getCurrentSession();
    // The API serializes sessions with `_id` (no virtual `id`), so compare on
    // whichever identifier is present — otherwise every id is undefined and this
    // filters out every session, always returning [].
    const sid = (s?: Session | null): string | undefined =>
      s ? (s.id ?? (s as Session & { _id?: string })._id) : undefined;
    return sessions?.filter((session) => sid(session) !== sid(currentSession)) || [];
  };

  return {
    // Session data
    sessions: sessions || [],
    sessionCount: sessions?.length || 0,

    // Loading states
    isLoading,

    // Error states
    error,
    isError,

    // Functions
    refetch,
    logoutAll: logoutAllMutation.mutate,
    isLoggingOutAll: logoutAllMutation.isPending,

    // Helper functions
    getCurrentSession,
    getOtherSessions,
  };
};

export default useSessions;
