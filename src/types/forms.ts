/**
 * Form data types for user input and form handling
 */

import type {
  ExperienceLevel,
  Availability,
  ProjectStatus,
  IncentiveType,
  PortfolioLink,
  SocialLinks,
} from './models';

// ============================================================================
// Authentication Forms
// ============================================================================

/**
 * Login form data
 */
export interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Registration form data
 */
export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

/**
 * Password change form data (when authenticated)
 */
export interface PasswordChangeFormData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/**
 * Request password reset form data
 */
export interface RequestPasswordResetFormData {
  email: string;
}

/**
 * Reset password form data (with token)
 */
export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

// ============================================================================
// Profile Forms
// ============================================================================

/**
 * Profile form data for editing user profile
 */
export interface ProfileFormData {
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
  isProfilePublic: boolean;
}

/**
 * Form data for uploading a profile image
 */
export interface ProfileImageFormData {
  image: File;
}

// ============================================================================
// Project Forms
// ============================================================================

/**
 * Project creation/edit form data
 */
export interface ProjectFormData {
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  status: ProjectStatus;
  requiredSkills: string[];
  tags: string[];
  incentives?: ProjectIncentivesFormData;
}

/**
 * Project incentives form data
 */
export interface ProjectIncentivesFormData {
  enabled: boolean;
  type: IncentiveType;
  description?: string;
  amount?: number;
  currency?: string;
  equityPercentage?: number;
  customReward?: string;
}

/**
 * Project resource form data
 */
export interface ProjectResourceFormData {
  name: string;
  url: string;
}

/**
 * Project image upload form data
 */
export interface ProjectImageFormData {
  image: File;
}

// ============================================================================
// Comment Forms
// ============================================================================

/**
 * Comment creation/edit form data
 */
export interface CommentFormData {
  content: string;
}

// ============================================================================
// Message Forms
// ============================================================================

/**
 * Direct message form data
 */
export interface MessageFormData {
  recipient: string;
  subject: string;
  content: string;
}

/**
 * Reply to message form data (recipient is inferred)
 */
export interface MessageReplyFormData {
  subject: string;
  content: string;
}

// ============================================================================
// Search and Filter Forms
// ============================================================================

/**
 * Project search/filter form data
 */
export interface ProjectFilterFormData {
  search?: string;
  technologies?: string[];
  status?: ProjectStatus | '';
  tags?: string[];
}

/**
 * User search/filter form data
 */
export interface UserFilterFormData {
  search?: string;
  skills?: string[];
  experience?: ExperienceLevel | '';
  availability?: Availability | '';
}

// ============================================================================
// Admin Forms
// ============================================================================

/**
 * Admin user role update form data
 */
export interface UserRoleUpdateFormData {
  role: 'user' | 'moderator' | 'admin';
}

/**
 * Admin user suspension form data
 */
export interface UserSuspensionFormData {
  reason: string;
  duration?: number; // Duration in milliseconds, undefined for permanent
}

// ============================================================================
// Collaboration Forms
// ============================================================================

/**
 * Collaboration request form data
 */
export interface CollaborationRequestFormData {
  message?: string;
}

/**
 * Collaboration response form data
 */
export interface CollaborationResponseFormData {
  status: 'accepted' | 'rejected';
  message?: string;
}
