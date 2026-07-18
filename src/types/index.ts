/**
 * Central export file for all TypeScript types
 * Import types from this file for convenient access:
 *
 * @example
 * import { User, Project, LoginCredentials } from '../types';
 * import type { AuthState, ProfileFormData } from '../types';
 */

// ============================================================================
// Model Types (API Response Shapes)
// ============================================================================
export type {
  // Enums and Union Types
  UserRole,
  ExperienceLevel,
  Availability,
  Permission,
  ProjectStatus,
  CollaboratorStatus,
  IncentiveType,
  SessionRevokedReason,
  // Nested Types
  PortfolioLink,
  SocialLinks,
  DeviceInfo,
  LocationInfo,
  Collaborator,
  ProjectResource,
  ProjectIncentives,
  // Main Entity Interfaces
  User,
  UserSummary,
  Project,
  Session,
  Comment,
  Message,
  // API Response Wrappers
  PaginatedResponse,
  ApiError,
} from './models';

// ============================================================================
// Authentication Types
// ============================================================================
export type {
  // Auth State
  AuthState,
  AuthStateExtended,
  // Login / Registration
  LoginCredentials,
  RegisterData,
  AuthUser,
  LoginResponse,
  RegisterResponse,
  AuthResponse,
  // Password Reset
  PasswordResetRequest,
  PasswordResetRequestResponse,
  PasswordResetRequestResponseDev,
  PasswordResetConfirm,
  VerifyPasswordResetTokenResponse,
  // Email Verification
  ResendVerificationRequest,
  EmailVerificationResponse,
  // Token Refresh
  RefreshTokenRequest,
  RefreshTokenResponse,
  // Cookie Auth
  CookieAuthCheckResult,
  // Session Management
  LogoutResponse,
  LogoutAllResponse,
  // Error States
  NeedsVerificationError,
} from './auth';

export { isNeedsVerificationError } from './auth';

// ============================================================================
// Form Data Types
// ============================================================================
export type {
  // Authentication Forms
  LoginFormData,
  RegisterFormData,
  PasswordChangeFormData,
  RequestPasswordResetFormData,
  ResetPasswordFormData,
  // Profile Forms
  ProfileFormData,
  ProfileImageFormData,
  // Project Forms
  ProjectFormData,
  ProjectIncentivesFormData,
  ProjectResourceFormData,
  ProjectImageFormData,
  // Comment Forms
  CommentFormData,
  // Message Forms
  MessageFormData,
  MessageReplyFormData,
  // Search and Filter Forms
  ProjectFilterFormData,
  UserFilterFormData,
  // Admin Forms
  UserRoleUpdateFormData,
  UserSuspensionFormData,
  // Collaboration Forms
  CollaborationRequestFormData,
  CollaborationResponseFormData,
} from './forms';
