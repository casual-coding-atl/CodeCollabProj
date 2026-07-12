import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { commentsService } from '../../services/commentsService';
import { queryKeys } from '../../config/queryClient';
import type { Comment } from '../../types';

/**
 * Query options type for comments hooks
 */
type CommentsQueryOptions = Omit<
  UseQueryOptions<Comment[], Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

/**
 * Hook for fetching comments for a specific project
 * @param projectId - The project ID to fetch comments for
 * @param options - Additional query options
 */
export const useComments = (
  projectId: string | undefined,
  options: CommentsQueryOptions = {}
): UseQueryResult<Comment[], Error> => {
  return useQuery({
    queryKey: queryKeys.comments.list(projectId ?? ''),
    queryFn: () => commentsService.getByProjectId(projectId as string),
    enabled: !!projectId, // Only run if projectId exists
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    ...options,
  });
};

/**
 * Hook for fetching a single comment by ID
 * Note: Individual comment fetching is not implemented in the backend.
 * Comments are fetched as part of the project comments list.
 * This hook is kept for API consistency but will need backend support.
 * @param commentId - The comment ID to fetch
 * @param options - Additional query options
 */
export const useComment = (
  commentId: string | undefined,
  options: Omit<UseQueryOptions<Comment, Error>, 'queryKey' | 'queryFn' | 'enabled'> = {}
): UseQueryResult<Comment, Error> => {
  return useQuery({
    queryKey: queryKeys.comments.detail(commentId ?? ''),
    // Backend doesn't support individual comment fetching
    // This will need to be implemented when the backend supports it
    queryFn: () => Promise.reject(new Error('Individual comment fetching not implemented')),
    enabled: false, // Disabled until backend support is added
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Hook for fetching replies for a specific comment
 * Note: Reply fetching is not implemented in the backend.
 * This hook is kept for API consistency but will need backend support.
 * @param commentId - The comment ID to fetch replies for
 * @param options - Additional query options
 */
export const useCommentReplies = (
  commentId: string | undefined,
  options: CommentsQueryOptions = {}
): UseQueryResult<Comment[], Error> => {
  return useQuery({
    queryKey: queryKeys.comments.replies(commentId ?? ''),
    // Backend doesn't support comment replies yet
    // This will need to be implemented when the backend supports it
    queryFn: () => Promise.reject(new Error('Comment replies not implemented')),
    enabled: false, // Disabled until backend support is added
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    ...options,
  });
};
