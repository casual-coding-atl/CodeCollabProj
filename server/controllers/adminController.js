const { validationResult } = require('express-validator');
const User = require('../models/User');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const Session = require('../models/Session');
const logger = require('../utils/logger');

// Sensitive fields that should NEVER be returned in API responses
const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

/**
 * Admin Dashboard - Get system statistics (optimized)
 */
const getDashboardStats = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Run all database queries in parallel for better performance
    const [userStats, projectStats, commentCount, sessionCount] = await Promise.all([
      // User statistics aggregation
      User.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [{ $match: { isActive: true } }, { $count: 'count' }],
            suspended: [{ $match: { isSuspended: true } }, { $count: 'count' }],
            admins: [{ $match: { role: 'admin' } }, { $count: 'count' }],
            moderators: [{ $match: { role: 'moderator' } }, { $count: 'count' }],
            newThisWeek: [{ $match: { createdAt: { $gte: sevenDaysAgo } } }, { $count: 'count' }],
          },
        },
      ]),

      // Project statistics aggregation
      Project.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [{ $match: { status: 'active' } }, { $count: 'count' }],
            newThisWeek: [{ $match: { createdAt: { $gte: sevenDaysAgo } } }, { $count: 'count' }],
          },
        },
      ]).catch(() => [
        { total: [{ count: 0 }], active: [{ count: 0 }], newThisWeek: [{ count: 0 }] },
      ]),

      // Comment count (with fallback)
      Comment.countDocuments().catch(() => 0),

      // Active sessions count (with fallback)
      Session.countDocuments({ isActive: true }).catch(() => 0),
    ]);

    // Extract counts with fallbacks
    const users = userStats[0] || {};
    const projects = projectStats[0] || {};

    const getUserCount = (field) => users[field]?.[0]?.count || 0;
    const getProjectCount = (field) => projects[field]?.[0]?.count || 0;

    // Log admin dashboard access
    logger.adminAction('dashboard_access', {
      adminId: req.user._id,
      adminEmail: req.user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      users: {
        total: getUserCount('total'),
        active: getUserCount('active'),
        suspended: getUserCount('suspended'),
        admins: getUserCount('admins'),
        moderators: getUserCount('moderators'),
        newThisWeek: getUserCount('newThisWeek'),
      },
      content: {
        projects: {
          total: getProjectCount('total'),
          active: getProjectCount('active'),
          newThisWeek: getProjectCount('newThisWeek'),
        },
        comments: {
          total: commentCount || 0,
        },
      },
      system: {
        activeSessions: sessionCount || 0,
      },
    });
  } catch (error) {
    logger.error('Admin dashboard error', {
      error: error.message,
      adminId: req.user?._id || 'unknown',
      stack: error.stack,
    });

    // Return fallback data instead of failing completely
    res.json({
      users: {
        total: 0,
        active: 0,
        suspended: 0,
        admins: 0,
        moderators: 0,
        newThisWeek: 0,
      },
      content: {
        projects: {
          total: 0,
          active: 0,
          newThisWeek: 0,
        },
        comments: {
          total: 0,
        },
      },
      system: {
        activeSessions: 0,
      },
      error: 'Some statistics may be unavailable',
    });
  }
};

/**
 * Get all users with admin information
 */
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const role = req.query.role;
    const status = req.query.status;

    // Build filter query
    const filter = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status) {
      switch (status) {
        case 'active':
          filter.isActive = true;
          filter.isSuspended = false;
          break;
        case 'suspended':
          filter.isSuspended = true;
          break;
        case 'inactive':
          filter.isActive = false;
          break;
      }
    }

    const users = await User.find(filter)
      .select(SENSITIVE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    logger.adminAction('users_list_access', {
      adminId: req.user._id,
      filter,
      page,
      limit,
      total,
    });

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Admin get users error', {
      error: error.message,
      adminId: req.user._id,
    });
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

/**
 * Get specific user details
 */
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(SENSITIVE_FIELDS);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's sessions
    const sessions = await Session.find({ userId, isActive: true })
      .select('deviceInfo location lastActivity createdAt')
      .sort({ lastActivity: -1 });

    // Get user's projects
    const projects = await Project.find({
      $or: [{ createdBy: userId }, { collaborators: userId }],
    })
      .select('title status createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    logger.adminAction('user_details_access', {
      adminId: req.user._id,
      targetUserId: userId,
      targetUserEmail: user.email,
    });

    res.json({
      user,
      sessions,
      projects,
    });
  } catch (error) {
    logger.error('Admin get user details error', {
      error: error.message,
      adminId: req.user._id,
      targetUserId: req.params.userId,
    });
    res.status(500).json({ message: 'Error fetching user details', error: error.message });
  }
};

/**
 * Update user role and permissions
 */
const updateUserRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { role, permissions, customPermissions } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-demotion
    if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
      return res.status(400).json({ message: 'Cannot change your own admin role' });
    }

    const oldRole = user.role;
    const oldPermissions = [...user.permissions];

    // Update role if provided
    if (role) {
      user.setRole(role);
    }

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      user.permissions = permissions;
    } else if (customPermissions && Array.isArray(customPermissions)) {
      // Add custom permissions to existing ones
      customPermissions.forEach((permission) => {
        user.addPermission(permission);
      });
    }

    await user.save();

    logger.adminAction('user_role_updated', {
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetUserId: userId,
      targetUserEmail: user.email,
      oldRole,
      newRole: user.role,
      oldPermissions,
      newPermissions: user.permissions,
      ip: req.ip,
    });

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    logger.error('Admin update user role error', {
      error: error.message,
      adminId: req.user._id,
      targetUserId: req.params.userId,
    });
    res.status(500).json({ message: 'Error updating user role', error: error.message });
  }
};

/**
 * Suspend/Unsuspend user
 */
const toggleUserSuspension = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { suspend, reason, duration } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-suspension
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot suspend your own account' });
    }

    // Prevent suspending other admins (unless you're a super admin)
    if (user.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot suspend other administrators' });
    }

    if (suspend) {
      user.suspend(reason, duration);

      // Revoke all user sessions
      await Session.updateMany(
        { userId, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'admin_suspend',
        }
      );
    } else {
      user.unsuspend();
    }

    await user.save();

    logger.adminAction(suspend ? 'user_suspended' : 'user_unsuspended', {
      adminId: req.user._id,
      adminEmail: req.user.email,
      targetUserId: userId,
      targetUserEmail: user.email,
      reason,
      duration,
      ip: req.ip,
    });

    res.json({
      message: `User ${suspend ? 'suspended' : 'unsuspended'} successfully`,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isSuspended: user.isSuspended,
        suspensionReason: user.suspensionReason,
        suspendedUntil: user.suspendedUntil,
      },
    });
  } catch (error) {
    logger.error('Admin toggle user suspension error', {
      error: error.message,
      adminId: req.user._id,
      targetUserId: req.params.userId,
    });
    res.status(500).json({ message: 'Error updating user suspension', error: error.message });
  }
};

/**
 * Delete user (soft delete by deactivating)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permanent } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete administrator accounts' });
    }

    if (permanent === 'true') {
      // Permanent deletion (only for super admins)
      await User.findByIdAndDelete(userId);

      // Also delete all sessions
      await Session.deleteMany({ userId });

      logger.adminAction('user_permanently_deleted', {
        adminId: req.user._id,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: user.email,
        ip: req.ip,
      });

      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete (deactivate)
      user.isActive = false;
      await user.save();

      // Revoke all sessions
      await Session.updateMany(
        { userId, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'account_deactivated',
        }
      );

      logger.adminAction('user_deactivated', {
        adminId: req.user._id,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetUserEmail: user.email,
        ip: req.ip,
      });

      res.json({ message: 'User account deactivated' });
    }
  } catch (error) {
    logger.error('Admin delete user error', {
      error: error.message,
      adminId: req.user._id,
      targetUserId: req.params.userId,
    });
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

/**
 * Get system logs (recent security events)
 */
const getSystemLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type;

    // This would typically read from a logging service or database
    // For now, we'll return a placeholder response
    logger.adminAction('system_logs_access', {
      adminId: req.user._id,
      page,
      limit,
      type,
    });

    res.json({
      message: 'System logs feature - integrate with your logging system',
      filters: {
        page,
        limit,
        type,
      },
    });
  } catch (error) {
    logger.error('Admin get system logs error', {
      error: error.message,
      adminId: req.user._id,
    });
    res.status(500).json({ message: 'Error fetching system logs', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUserRole,
  toggleUserSuspension,
  deleteUser,
  getSystemLogs,
};
