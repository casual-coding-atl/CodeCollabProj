import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { usersService, UserSearchParams, UserStats } from '../../services/usersService';
import { queryKeys } from '../../config/queryClient';
import type { User, Project } from '../../types';

/**
 * Query options type for users list hook
 */
type UsersQueryOptions = Omit<UseQueryOptions<User[], Error>, 'queryKey' | 'queryFn'>;

/**
 * Query options type for single user hook
 */
type UserQueryOptions = Omit<UseQueryOptions<User, Error>, 'queryKey' | 'queryFn' | 'enabled'>;

/**
 * Query options type for user projects hook
 */
type UserProjectsQueryOptions = Omit<
  UseQueryOptions<Project[], Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

/**
 * Query options type for user stats hook
 */
type UserStatsQueryOptions = Omit<
  UseQueryOptions<UserStats, Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

/**
 * Hook for fetching all users
 * @param options - Additional query options
 */
export const useUsers = (options: UsersQueryOptions = {}): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: queryKeys.users.lists(),
    queryFn: usersService.getAll,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook for fetching a single user by ID
 * @param userId - The user ID to fetch
 * @param options - Additional query options
 */
export const useUser = (
  userId: string | undefined,
  options: UserQueryOptions = {}
): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: queryKeys.users.detail(userId ?? ''),
    queryFn: () => usersService.getById(userId as string),
    enabled: !!userId, // Only run if userId exists
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook for searching users
 * @param searchParams - Search parameters (query, skills, etc.)
 * @param options - Additional query options
 */
export const useUserSearch = (
  searchParams: UserSearchParams = {},
  options: Omit<UseQueryOptions<User[], Error>, 'queryKey' | 'queryFn' | 'enabled'> = {}
): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: queryKeys.users.search(searchParams.search ?? ''),
    queryFn: () => usersService.search(searchParams),
    enabled: !!searchParams.search, // Only run if there's a search query
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    ...options,
  });
};

/**
 * Hook for fetching user's projects
 * @param userId - The user ID to fetch projects for
 * @param options - Additional query options
 */
export const useUserProjects = (
  userId: string | undefined,
  options: UserProjectsQueryOptions = {}
): UseQueryResult<Project[], Error> => {
  return useQuery({
    queryKey: queryKeys.users.projects(userId ?? ''),
    queryFn: () => usersService.getUserProjects(userId as string),
    enabled: !!userId, // Only run if userId exists
    staleTime: 3 * 60 * 1000, // Consider fresh for 3 minutes
    gcTime: 7 * 60 * 1000, // Keep in cache for 7 minutes
    ...options,
  });
};

/**
 * Hook for fetching user statistics
 * @param userId - The user ID to fetch stats for
 * @param options - Additional query options
 */
export const useUserStats = (
  userId: string | undefined,
  options: UserStatsQueryOptions = {}
): UseQueryResult<UserStats, Error> => {
  return useQuery({
    queryKey: queryKeys.users.stats(userId ?? ''),
    queryFn: () => usersService.getUserStats(userId as string),
    enabled: !!userId, // Only run if userId exists
    staleTime: 10 * 60 * 1000, // Consider fresh for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    ...options,
  });
};

/**
 * Hook for fetching current user's profile
 * @param options - Additional query options
 */
export const useMyProfile = (
  options: Omit<UseQueryOptions<User, Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: queryKeys.users.profile(),
    queryFn: usersService.getMyProfile,
    staleTime: 3 * 60 * 1000, // Consider fresh for 3 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};
