import api from '../utils/api';
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { User, UserRole, Session, Project } from '../types';

/**
 * Shape returned by GET /admin/users/:id — the server wraps the user with their
 * sessions and projects rather than returning a bare User.
 */
export interface UserDetailsResponse {
  user: User;
  sessions: Session[];
  projects: Project[];
}

// Create a custom axios instance for admin operations with longer timeout
const adminApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for admin operations
  withCredentials: true, // Send cookies with all requests for httpOnly cookie auth
});

// Add auth token to admin requests
adminApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Refresh token response type
 */
interface RefreshTokenResponse {
  accessToken: string;
}

/**
 * Extended axios config with retry flag
 */
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Handle auth errors for admin API
adminApi.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<AxiosResponse | never> => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      // Try to refresh token or redirect to login
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await api.post<RefreshTokenResponse>('/auth/refresh-token', {
            refreshToken,
          });
          localStorage.setItem('accessToken', response.data.accessToken);
          // Retry the original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
          }
          return adminApi.request(originalRequest);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  newUsersToday: number;
  newProjectsToday: number;
}

/**
 * Admin user list query parameters
 */
export interface AdminUserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | undefined;
}

/**
 * Paginated users response
 */
export interface PaginatedUsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * User role update data
 */
export interface RoleUpdateData {
  role: UserRole;
}

/**
 * User suspension data
 */
export interface SuspensionData {
  suspend: boolean;
  reason?: string;
  duration?: number;
}

/**
 * System log entry
 */
export interface SystemLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * System logs query parameters
 */
export interface SystemLogsQueryParams {
  page?: number;
  limit?: number;
  level?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: string | number | undefined;
}

/**
 * Paginated logs response
 */
export interface PaginatedLogsResponse {
  logs: SystemLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Admin operation response
 */
export interface AdminOperationResponse {
  message: string;
  user?: User;
}

/**
 * Admin service interface
 */
export interface AdminServiceInterface {
  getDashboardStats: () => Promise<DashboardStats>;
  getAllUsers: (params?: AdminUserQueryParams) => Promise<PaginatedUsersResponse>;
  getUserDetails: (userId: string) => Promise<UserDetailsResponse>;
  updateUserRole: (userId: string, roleData: RoleUpdateData) => Promise<AdminOperationResponse>;
  suspendUser: (
    userId: string,
    suspensionData?: Partial<SuspensionData>
  ) => Promise<AdminOperationResponse>;
  unsuspendUser: (userId: string) => Promise<AdminOperationResponse>;
  deleteUser: (userId: string, permanent?: boolean) => Promise<AdminOperationResponse>;
  getSystemLogs: (params?: SystemLogsQueryParams) => Promise<PaginatedLogsResponse>;
}

/**
 * Admin service for managing users and system operations
 */
export const adminService: AdminServiceInterface = {
  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await adminApi.get<DashboardStats>('/admin/dashboard');
    return response.data;
  },

  // User Management
  getAllUsers: async (params: AdminUserQueryParams = {}): Promise<PaginatedUsersResponse> => {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    ).toString();
    // The server nests pagination under `pagination` and calls the page count
    // `pages`; map it to the flat { total, page, limit, totalPages } shape the UI
    // expects (otherwise total/totalPages are undefined and paging breaks).
    const response = await adminApi.get<{
      users: User[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/admin/users?${queryString}`);
    const { users, pagination } = response.data;
    return {
      users,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.pages,
    };
  },

  getUserDetails: async (userId: string): Promise<UserDetailsResponse> => {
    const response = await adminApi.get<UserDetailsResponse>(`/admin/users/${userId}`);
    return response.data;
  },

  updateUserRole: async (
    userId: string,
    roleData: RoleUpdateData
  ): Promise<AdminOperationResponse> => {
    const response = await adminApi.put<AdminOperationResponse>(
      `/admin/users/${userId}/role`,
      roleData
    );
    return response.data;
  },

  suspendUser: async (
    userId: string,
    suspensionData: Partial<SuspensionData> = {}
  ): Promise<AdminOperationResponse> => {
    const response = await adminApi.put<AdminOperationResponse>(
      `/admin/users/${userId}/suspension`,
      {
        suspend: true,
        ...suspensionData,
      }
    );
    return response.data;
  },

  unsuspendUser: async (userId: string): Promise<AdminOperationResponse> => {
    const response = await adminApi.put<AdminOperationResponse>(
      `/admin/users/${userId}/suspension`,
      {
        suspend: false,
      }
    );
    return response.data;
  },

  deleteUser: async (userId: string, permanent = false): Promise<AdminOperationResponse> => {
    const response = await adminApi.delete<AdminOperationResponse>(
      `/admin/users/${userId}?permanent=${permanent}`
    );
    return response.data;
  },

  // System Logs
  getSystemLogs: async (params: SystemLogsQueryParams = {}): Promise<PaginatedLogsResponse> => {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    ).toString();
    const response = await adminApi.get<PaginatedLogsResponse>(`/admin/logs?${queryString}`);
    return response.data;
  },
};

export default adminService;
