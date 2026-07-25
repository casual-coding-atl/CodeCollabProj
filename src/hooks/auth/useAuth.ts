import { useQuery } from '@tanstack/react-query';
import { authService, type AppUser } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import type { UserRole, Permission } from '../../types';

/**
 * Return type for the useAuth hook
 */
export interface UseAuthReturn {
  // User data
  user: AppUser | undefined;
  isAuthenticated: boolean;

  // Loading states
  isLoading: boolean;

  // Error states
  error: Error | null;
  isError: boolean;

  // Query state
  isFetched: boolean;

  // Functions
  refetch: () => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;

  // Helper functions
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
  isEmailVerified: boolean;
}

/**
 * Who is signed in, according to the server.
 *
 * The single source of truth is Better Auth's `GET /api/auth/get-session`,
 * reached with the httpOnly session cookie the browser sends on its own. There
 * is no token in JavaScript to inspect, refresh or clear — and an anonymous
 * visitor resolves to `null` rather than to a 401 the UI has to swallow.
 */
export const useAuth = (): UseAuthReturn => {
  const {
    data: user,
    isLoading,
    error,
    isError,
    refetch,
    isFetched,
  } = useQuery({
    queryKey: queryKeys.auth.currentUser(),
    queryFn: authService.getCurrentUser,
    // "No session" is a legitimate answer (`null`), so a rejection here means a
    // network or server fault — worth retrying a couple of times.
    retry: (failureCount) => failureCount < 2,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true, // Revalidate the session on reconnect
    refetchInterval: false,
  });

  return {
    // User data
    user: user ?? undefined,
    isAuthenticated: !!user,

    // Loading states
    isLoading,

    // Error states
    error: error as Error | null,
    isError,

    // Query state — useful for knowing the initial auth check is complete
    isFetched,

    // Functions
    refetch,
    logout: authService.logout,
    logoutAll: authService.logoutAll,

    // Helper functions
    hasRole: (role: UserRole): boolean => user?.role === role,
    hasPermission: (permission: Permission): boolean =>
      user?.permissions?.includes(permission) ?? false,
    isEmailVerified: user?.isEmailVerified ?? false,
  };
};

export default useAuth;
