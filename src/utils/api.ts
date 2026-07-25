import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import logger from './logger';
import { queryClient, queryKeys } from '../config/queryClient';

/**
 * The app's HTTP client for the in-process `/api` routes.
 *
 * Authentication is entirely Better Auth's httpOnly session cookie (ADR 0002),
 * which the browser attaches on its own — hence `withCredentials` and nothing
 * else. There is no Authorization header to set, no access token to read and no
 * refresh dance to orchestrate: when a session ends, the server says 401.
 * (The previous interceptor pair chased `/auth/refresh-token`, an endpoint that
 * no longer exists.)
 *
 * A 401 is, however, news: the API has just told us this browser's session is
 * no longer good — revoked from another device, suspended by a moderator, or
 * simply expired — while the cached answer to "who is signed in?" may be up to
 * five minutes old and still says otherwise. So a 401 invalidates that query,
 * and the guards act on the truth on the next render instead of leaving the
 * member in a UI they can no longer use.
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

    if (status === 401) {
      // Re-ask Better Auth who we are. If the session really is gone the query
      // resolves to null and the route guards take over; if the 401 was about
      // this one endpoint, nothing changes.
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser() });
    }
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
