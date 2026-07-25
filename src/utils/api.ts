import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import logger from './logger';

/**
 * The app's HTTP client for the in-process `/api` routes.
 *
 * Authentication is entirely Better Auth's httpOnly session cookie (ADR 0002),
 * which the browser attaches on its own — hence `withCredentials` and nothing
 * else. There is no Authorization header to set, no access token to read and no
 * refresh dance to orchestrate: when a session ends, the server says 401 and
 * the calling hook decides what to show. (The previous interceptor pair chased
 * `/auth/refresh-token`, an endpoint that no longer exists.)
 */

/**
 * API error response data structure
 */
interface ApiErrorData {
  error?: string;
  message?: string;
  retryAfter?: number;
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  withCredentials: true, // send the Better Auth session cookie
});

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error: AxiosError<ApiErrorData>): Promise<never> => {
    const status = error?.response?.status;

    logger.error('❌ API Error:', {
      status,
      message: error?.response?.data?.error || error?.message || 'Unknown error',
      url: error?.config?.url,
      isNetworkError: !error?.response,
    });

    if (status === 403) {
      logger.warn('🚫 Access forbidden - insufficient permissions');
    }
    if (status === 429) {
      logger.warn(`⏱️ Rate limited - retry after ${error?.response?.data?.retryAfter ?? 60}s`);
    }

    return Promise.reject(error);
  }
);

export default api;
