import api from '../utils/api';
import type { User, Message, Project } from '../types';

/**
 * User search parameters
 */
export interface UserSearchParams {
  search?: string;
  skills?: string;
  experience?: string;
  availability?: string;
  [key: string]: string | undefined;
}

/**
 * Message data for sending a new message
 */
export interface SendMessageData {
  // Must match the server's message validator/controller, which read `recipientId`.
  recipientId: string;
  subject: string;
  content: string;
}

/**
 * User statistics
 */
export interface UserStats {
  projectCount: number;
  collaborationCount: number;
  followerCount: number;
  followingCount: number;
}

/**
 * Profile update response
 */
export interface ProfileUpdateResponse {
  message: string;
  user: User;
}

/**
 * Message response
 */
export interface MessageResponse {
  message: string;
}

/**
 * Avatar upload response
 */
export interface AvatarUploadResponse {
  message: string;
  profileImage?: string;
  avatarUrl?: string;
}

/**
 * Follow toggle response
 */
export interface FollowResponse {
  message: string;
  isFollowing: boolean;
}

/**
 * Users service interface
 */
export interface UsersServiceInterface {
  getAll: () => Promise<User[]>;
  getById: (userId: string) => Promise<User>;
  getMyProfile: () => Promise<User>;
  updateProfile: (profileData: Partial<User>) => Promise<ProfileUpdateResponse>;
  search: (searchParams: UserSearchParams) => Promise<User[]>;
  getUserProjects: (userId: string) => Promise<Project[]>;
  sendMessage: (messageData: SendMessageData) => Promise<MessageResponse>;
  getMessages: (type?: string) => Promise<Message[]>;
  markMessageAsRead: (messageId: string) => Promise<MessageResponse>;
  getMessageById: (messageId: string) => Promise<Message>;
  deleteMessage: (messageId: string) => Promise<MessageResponse>;
  uploadProfileImage: (imageFile: File) => Promise<AvatarUploadResponse>;
  uploadAvatar: (formData: FormData) => Promise<AvatarUploadResponse>;
  deleteAvatar: () => Promise<MessageResponse>;
  getUserStats: (userId: string) => Promise<UserStats>;
  toggleFollow: (userId: string) => Promise<FollowResponse>;
  getFollowers: (userId: string) => Promise<User[]>;
  getFollowing: (userId: string) => Promise<User[]>;
}

/**
 * Users service functions
 * These functions handle all user-related API calls
 */
export const usersService: UsersServiceInterface = {
  // Get all users
  getAll: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  // Get user by ID
  getById: async (userId: string): Promise<User> => {
    const response = await api.get<User>(`/users/${userId}`);
    return response.data;
  },

  // Get current user's profile
  getMyProfile: async (): Promise<User> => {
    const response = await api.get<User>('/users/profile/me');
    return response.data;
  },

  // Update user profile
  updateProfile: async (profileData: Partial<User>): Promise<ProfileUpdateResponse> => {
    const response = await api.put<ProfileUpdateResponse>('/users/profile', profileData);
    return response.data;
  },

  // Search users
  search: async (searchParams: UserSearchParams): Promise<User[]> => {
    const params = new URLSearchParams();
    Object.keys(searchParams).forEach((key) => {
      const value = searchParams[key];
      if (value) {
        // The server reads the free-text term as `query`, not `search`.
        params.append(key === 'search' ? 'query' : key, value);
      }
    });

    const response = await api.get<User[]>(`/users/search?${params}`);
    return response.data;
  },

  // Get user's projects
  getUserProjects: async (userId: string): Promise<Project[]> => {
    const response = await api.get<Project[]>(`/users/${userId}/projects`);
    return response.data;
  },

  // Send message to user
  sendMessage: async (messageData: SendMessageData): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>('/users/messages', messageData);
    return response.data;
  },

  // Get messages
  getMessages: async (type = 'inbox'): Promise<Message[]> => {
    const response = await api.get<Message[]>(`/users/messages?type=${type}`);
    return response.data;
  },

  // Mark message as read
  markMessageAsRead: async (messageId: string): Promise<MessageResponse> => {
    const response = await api.put<MessageResponse>(`/users/messages/${messageId}/read`);
    return response.data;
  },

  // Get message by ID
  getMessageById: async (messageId: string): Promise<Message> => {
    const response = await api.get<Message>(`/users/messages/${messageId}`);
    return response.data;
  },

  // Delete message
  deleteMessage: async (messageId: string): Promise<MessageResponse> => {
    const response = await api.delete<MessageResponse>(`/users/messages/${messageId}`);
    return response.data;
  },

  // Upload profile image
  uploadProfileImage: async (imageFile: File): Promise<AvatarUploadResponse> => {
    const formData = new FormData();
    formData.append('profileImage', imageFile);

    const response = await api.post<AvatarUploadResponse>('/users/profile/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload avatar
  uploadAvatar: async (formData: FormData): Promise<AvatarUploadResponse> => {
    const response = await api.post<AvatarUploadResponse>('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete avatar
  deleteAvatar: async (): Promise<MessageResponse> => {
    const response = await api.delete<MessageResponse>('/users/avatar');
    return response.data;
  },

  // Get user statistics
  getUserStats: async (userId: string): Promise<UserStats> => {
    const response = await api.get<UserStats>(`/users/${userId}/stats`);
    return response.data;
  },

  // Follow/unfollow user (if implemented)
  toggleFollow: async (userId: string): Promise<FollowResponse> => {
    const response = await api.post<FollowResponse>(`/users/${userId}/follow`);
    return response.data;
  },

  // Get user's followers
  getFollowers: async (userId: string): Promise<User[]> => {
    const response = await api.get<User[]>(`/users/${userId}/followers`);
    return response.data;
  },

  // Get users that user is following
  getFollowing: async (userId: string): Promise<User[]> => {
    const response = await api.get<User[]>(`/users/${userId}/following`);
    return response.data;
  },
};

export default usersService;
