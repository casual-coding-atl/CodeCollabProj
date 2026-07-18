/// <reference types="vite/client" />

/**
 * Type declarations for environment variables
 * Extends NodeJS.ProcessEnv for legacy support and ImportMetaEnv for Vite
 */

/**
 * Vite environment variables interface
 * All VITE_* prefixed environment variables should be declared here
 */
interface ImportMetaEnv {
  /**
   * Base URL for API requests
   * @example "http://localhost:5001/api"
   */
  readonly VITE_API_URL: string;

  /**
   * Optional: Application name for display purposes
   */
  readonly VITE_APP_NAME?: string;

  /**
   * Optional: Application version
   */
  readonly VITE_APP_VERSION?: string;

  /**
   * Optional: Enable debug mode for additional logging
   */
  readonly VITE_DEBUG?: 'true' | 'false';

  /**
   * Optional: Sentry DSN for error tracking
   */
  readonly VITE_SENTRY_DSN?: string;

  /**
   * Optional: Google Analytics tracking ID
   */
  readonly VITE_GA_TRACKING_ID?: string;

  /**
   * Optional: Feature flags as JSON string
   */
  readonly VITE_FEATURE_FLAGS?: string;

  /**
   * Vite mode (development, production)
   */
  readonly MODE: string;

  /**
   * Base URL of the application
   */
  readonly BASE_URL: string;

  /**
   * Whether the app is running in production mode
   */
  readonly PROD: boolean;

  /**
   * Whether the app is running in development mode
   */
  readonly DEV: boolean;

  /**
   * Whether the app is running in SSR mode
   */
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Legacy NodeJS.ProcessEnv support for backwards compatibility
 * @deprecated Use import.meta.env with VITE_* variables instead
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * Node environment (development, production, test)
     */
    NODE_ENV: 'development' | 'production' | 'test';

    /**
     * @deprecated Use import.meta.env.VITE_API_URL instead
     * Base URL for API requests
     * @example "http://localhost:5001/api"
     */
    REACT_APP_API_URL?: string;

    /**
     * @deprecated Use import.meta.env.VITE_APP_NAME instead
     * Optional: Application name for display purposes
     */
    REACT_APP_NAME?: string;

    /**
     * @deprecated Use import.meta.env.VITE_APP_VERSION instead
     * Optional: Application version
     */
    REACT_APP_VERSION?: string;

    /**
     * @deprecated Use import.meta.env.VITE_DEBUG instead
     * Optional: Enable debug mode for additional logging
     */
    REACT_APP_DEBUG?: 'true' | 'false';

    /**
     * @deprecated Use import.meta.env.VITE_SENTRY_DSN instead
     * Optional: Sentry DSN for error tracking
     */
    REACT_APP_SENTRY_DSN?: string;

    /**
     * @deprecated Use import.meta.env.VITE_GA_TRACKING_ID instead
     * Optional: Google Analytics tracking ID
     */
    REACT_APP_GA_TRACKING_ID?: string;

    /**
     * @deprecated Use import.meta.env.VITE_FEATURE_FLAGS instead
     * Optional: Feature flags as JSON string
     */
    REACT_APP_FEATURE_FLAGS?: string;
  }
}

export {};
