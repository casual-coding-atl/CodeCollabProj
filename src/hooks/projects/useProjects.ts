import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { projectsService, ProjectFilters } from '../../services/projectsService';
import { queryKeys } from '../../config/queryClient';
import type { Project, ProjectStatus } from '../../types';

/**
 * Hook for fetching all projects with optional filters
 */
export const useProjects = (
  filters: ProjectFilters = {},
  options: Omit<UseQueryOptions<Project[], Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryResult<Project[], Error> => {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: () => projectsService.getAll(filters),
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook for searching projects
 */
export const useProjectSearch = (
  searchQuery: string,
  options: Omit<UseQueryOptions<Project[], Error>, 'queryKey' | 'queryFn' | 'enabled'> = {}
): UseQueryResult<Project[], Error> => {
  return useQuery({
    queryKey: queryKeys.projects.search(searchQuery),
    queryFn: () => projectsService.search(searchQuery),
    enabled: !!searchQuery && searchQuery.length > 2, // Only search if query is 3+ chars
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes (search results change faster)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    ...options,
  });
};

/**
 * Hook for fetching user's projects
 */
export const useUserProjects = (
  userId: string | undefined,
  options: Omit<UseQueryOptions<Project[], Error>, 'queryKey' | 'queryFn' | 'enabled'> = {}
): UseQueryResult<Project[], Error> => {
  return useQuery({
    queryKey: [...queryKeys.projects.all, 'user', userId ?? ''],
    queryFn: () => projectsService.getUserProjects(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook for fetching projects by status
 */
export const useProjectsByStatus = (
  status: ProjectStatus | string | undefined,
  options: Omit<UseQueryOptions<Project[], Error>, 'queryKey' | 'queryFn' | 'enabled'> = {}
): UseQueryResult<Project[], Error> => {
  return useQuery({
    queryKey: [...queryKeys.projects.all, 'status', status ?? ''],
    queryFn: () => projectsService.getByStatus(status as string),
    enabled: !!status,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook for fetching featured projects
 */
export const useFeaturedProjects = (
  options: Omit<UseQueryOptions<Project[], Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryResult<Project[], Error> => {
  return useQuery({
    queryKey: [...queryKeys.projects.all, 'featured'],
    queryFn: projectsService.getFeatured,
    staleTime: 10 * 60 * 1000, // Featured projects change less frequently
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    ...options,
  });
};

export default useProjects;
