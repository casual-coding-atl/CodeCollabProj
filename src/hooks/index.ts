/**
 * Central export file for all hooks
 * Import hooks from this file for convenient access:
 *
 * @example
 * import { useAuth, useProjects, useAdminDashboard } from '../hooks';
 */

// Admin hooks
export {
  useAdminDashboard,
  useAdminUsers,
  useAdminUserDetails,
  useAdminUserMutations,
} from './admin';

// Note: Other hook domains (auth, comments, projects, users) can be added here
// as they are migrated to TypeScript
