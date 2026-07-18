/**
 * Performance optimization utilities
 */

/**
 * Generic function type
 */
type AnyFunction<T = unknown> = (...args: unknown[]) => T;

/**
 * Intersection Observer options
 */
interface IntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * Cache item with expiration
 */
interface CacheItem<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Debounce function for search inputs and other frequent events
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends AnyFunction>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(...args: Parameters<T>): void {
    const later = (): void => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function for scroll events and other high-frequency events
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends AnyFunction>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return function (this: unknown, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Memoization helper for expensive calculations
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export const memoize = <T extends AnyFunction>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Intersection Observer for lazy loading
 * @param callback - Callback function for intersection events
 * @param options - Observer options
 * @returns IntersectionObserver instance
 */
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverOptions = {}
): IntersectionObserver => {
  return new IntersectionObserver(callback, {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
    ...options,
  });
};

/**
 * Preload critical resources
 * @param href - Resource URL
 * @param as - Resource type
 */
export const preloadResource = (href: string, as = 'fetch'): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
};

/**
 * Prefetch non-critical resources
 * @param href - Resource URL
 */
export const prefetchResource = (href: string): void => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
};

/**
 * Performance monitoring
 * @param name - Name for the performance entry
 * @param fn - Function to measure
 * @returns Result of the function
 */
export const measurePerformance = <T>(name: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`⏱️ ${name} took ${end - start}ms`);
  return result;
};

/**
 * Async performance measurement
 * @param name - Name for the performance entry
 * @param fn - Async function to measure
 * @returns Promise with the result of the function
 */
export const measureAsyncPerformance = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`⏱️ ${name} took ${end - start}ms`);
  return result;
};

/**
 * Batch DOM updates
 * @param updates - Array of update functions
 * @returns Promise that resolves when updates are complete
 */
export const batchDOMUpdates = (updates: Array<() => void>): Promise<void> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      updates.forEach((update) => update());
      resolve();
    });
  });
};

/**
 * Optimize images
 * @param src - Image source URL
 * @param width - Desired width
 * @returns Optimized image URL
 */
export const optimizeImage = (src: string, width = 800): string => {
  // Add width parameter for responsive images
  return `${src}?w=${width}&q=80`;
};

/**
 * Cache manager interface
 */
export interface CacheManager {
  cache: Map<string, CacheItem<unknown>>;
  set: <T>(key: string, value: T, ttl?: number) => void;
  get: <T>(key: string) => T | null;
  clear: () => void;
  size: () => number;
}

/**
 * Cache management
 */
export const cacheManager: CacheManager = {
  cache: new Map<string, CacheItem<unknown>>(),

  set<T>(key: string, value: T, ttl: number = 5 * 60 * 1000): void {
    // 5 minutes default
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  },

  get<T>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined;
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  },

  clear(): void {
    this.cache.clear();
  },

  size(): number {
    return this.cache.size;
  },
};

export default {
  debounce,
  throttle,
  memoize,
  createIntersectionObserver,
  preloadResource,
  prefetchResource,
  measurePerformance,
  measureAsyncPerformance,
  batchDOMUpdates,
  optimizeImage,
  cacheManager,
};
