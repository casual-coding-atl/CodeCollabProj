import api from '../utils/api';
import type { Project, CollaboratorStatus } from '../types';

/**
 * Project filter parameters
 */
export interface ProjectFilters {
  status?: string;
  technologies?: string;
  tags?: string;
  search?: string;
  featured?: string;
  [key: string]: string | undefined;
}

/**
 * Project update payload
 */
export interface ProjectUpdatePayload {
  projectId: string;
  projectData: Partial<Project>;
}

/**
 * Collaboration request response payload
 */
export interface CollaborationRequestPayload {
  projectId: string;
  userId: string;
  status: CollaboratorStatus;
}

/**
 * Delete project response
 */
export interface DeleteProjectResponse {
  message: string;
}

/**
 * Join/Leave project response
 */
export interface JoinLeaveResponse {
  message: string;
  project?: Project;
}

/**
 * Collaboration response
 */
export interface CollaborationResponse {
  message: string;
  project?: Project;
}

/**
 * Projects service interface
 */
export interface ProjectsServiceInterface {
  getAll: (filters?: ProjectFilters) => Promise<Project[]>;
  getById: (projectId: string) => Promise<Project>;
  create: (projectData: Partial<Project>) => Promise<Project>;
  update: (payload: ProjectUpdatePayload) => Promise<Project>;
  delete: (projectId: string) => Promise<DeleteProjectResponse>;
  search: (query: string) => Promise<Project[]>;
  join: (projectId: string) => Promise<JoinLeaveResponse>;
  leave: (projectId: string) => Promise<JoinLeaveResponse>;
  requestCollaboration: (projectId: string) => Promise<CollaborationResponse>;
  handleCollaborationRequest: (
    payload: CollaborationRequestPayload
  ) => Promise<CollaborationResponse>;
  getUserProjects: (userId: string) => Promise<Project[]>;
  getByStatus: (status: string) => Promise<Project[]>;
  getFeatured: () => Promise<Project[]>;
}

/**
 * Projects service functions
 * These functions handle all project-related API calls
 */
export const projectsService: ProjectsServiceInterface = {
  // Get all projects
  getAll: async (filters: ProjectFilters = {}): Promise<Project[]> => {
    try {
      console.log('📊 ProjectsService.getAll called with filters:', filters);

      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        const value = filters[key];
        if (value) {
          params.append(key, value);
        }
      });

      const url = params.toString() ? `/projects?${params}` : '/projects';
      console.log('📊 Making API call to:', url);

      const response = await api.get<Project[]>(url);
      console.log('📊 ProjectsService.getAll response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ ProjectsService.getAll error:', error);
      throw error;
    }
  },

  // Get project by ID
  getById: async (projectId: string): Promise<Project> => {
    const response = await api.get<Project>(`/projects/${projectId}`);
    return response.data;
  },

  // Create new project
  create: async (projectData: Partial<Project>): Promise<Project> => {
    const response = await api.post<Project>('/projects', projectData);
    return response.data;
  },

  // Update project
  update: async ({ projectId, projectData }: ProjectUpdatePayload): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${projectId}`, projectData);
    return response.data;
  },

  // Delete project
  delete: async (projectId: string): Promise<DeleteProjectResponse> => {
    const response = await api.delete<DeleteProjectResponse>(`/projects/${projectId}`);
    return response.data;
  },

  // Search projects
  search: async (query: string): Promise<Project[]> => {
    const response = await api.get<Project[]>(
      `/projects/search?query=${encodeURIComponent(query)}`
    );
    return response.data;
  },

  // Join project
  join: async (projectId: string): Promise<JoinLeaveResponse> => {
    const response = await api.post<JoinLeaveResponse>(`/projects/${projectId}/join`);
    return response.data;
  },

  // Leave project
  leave: async (projectId: string): Promise<JoinLeaveResponse> => {
    const response = await api.post<JoinLeaveResponse>(`/projects/${projectId}/leave`);
    return response.data;
  },

  // Request collaboration
  requestCollaboration: async (projectId: string): Promise<CollaborationResponse> => {
    const response = await api.post<CollaborationResponse>(`/projects/${projectId}/collaborate`);
    return response.data;
  },

  // Handle collaboration request
  handleCollaborationRequest: async ({
    projectId,
    userId,
    status,
  }: CollaborationRequestPayload): Promise<CollaborationResponse> => {
    const response = await api.put<CollaborationResponse>(
      `/projects/${projectId}/collaborate/${userId}`,
      { status }
    );
    return response.data;
  },

  // Get user's projects
  getUserProjects: async (userId: string): Promise<Project[]> => {
    const response = await api.get<Project[]>(`/projects/user/${userId}`);
    return response.data;
  },

  // Get projects by status
  getByStatus: async (status: string): Promise<Project[]> => {
    const response = await api.get<Project[]>(`/projects?status=${status}`);
    return response.data;
  },

  // Get featured projects
  getFeatured: async (): Promise<Project[]> => {
    const response = await api.get<Project[]>('/projects?featured=true');
    return response.data;
  },
};

export default projectsService;
