import { QueryClient } from '@tanstack/react-query';
import { QUERY_CONFIG } from './constants';
import logger from '../utils/logger';

// Types for query error handling
interface QueryError {
  status?: number;
  message?: string;
}

// Types for query key factories
interface FiltersObject {
  [key: string]: unknown;
}

// Create a query client with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: QUERY_CONFIG.STALE_TIME,
      // Cache time - how long data stays in cache when not being used
      gcTime: QUERY_CONFIG.CACHE_TIME,
      // Retry failed requests
      retry: (failureCount: number, error: unknown): boolean => {
        const queryError = error as QueryError;
        // Don't retry on 4xx errors (client errors)
        if (queryError?.status && queryError.status >= 400 && queryError.status < 500) {
          return false;
        }
        // Retry up to MAX_RETRIES times for other errors
        return failureCount < QUERY_CONFIG.MAX_RETRIES;
      },
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex: number): number =>
        Math.min(QUERY_CONFIG.RETRY_DELAY_BASE * 2 ** attemptIndex, QUERY_CONFIG.RETRY_DELAY_MAX),
      // Don't refetch on window focus in development
      refetchOnWindowFocus: import.meta.env.PROD,
      // Don't refetch on reconnect unless data is stale
      refetchOnReconnect: 'always',
      // Enable background refetching
      refetchInterval: false, // Can be enabled per query if needed
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Retry delay for mutations
      retryDelay: QUERY_CONFIG.RETRY_DELAY_BASE,
      // Global mutation error handler
      onError: (error: unknown): void => {
        logger.error('Mutation error:', error);
        // You can add global error handling here (toast notifications, etc.)
      },
    },
  },
});

// Global error handler for queries
queryClient.setMutationDefaults(['auth'], {
  mutationFn: async (_variables: unknown): Promise<never> => {
    // Custom logic for auth mutations can go here
    throw new Error('Mutation function not implemented');
  },
});

// Query key factory for consistent cache keys
export const queryKeys = {
  // Auth keys
  auth: {
    all: ['auth'] as const,
    currentUser: (): readonly string[] => [...queryKeys.auth.all, 'currentUser'],
    passwordResetToken: (token: string): readonly string[] => [
      ...queryKeys.auth.all,
      'passwordResetToken',
      token,
    ],
    sessions: (): readonly string[] => [...queryKeys.auth.all, 'sessions'],
    tokenRefresh: (): readonly string[] => [...queryKeys.auth.all, 'tokenRefresh'],
  },
  // Projects keys
  projects: {
    all: ['projects'] as const,
    lists: (): readonly string[] => [...queryKeys.projects.all, 'list'],
    list: (filters: FiltersObject = {}): readonly (string | FiltersObject)[] => [
      ...queryKeys.projects.lists(),
      filters,
    ],
    details: (): readonly string[] => [...queryKeys.projects.all, 'detail'],
    detail: (id: string): readonly string[] => [...queryKeys.projects.details(), id],
    search: (query: string): readonly string[] => [...queryKeys.projects.all, 'search', query],
  },
  // Comments keys
  comments: {
    all: ['comments'] as const,
    lists: (): readonly string[] => [...queryKeys.comments.all, 'list'],
    list: (projectId: string): readonly string[] => [...queryKeys.comments.lists(), projectId],
    details: (): readonly string[] => [...queryKeys.comments.all, 'detail'],
    detail: (id: string): readonly string[] => [...queryKeys.comments.details(), id],
    replies: (commentId: string): readonly string[] => [
      ...queryKeys.comments.all,
      'replies',
      commentId,
    ],
  },
  // Users keys
  users: {
    all: ['users'] as const,
    lists: (): readonly string[] => [...queryKeys.users.all, 'list'],
    list: (filters: FiltersObject = {}): readonly (string | FiltersObject)[] => [
      ...queryKeys.users.lists(),
      filters,
    ],
    details: (): readonly string[] => [...queryKeys.users.all, 'detail'],
    detail: (id: string): readonly string[] => [...queryKeys.users.details(), id],
    profile: (): readonly string[] => [...queryKeys.users.all, 'profile'],
    search: (query: string): readonly string[] => [...queryKeys.users.all, 'search', query],
    projects: (userId: string): readonly string[] => [...queryKeys.users.all, 'projects', userId],
    stats: (userId: string): readonly string[] => [...queryKeys.users.all, 'stats', userId],
    followers: (userId: string): readonly string[] => [...queryKeys.users.all, 'followers', userId],
    following: (userId: string): readonly string[] => [...queryKeys.users.all, 'following', userId],
    messages: (type = 'inbox'): readonly string[] => [...queryKeys.users.all, 'messages', type],
    messageDetail: (messageId: string): readonly string[] => [
      ...queryKeys.users.all,
      'message',
      messageId,
    ],
  },
} as const;

// Cache invalidation helpers
export const invalidateQueries = {
  // Invalidate all auth-related queries
  auth: (): Promise<void> => queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),

  // Invalidate specific auth queries
  currentUser: (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser() }),

  // Invalidate all project-related queries
  projects: (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),

  // Invalidate project lists only
  projectLists: (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() }),

  // Invalidate specific project
  project: (id: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) }),

  // Invalidate comments for a project
  projectComments: (projectId: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.list(projectId) }),

  // Invalidate all comment-related queries
  comments: (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.all }),

  // Invalidate comments list for a project
  commentsList: (projectId: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.list(projectId) }),

  // Invalidate specific comment
  comment: (id: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.detail(id) }),

  // Invalidate comment replies
  commentReplies: (commentId: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.comments.replies(commentId) }),

  // Invalidate all user-related queries
  users: (): Promise<void> => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),

  // Invalidate user profile
  userProfile: (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.profile() }),

  // Invalidate all user messages
  userMessages: (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: [...queryKeys.users.all, 'messages'] }),

  // Invalidate specific message type (inbox/sent)
  userMessagesByType: (type: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.messages(type) }),

  // Invalidate specific message
  userMessage: (messageId: string): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.messageDetail(messageId) }),
};

// Prefetch helpers for better UX
export const prefetchQueries = {
  // Prefetch projects list
  projects: (): Promise<void> =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.projects.list(),
      // Will be implemented when we create the service
      queryFn: () => Promise.resolve([]),
    }),

  // Prefetch user profile
  userProfile: (): Promise<void> =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.profile(),
      // Will be implemented when we create the service
      queryFn: () => Promise.resolve(null),
    }),
};

export default queryClient;
