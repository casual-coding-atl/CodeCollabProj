import mongoose, { Schema, HydratedDocument, CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  IUser,
  IUserMethods,
  UserModel,
  UserRole,
  Permission,
  ExperienceLevel,
  Availability,
} from '../types/models';

const { SECURITY } = require('../config/constants');

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    // Email verification fields
    isEmailVerified: {
      type: Boolean,
      default: process.env.NODE_ENV === 'development' ? true : false,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpires: {
      type: Date,
    },
    // Password reset fields
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    firstName: {
      type: String,
      trim: true,
      minlength: 2,
    },
    lastName: {
      type: String,
      trim: true,
      minlength: 2,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    experience: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'] as ExperienceLevel[],
      default: 'beginner',
    },
    location: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      trim: true,
    },
    availability: {
      type: String,
      enum: ['full-time', 'part-time', 'weekends', 'evenings', 'flexible'] as Availability[],
      default: 'flexible',
    },
    portfolioLinks: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        url: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    socialLinks: {
      github: {
        type: String,
        trim: true,
      },
      linkedin: {
        type: String,
        trim: true,
      },
      twitter: {
        type: String,
        trim: true,
      },
      website: {
        type: String,
        trim: true,
      },
    },
    profileImage: {
      type: String,
      trim: true,
    },
    isProfilePublic: {
      type: Boolean,
      default: true,
    },
    // Role and permissions system
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'] as UserRole[],
      default: 'user',
      index: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          // User management
          'users.read',
          'users.create',
          'users.update',
          'users.delete',
          // Project management
          'projects.read',
          'projects.create',
          'projects.update',
          'projects.delete',
          'projects.moderate',
          // Comment management
          'comments.read',
          'comments.create',
          'comments.update',
          'comments.delete',
          'comments.moderate',
          // Admin functions
          'admin.dashboard',
          'admin.users',
          'admin.analytics',
          'admin.system',
          // Moderation
          'moderate.content',
          'moderate.users',
          'moderate.reports',
        ] as Permission[],
      },
    ],
    // Account status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspendedUntil: {
      type: Date,
    },
    suspensionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const { SECURITY } = require('../config/constants');
    const salt = await bcrypt.genSalt(SECURITY.BCRYPT_SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Error hashing password:', { error: (error as Error).message });
    next(error as CallbackError);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (
  this: HydratedDocument<IUser, IUserMethods>,
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function (
  this: HydratedDocument<IUser, IUserMethods>
): string {
  const token = crypto.randomBytes(32).toString('hex');
  // Store only a hash of the token; the raw token goes in the email link so a DB
  // read cannot yield a usable verification token.
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = new Date(Date.now() + SECURITY.EMAIL_VERIFICATION_TOKEN_EXPIRY);
  return token;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function (
  this: HydratedDocument<IUser, IUserMethods>
): string {
  const token = crypto.randomBytes(32).toString('hex');
  // Store only a hash of the token; the raw token goes in the reset link.
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + SECURITY.PASSWORD_RESET_TOKEN_EXPIRY);
  return token;
};

// Method to clear password reset token
userSchema.methods.clearPasswordResetToken = function (
  this: HydratedDocument<IUser, IUserMethods>
): void {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
};

// Role and permission management methods
userSchema.methods.hasRole = function (
  this: HydratedDocument<IUser, IUserMethods>,
  role: UserRole
): boolean {
  return this.role === role;
};

userSchema.methods.hasPermission = function (
  this: HydratedDocument<IUser, IUserMethods>,
  permission: Permission
): boolean {
  return this.permissions.includes(permission);
};

userSchema.methods.hasAnyPermission = function (
  this: HydratedDocument<IUser, IUserMethods>,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => this.permissions.includes(permission));
};

userSchema.methods.addPermission = function (
  this: HydratedDocument<IUser, IUserMethods>,
  permission: Permission
): HydratedDocument<IUser, IUserMethods> {
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission);
  }
  return this;
};

userSchema.methods.removePermission = function (
  this: HydratedDocument<IUser, IUserMethods>,
  permission: Permission
): HydratedDocument<IUser, IUserMethods> {
  this.permissions = this.permissions.filter((p) => p !== permission) as Permission[];
  return this;
};

userSchema.methods.setRole = function (
  this: HydratedDocument<IUser, IUserMethods>,
  role: UserRole
): HydratedDocument<IUser, IUserMethods> {
  this.role = role;
  // Auto-assign permissions based on role
  this.permissions = this.getDefaultPermissionsForRole(role);
  return this;
};

userSchema.methods.getDefaultPermissionsForRole = function (
  this: HydratedDocument<IUser, IUserMethods>,
  role: UserRole
): Permission[] {
  const permissions: Record<UserRole, Permission[]> = {
    user: ['projects.read', 'projects.create', 'comments.read', 'comments.create'],
    moderator: [
      'projects.read',
      'projects.create',
      'projects.moderate',
      'comments.read',
      'comments.create',
      'comments.moderate',
      'moderate.content',
      'users.read',
    ],
    admin: [
      // User management
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      // Project management
      'projects.read',
      'projects.create',
      'projects.update',
      'projects.delete',
      'projects.moderate',
      // Comment management
      'comments.read',
      'comments.create',
      'comments.update',
      'comments.delete',
      'comments.moderate',
      // Admin functions
      'admin.dashboard',
      'admin.users',
      'admin.analytics',
      'admin.system',
      // Moderation
      'moderate.content',
      'moderate.users',
      'moderate.reports',
    ],
  };

  return permissions[role] || permissions.user;
};

userSchema.methods.isAdmin = function (this: HydratedDocument<IUser, IUserMethods>): boolean {
  return this.role === 'admin';
};

userSchema.methods.isModerator = function (this: HydratedDocument<IUser, IUserMethods>): boolean {
  return this.role === 'moderator' || this.role === 'admin';
};

userSchema.methods.canManageUsers = function (
  this: HydratedDocument<IUser, IUserMethods>
): boolean {
  return this.hasAnyPermission(['users.update', 'users.delete', 'admin.users']);
};

userSchema.methods.suspend = function (
  this: HydratedDocument<IUser, IUserMethods>,
  reason: string,
  duration: number | null = null
): HydratedDocument<IUser, IUserMethods> {
  this.isSuspended = true;
  this.suspensionReason = reason;
  if (duration) {
    this.suspendedUntil = new Date(Date.now() + duration);
  }
  return this;
};

userSchema.methods.unsuspend = function (
  this: HydratedDocument<IUser, IUserMethods>
): HydratedDocument<IUser, IUserMethods> {
  this.isSuspended = false;
  this.suspendedUntil = undefined;
  this.suspensionReason = undefined;
  return this;
};

userSchema.methods.isCurrentlySuspended = function (
  this: HydratedDocument<IUser, IUserMethods>
): boolean {
  if (!this.isSuspended) return false;
  if (!this.suspendedUntil) return true;
  return new Date() < this.suspendedUntil;
};

// Pre-save middleware to auto-assign permissions based on role
userSchema.pre('save', function (next) {
  if (this.isModified('role') && !this.isModified('permissions')) {
    this.permissions = this.getDefaultPermissionsForRole(this.role);
  }
  next();
});

const User = mongoose.model<IUser, UserModel>('User', userSchema);

module.exports = User;
