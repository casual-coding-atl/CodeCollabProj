import { useQuery } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { queryKeys } from '../../config/queryClient';
import type { User, UserRole, Permission } from '../../types';

/**
 * Return type for the useAuth hook
 */
export interface UseAuthReturn {
  // User data
  user: User | undefined;
  isAuthenticated: boolean;

  // DEPRECATED: Token information (returns null with httpOnly cookie auth)
  accessToken: string | null;
  refreshToken: string | null;
  hasValidTokens: boolean;
  isTokenExpired: boolean;

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
  clearTokens: () => void;

  // Helper functions
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
  isEmailVerified: boolean;

  // DEPRECATED: Legacy support
  token: string | null;
}

/**
 * Enhanced authentication hook with httpOnly cookie support
 * This replaces the Redux auth state management
 *
 * MIGRATION NOTE (httpOnly Cookie Auth):
 * This hook now supports both httpOnly cookie-based authentication and
 * legacy localStorage tokens for backward compatibility.
 *
 * - Primary auth check: Server validation via /auth/me endpoint
 * - The query runs on mount to check cookie-based auth state
 * - Token properties are deprecated but kept for backward compatibility
 * - isAuthenticated is now based on successful user data fetch
 */
export const useAuth = (): UseAuthReturn => {
  // DEPRECATED: Check localStorage tokens for backward compatibility
  // During migration, we check localStorage tokens as a hint, but the
  // real auth state comes from the server response
  const hasLocalStorageTokens = authService.isAuthenticated();

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
    // Always attempt to fetch - httpOnly cookies are sent automatically
    // This enables cookie-based auth even without localStorage tokens
    enabled: true,
    retry: (failureCount, err) => {
      // Don't retry on 401 errors (not authenticated)
      const axiosError = err as { response?: { status?: number } };
      if (axiosError?.response?.status === 401) return false;
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Do refetch on reconnect for session validation
    refetchInterval: false, // Disable automatic refetching
  });

  // Primary auth check: user data exists from server response
  // This works with both httpOnly cookies and legacy localStorage tokens
  const isAuthenticated = !!user;

  // DEPRECATED: Token accessors kept for backward compatibility
  // These will return null when using httpOnly cookie auth
  const accessToken = authService.getAccessToken();
  const refreshToken = authService.getRefreshToken();
  const hasValidTokens = hasLocalStorageTokens;
  const isTokenExpired = authService.isTokenExpired();

  return {
    // User data
    user,
    isAuthenticated,

    // DEPRECATED: Token information (returns null with httpOnly cookie auth)
    // These are kept for backward compatibility during migration
    accessToken,
    refreshToken,
    hasValidTokens,
    isTokenExpired,

    // Loading states
    isLoading,

    // Error states
    error: error as Error | null,
    isError,

    // Query state - useful for determining if initial auth check is complete
    isFetched,

    // Functions
    refetch,
    logout: authService.logout,
    logoutAll: authService.logoutAll,
    clearTokens: authService.clearTokens,

    // Helper functions
    hasRole: (role: UserRole): boolean => user?.role === role,
    hasPermission: (permission: Permission): boolean =>
      user?.permissions?.includes(permission) ?? false,
    isEmailVerified: user?.isEmailVerified ?? false,

    // DEPRECATED: Legacy support - token will be null with httpOnly cookie auth
    token: accessToken,
  };
};

export default useAuth;
