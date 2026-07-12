import api from '../utils/api';
import type { Comment } from '../types';

/**
 * Comment creation data
 */
export interface CreateCommentData {
  projectId: string;
  content: string;
}

/**
 * Comment update data
 */
export interface UpdateCommentData {
  projectId: string;
  content: string;
}

/**
 * Comment delete response
 */
export interface DeleteCommentResponse {
  message: string;
}

/**
 * Comments service interface
 */
export interface CommentsServiceInterface {
  getByProjectId: (projectId: string) => Promise<Comment[]>;
  create: (commentData: CreateCommentData) => Promise<Comment>;
  update: (commentId: string, commentData: UpdateCommentData) => Promise<Comment>;
  delete: (commentId: string, projectId: string) => Promise<DeleteCommentResponse>;
}

/**
 * Comments service functions
 * These functions handle all comment-related API calls
 */
export const commentsService: CommentsServiceInterface = {
  // Get comments for a project
  getByProjectId: async (projectId: string): Promise<Comment[]> => {
    try {
      console.log('📝 CommentsService.getByProjectId called for project:', projectId);

      const response = await api.get<Comment[]>(`/projects/${projectId}/comments`);
      console.log('📝 CommentsService.getByProjectId response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ CommentsService.getByProjectId error:', error);
      throw error;
    }
  },

  // Note: Individual comment fetching not implemented in backend
  // Comments are fetched as part of project comments list

  // Create new comment
  create: async (commentData: CreateCommentData): Promise<Comment> => {
    try {
      console.log('📝 CommentsService.create called with data:', commentData);

      const { projectId, ...data } = commentData;
      const response = await api.post<Comment>(`/projects/${projectId}/comments`, data);
      console.log('📝 CommentsService.create response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ CommentsService.create error:', error);
      throw error;
    }
  },

  // Update comment
  update: async (commentId: string, commentData: UpdateCommentData): Promise<Comment> => {
    try {
      console.log('📝 CommentsService.update called:', { commentId, commentData });

      const { projectId, ...data } = commentData;
      const response = await api.put<Comment>(`/projects/${projectId}/comments/${commentId}`, data);
      console.log('📝 CommentsService.update response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ CommentsService.update error:', error);
      throw error;
    }
  },

  // Delete comment
  delete: async (commentId: string, projectId: string): Promise<DeleteCommentResponse> => {
    try {
      console.log(
        '📝 CommentsService.delete called for comment:',
        commentId,
        'project:',
        projectId
      );

      const response = await api.delete<DeleteCommentResponse>(
        `/projects/${projectId}/comments/${commentId}`
      );
      console.log('📝 CommentsService.delete response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ CommentsService.delete error:', error);
      throw error;
    }
  },

  // Note: Like/unlike and reply features would need to be implemented on the backend first
  // The backend currently only supports basic CRUD operations for comments
};

export default commentsService;
