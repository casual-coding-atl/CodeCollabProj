import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import logger from './logger';

/**
 * Extended axios request config with retry flag
 */
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Auth service interface for lazy loading
 */
interface AuthService {
  getValidToken: () => Promise<string | null>;
  getTokenNoRefresh: () => string | null;
  refreshToken: () => Promise<string>;
  clearTokens: () => void;
}

/**
 * Queued promise handlers for token refresh
 */
interface QueuedPromise {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

/**
 * API error response data structure
 */
interface ApiErrorData {
  error?: string;
  needsVerification?: boolean;
  retryAfter?: number;
}

// We'll import authService after it's defined to avoid circular dependency
let authService: AuthService | null = null;

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  withCredentials: true, // Send cookies with all requests for httpOnly cookie auth
});

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: QueuedPromise[] = [];

const processQueue = (error: Error | null, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Enhanced request interceptor with automatic token refresh
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    // Lazy load authService to avoid circular dependency
    if (!authService) {
      const authModule = await import('../services/authService');
      authService = (authModule.authService || authModule.default) as AuthService;
    }

    // For auth endpoints (login, register, refresh), don't add token
    const isAuthEndpoint =
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/register') ||
      config.url?.includes('/auth/refresh-token');

    // Determine if this is a critical operation that needs fresh token
    const isCriticalOperation =
      config.url?.includes('/auth/') ||
      config.url?.includes('/password') ||
      config.url?.includes('/session') ||
      config.method?.toLowerCase() === 'post' ||
      config.method?.toLowerCase() === 'put' ||
      config.method?.toLowerCase() === 'delete';

    if (!isAuthEndpoint) {
      // Using httpOnly cookies for authentication (withCredentials: true above)
      // Cookies are automatically sent with all requests, no need for manual token handling
      // The following code is kept for backward compatibility with localStorage-based auth

      try {
        // Try to get token from localStorage (backward compatibility)
        const token = authService?.getTokenNoRefresh();

        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // If no token in localStorage, httpOnly cookies will handle authentication
      } catch (_error) {
        // If token retrieval fails, that's okay - cookies will handle auth
      }
    }

    // Only log API requests in development mode and for important operations
    if (import.meta.env.DEV && isCriticalOperation) {
      logger.debug('🌐 API Request:', {
        method: config.method?.toUpperCase() || 'unknown',
        url: config.url || 'unknown',
        hasToken: !!config.headers?.Authorization,
        isAuthEndpoint,
        isCritical: isCriticalOperation,
      });
    }

    return config;
  },
  (error: AxiosError): Promise<never> => {
    logger.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with automatic token refresh
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    // Only log successful responses for critical operations in development
    const isCriticalUrl =
      response?.config?.url?.includes('/auth/') ||
      response?.config?.url?.includes('/password') ||
      response?.config?.url?.includes('/session');

    if (import.meta.env.DEV && isCriticalUrl) {
      logger.debug('✅ API Response:', {
        status: response?.status || 'unknown',
        url: response?.config?.url || 'unknown',
      });
    }

    return response;
  },
  async (error: AxiosError<ApiErrorData>): Promise<AxiosResponse | never> => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig | undefined;

    // Enhanced error logging
    const errorInfo = {
      status: error?.response?.status,
      message: error?.response?.data?.error || error?.message || 'Unknown error',
      url: error?.config?.url,
      isNetworkError: !error?.response,
      errorType: error?.code || 'unknown',
    };

    logger.error('❌ API Error:', errorInfo);

    // Handle network errors (connection issues)
    if (!error?.response) {
      logger.error('🌐 Network error - server may be down');
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized errors with token refresh
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't attempt refresh for auth endpoints or if already retrying
      const isAuthEndpoint = originalRequest.url?.includes('/auth/');
      const needsVerification = error?.response?.data?.needsVerification;

      if (isAuthEndpoint || needsVerification) {
        // For auth endpoints or verification needed, don't retry
        if (needsVerification) {
          logger.debug('🔐 Email verification required');
        }
        return Promise.reject(error);
      }

      // Lazy load authService if not already loaded
      if (!authService) {
        try {
          const authModule = await import('../services/authService');
          authService = (authModule.authService || authModule.default) as AuthService;
        } catch (importError) {
          logger.error('Failed to import authService:', importError);
          return Promise.reject(error);
        }
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err: Error) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await authService.refreshToken();
        processQueue(null, newToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const refreshErr =
          refreshError instanceof Error ? refreshError : new Error('Token refresh failed');
        processQueue(refreshErr, null);

        logger.debug('🔐 Token refresh failed - clearing tokens and redirecting to login');
        authService.clearTokens();

        // Redirect to login after a brief delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden
    if (error?.response?.status === 403) {
      logger.warn('🚫 Access forbidden - insufficient permissions');
    }

    // Handle 429 Too Many Requests
    if (error?.response?.status === 429) {
      const retryAfter = error?.response?.data?.retryAfter || 60;
      logger.warn(`⏱️ Rate limited - retry after ${retryAfter} seconds`);
    }

    return Promise.reject(error);
  }
);

/**
 * Debug function to help troubleshoot API configuration
 */
export const debugApiConfig = (): void => {
  if (import.meta.env.DEV) {
    logger.debug('🔍 API Debug Info:', {
      baseURL: api.defaults.baseURL,
      timeout: api.defaults.timeout,
      headers: api.defaults.headers,
    });
  }
};

export default api;
