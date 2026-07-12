import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { projectsService } from '../../services/projectsService';
import { queryKeys } from '../../config/queryClient';
import type { Project } from '../../types';

/**
 * Custom error type with status for retry logic
 */
interface QueryErrorWithStatus extends Error {
  status?: number;
}

/**
 * Hook for fetching a single project by ID
 */
export const useProject = (
  projectId: string | undefined,
  options: Omit<
    UseQueryOptions<Project, QueryErrorWithStatus>,
    'queryKey' | 'queryFn' | 'enabled' | 'retry'
  > = {}
): UseQueryResult<Project, QueryErrorWithStatus> => {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: () => projectsService.getById(projectId as string),
    enabled: !!projectId, // Only fetch if projectId exists
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    retry: (failureCount: number, error: QueryErrorWithStatus): boolean => {
      // Don't retry on 404 errors (project not found)
      if (error?.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
    ...options,
  });
};

export default useProject;
