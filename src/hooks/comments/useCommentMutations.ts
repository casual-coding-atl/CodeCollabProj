import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
  commentsService,
  CreateCommentData,
  UpdateCommentData,
  DeleteCommentResponse,
} from '../../services/commentsService';
import { queryKeys, invalidateQueries } from '../../config/queryClient';
import type { Comment } from '../../types';

/**
 * Variables for updating a comment
 */
interface UpdateCommentVariables {
  commentId: string;
  commentData: UpdateCommentData;
}

/**
 * Variables for deleting a comment
 */
interface DeleteCommentVariables {
  commentId: string;
  projectId: string;
}

/**
 * Variables for replying to a comment
 * Note: Reply functionality is not yet implemented in the backend
 */
interface ReplyToCommentVariables {
  commentId: string;
  replyData: {
    content: string;
  };
}

/**
 * Create comment hook
 */
export const useCreateComment = (): UseMutationResult<
  Comment,
  Error,
  CreateCommentData,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commentsService.create,
    onSuccess: (data, variables) => {
      console.log('✅ Comment created successfully:', data);

      // Invalidate the comments list for the project
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.comments.list(variables.projectId),
        });
      }

      // Invalidate all comments to be safe
      invalidateQueries.comments();
    },
    onError: (error) => {
      console.error('❌ Failed to create comment:', error);
    },
  });
};

/**
 * Update comment hook
 */
export const useUpdateComment = (): UseMutationResult<
  Comment,
  Error,
  UpdateCommentVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, commentData }: UpdateCommentVariables) =>
      commentsService.update(commentId, commentData),
    onSuccess: (data, variables) => {
      console.log('✅ Comment updated successfully:', data);

      // Invalidate the specific comment
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.detail(variables.commentId),
      });

      // Invalidate comments list if we know the project ID
      if (data.projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.comments.list(data.projectId),
        });
      }
    },
    onError: (error) => {
      console.error('❌ Failed to update comment:', error);
    },
  });
};

/**
 * Delete comment hook
 */
export const useDeleteComment = (): UseMutationResult<
  DeleteCommentResponse,
  Error,
  DeleteCommentVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, projectId }: DeleteCommentVariables) =>
      commentsService.delete(commentId, projectId),
    onSuccess: (_data, variables) => {
      console.log('✅ Comment deleted successfully:', variables.commentId);

      // Remove the comment from the cache
      queryClient.removeQueries({
        queryKey: queryKeys.comments.detail(variables.commentId),
      });

      // Invalidate comments list for the project
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.comments.list(variables.projectId),
        });
      }

      // Invalidate all comments to be safe
      invalidateQueries.comments();
    },
    onError: (error) => {
      console.error('❌ Failed to delete comment:', error);
    },
  });
};

/**
 * Toggle comment like hook
 * Note: Like/unlike functionality is not yet implemented in the backend.
 * This hook is kept for API consistency but will need backend support.
 */
export const useToggleCommentLike = (): UseMutationResult<Comment, Error, string, unknown> => {
  const queryClient = useQueryClient();

  return useMutation({
    // Backend doesn't support likes yet - this is a placeholder
    mutationFn: (_commentId: string) =>
      Promise.reject(new Error('Comment likes not implemented in backend')),
    onSuccess: (data, commentId) => {
      console.log('✅ Comment like toggled successfully:', data);

      // Invalidate the specific comment to refresh like count
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.detail(commentId),
      });

      // If we know the project ID, invalidate the comments list
      if (data.projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.comments.list(data.projectId),
        });
      }
    },
    onError: (error) => {
      console.error('❌ Failed to toggle comment like:', error);
    },
  });
};

/**
 * Reply to comment hook
 * Note: Reply functionality is not yet implemented in the backend.
 * This hook is kept for API consistency but will need backend support.
 */
export const useReplyToComment = (): UseMutationResult<
  Comment,
  Error,
  ReplyToCommentVariables,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    // Backend doesn't support replies yet - this is a placeholder
    mutationFn: (_variables: ReplyToCommentVariables) =>
      Promise.reject(new Error('Comment replies not implemented in backend')),
    onSuccess: (data, variables) => {
      console.log('✅ Reply created successfully:', data);

      // Invalidate the parent comment's replies
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.replies(variables.commentId),
      });

      // Invalidate the parent comment to update reply count
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.detail(variables.commentId),
      });

      // If we know the project ID, invalidate the comments list
      if (data.projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.comments.list(data.projectId),
        });
      }
    },
    onError: (error) => {
      console.error('❌ Failed to create reply:', error);
    },
  });
};
