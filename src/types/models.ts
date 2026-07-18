/**
 * TypeScript interfaces for API response shapes (client-side representations)
 * These interfaces represent the data as returned from the API, not Mongoose documents
 */

// ============================================================================
// Enums and Union Types
// ============================================================================

export type UserRole = 'user' | 'moderator' | 'admin';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type Availability =
  | 'full-time'
  | 'part-time'
  | 'weekends'
  | 'evenings'
  | 'flexible';

export type Permission =
  // User management
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  // Project management
  | 'projects.read'
  | 'projects.create'
  | 'projects.update'
  | 'projects.delete'
  | 'projects.moderate'
  // Comment management
  | 'comments.read'
  | 'comments.create'
  | 'comments.update'
  | 'comments.delete'
  | 'comments.moderate'
  // Admin functions
  | 'admin.dashboard'
  | 'admin.users'
  | 'admin.analytics'
  | 'admin.system'
  // Moderation
  | 'moderate.content'
  | 'moderate.users'
  | 'moderate.reports';

export type ProjectStatus = 'ideation' | 'in_progress' | 'completed';

export type CollaboratorStatus = 'pending' | 'accepted' | 'rejected';

export type IncentiveType =
  | 'monetary'
  | 'equity'
  | 'recognition'
  | 'learning'
  | 'other';

export type SessionRevokedReason =
  | 'logout'
  | 'password_change'
  | 'admin_revoke'
  | 'security_breach'
  | 'expired'
  | 'concurrent_limit';

// ============================================================================
// Nested Types
// ============================================================================

export interface PortfolioLink {
  name: string;
  url: string;
}

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
}

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  platform?: string;
  browser?: string;
}

export interface LocationInfo {
  country?: string;
  city?: string;
  timezone?: string;
}

export interface Collaborator {
  userId: string | User;
  status: CollaboratorStatus;
}

export interface ProjectResource {
  name: string;
  url: string;
  fileId?: string;
}

export interface ProjectIncentives {
  enabled: boolean;
  type: IncentiveType;
  description?: string;
  amount?: number;
  currency?: string;
  equityPercentage?: number;
  customReward?: string;
}

// ============================================================================
// Main Entity Interfaces
// ============================================================================

/**
 * User interface representing a user as returned from the API
 */
export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  skills: string[];
  experience: ExperienceLevel;
  location?: string;
  timezone?: string;
  availability: Availability;
  portfolioLinks: PortfolioLink[];
  socialLinks: SocialLinks;
  profileImage?: string;
  isProfilePublic: boolean;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  isEmailVerified?: boolean;
  isSuspended?: boolean;
  suspendedUntil?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal user info typically returned in references (e.g., project owner)
 */
export interface UserSummary {
  id: string;
  email: string;
  username: string;
  profileImage?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Project interface representing a project as returned from the API
 */
export interface Project {
  id: string;
  title: string;
  description: string;
  image?: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  status: ProjectStatus;
  requiredSkills: string[];
  tags: string[];
  owner: string | User | UserSummary;
  collaborators: Collaborator[];
  resources: ProjectResource[];
  incentives: ProjectIncentives;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session interface representing a user session
 */
export interface Session {
  id: string;
  userId?: string;
  deviceInfo: DeviceInfo;
  location: LocationInfo;
  lastActivity: string;
  isActive: boolean;
  expiresAt?: string;
  revokedAt?: string;
  revokedReason?: SessionRevokedReason;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Comment interface representing a comment on a project
 */
export interface Comment {
  id: string;
  projectId: string;
  userId: string | User | UserSummary;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message interface representing a direct message between users
 */
export interface Message {
  id: string;
  sender: string | User | UserSummary;
  recipient: string | User | UserSummary;
  subject: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ============================================================================
// API Response Wrapper Types
// ============================================================================

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Generic API error response
 */
export interface ApiError {
  message: string;
  error?: string;
  errors?: Array<{
    field?: string;
    message: string;
    value?: unknown;
  }>;
}
