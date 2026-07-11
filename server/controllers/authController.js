const { validationResult } = require('express-validator');
const User = require('../models/User');
const sessionService = require('../services/sessionService');
const logger = require('../utils/logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// Sensitive fields that should NEVER be returned in API responses
const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

const isProd = () => process.env.NODE_ENV === 'production';

// When the frontend and API are on different sites (as in the deployed setup),
// the browser only sends auth cookies if they are SameSite=None + Secure. Same-site
// and local dev use Lax. Override with COOKIE_SAME_SITE if a deployment differs.
const cookieSameSite = () => process.env.COOKIE_SAME_SITE || (isProd() ? 'none' : 'lax');

const accessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: cookieSameSite(),
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
});

const refreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: cookieSameSite(),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
});

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username } = req.body;

    // Check if user already exists
    // Use generic error message to prevent user enumeration
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email or username already exists',
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      username,
    });

    await user.save();
    logger.info(`User saved to database: ${user._id}`);

    // In development, skip email verification
    if (process.env.NODE_ENV === 'development') {
      logger.info('Development mode: Auto-verifying user');

      // Create session with tokens
      const deviceInfo = {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };

      const sessionData = await sessionService.createSession(user._id, deviceInfo);

      logger.authAttempt(true, {
        userId: user._id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: 'register',
      });

      // Set httpOnly cookies for secure token storage
      res.cookie('accessToken', sessionData.accessToken, accessTokenCookieOptions());
      res.cookie('refreshToken', sessionData.refreshToken, refreshTokenCookieOptions());

      // Still return tokens in response body for backward compatibility during transition
      return res.status(201).json({
        message: 'Account created successfully. You are automatically logged in.',
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          isEmailVerified: user.isEmailVerified,
        },
      });
    }

    // Production: Send verification email
    const verificationToken = user.generateEmailVerificationToken();
    logger.info(`Generated verification token for ${email}`);
    await user.save();

    // Send verification email
    logger.info(`Attempting to send verification email to: ${email}`);
    const emailSent = await sendVerificationEmail(email, verificationToken, username);

    if (!emailSent) {
      logger.warn('Failed to send verification email');
      return res.status(201).json({
        message:
          'Account created successfully, but verification email could not be sent. Please contact support.',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
        },
      });
    }

    logger.info('Verification email sent successfully');
    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    logger.error('Registration error:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    // Use generic error message to prevent user enumeration
    const user = await User.findOne({ email });
    if (!user) {
      logger.authAttempt(false, {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        reason: 'user_not_found',
      });
      // Use generic error message to prevent user enumeration
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logger.authAttempt(false, {
        userId: user._id,
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        reason: 'invalid_password',
      });
      // Use generic error message to prevent user enumeration
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Block suspended or deactivated accounts from obtaining a new session.
    if (user.isActive === false) {
      logger.authAttempt(false, {
        userId: user._id,
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        reason: 'account_deactivated',
      });
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    if (user.isCurrentlySuspended()) {
      logger.authAttempt(false, {
        userId: user._id,
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        reason: 'account_suspended',
      });
      return res.status(403).json({
        message: user.suspensionReason
          ? `Your account has been suspended: ${user.suspensionReason}`
          : 'Your account has been suspended.',
      });
    }

    // Check if email is verified
    // Skip verification check for pre-seeded test users (they have isEmailVerified: true)
    if (!user.isEmailVerified) {
      logger.authAttempt(false, {
        userId: user._id,
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        reason: 'email_not_verified',
      });
      return res.status(401).json({
        message:
          'Please verify your email address before logging in. Check your inbox for a verification email.',
        needsVerification: true,
      });
    }

    // Create session with tokens
    const deviceInfo = {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    const sessionData = await sessionService.createSession(user._id, deviceInfo);

    logger.authAttempt(true, {
      userId: user._id,
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: 'login',
    });

    // Set httpOnly cookies for secure token storage
    res.cookie('accessToken', sessionData.accessToken, accessTokenCookieOptions());
    res.cookie('refreshToken', sessionData.refreshToken, refreshTokenCookieOptions());

    // Still return tokens in response body for backward compatibility during transition
    res.json({
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      expiresIn: sessionData.expiresIn,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
        isSuspended: user.isSuspended,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (process.env.NODE_ENV === 'development') {
      logger.debug('VERIFY EMAIL DEBUG:', {
        tokenLength: token ? token.length : 0,
        timestamp: Date.now(),
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification token',
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      message: 'Email verified successfully. You can now log in to your account.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying email', error: error.message });
  }
};

// Resend verification email
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationToken, user.username);

    if (!emailSent) {
      return res.status(500).json({
        message: 'Failed to send verification email. Please try again later.',
      });
    }

    res.json({
      message: 'Verification email sent successfully. Please check your inbox.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending verification email', error: error.message });
  }
};

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // In development mode, return the token directly for testing
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Development mode: Password reset token generated for ${email}`);
      logger.debug(
        `Reset URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
      );

      return res.json({
        message: 'Password reset link generated successfully (development mode)',
        resetToken: resetToken, // Only in development
        resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
      });
    }

    // Production: Send password reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.username);

    if (!emailSent) {
      return res.status(500).json({
        message: 'Failed to send password reset email. Please try again later.',
      });
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('Error requesting password reset:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error requesting password reset', error: error.message });
  }
};

// Verify password reset token
const verifyPasswordResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired password reset token',
      });
    }

    res.json({
      message: 'Password reset token is valid',
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying password reset token', error: error.message });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired password reset token',
      });
    }

    // Update password
    user.password = password;
    user.markModified('password'); // Explicitly mark password as modified
    user.clearPasswordResetToken();
    await user.save();

    // Revoke all existing sessions when password is changed
    await sessionService.revokeAllUserSessions(user._id, 'password_change');

    logger.securityEvent('PASSWORD_RESET', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Password reset successful', { userId: user._id });

    res.json({
      message:
        'Password has been reset successfully. All existing sessions have been revoked. You can now log in with your new password.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(SENSITIVE_FIELDS);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

// Refresh token endpoint
const refreshToken = async (req, res) => {
  try {
    // Support both cookie-based and body-based refresh token for backward compatibility
    const tokenFromCookie = req.cookies?.refreshToken;
    const tokenFromBody = req.body?.refreshToken;
    const token = tokenFromCookie || tokenFromBody;

    if (!token) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const deviceInfo = {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    const sessionData = await sessionService.refreshSession(token, deviceInfo);

    // Set new access token as httpOnly cookie
    res.cookie('accessToken', sessionData.accessToken, accessTokenCookieOptions());

    // Still return token in response body for backward compatibility
    res.json({
      accessToken: sessionData.accessToken,
      expiresIn: sessionData.expiresIn,
    });
  } catch (error) {
    logger.error('Token refresh error:', { error: error.message });
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

// Logout endpoint
const logout = async (req, res) => {
  try {
    const sessionId = req.sessionId; // From auth middleware

    if (sessionId) {
      await sessionService.revokeSession(sessionId, 'logout');

      logger.sessionEvent('logout', {
        userId: req.user._id,
        sessionId,
        ip: req.ip,
      });
    }

    // Clear httpOnly cookies
    res.clearCookie('accessToken', { path: '/', sameSite: cookieSameSite(), secure: isProd() });
    res.clearCookie('refreshToken', {
      path: '/api/auth',
      sameSite: cookieSameSite(),
      secure: isProd(),
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', { error: error.message });
    res.status(500).json({ message: 'Error during logout' });
  }
};

// Logout from all devices
const logoutAll = async (req, res) => {
  try {
    const userId = req.user._id;
    const revokedCount = await sessionService.revokeAllUserSessions(userId, 'logout_all');

    logger.sessionEvent('logout_all', {
      userId,
      revokedCount,
      ip: req.ip,
    });

    // Clear httpOnly cookies
    res.clearCookie('accessToken', { path: '/', sameSite: cookieSameSite(), secure: isProd() });
    res.clearCookie('refreshToken', {
      path: '/api/auth',
      sameSite: cookieSameSite(),
      secure: isProd(),
    });

    res.json({
      message: `Logged out from ${revokedCount} devices successfully`,
    });
  } catch (error) {
    logger.error('Logout all error:', { error: error.message });
    res.status(500).json({ message: 'Error during logout from all devices' });
  }
};

// Get active sessions
const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const sessions = await sessionService.getUserSessions(userId);

    res.json(sessions);
  } catch (error) {
    logger.error('Get sessions error:', { error: error.message });
    res.status(500).json({ message: 'Error fetching active sessions' });
  }
};

// Change password (revokes all sessions)
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      logger.securityEvent('INVALID_PASSWORD_CHANGE_ATTEMPT', {
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    user.markModified('password');
    await user.save();

    // Revoke all existing sessions
    await sessionService.revokeAllUserSessions(userId, 'password_change');

    logger.securityEvent('PASSWORD_CHANGED', {
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message:
        'Password changed successfully. All existing sessions have been revoked. Please log in again.',
    });
  } catch (error) {
    logger.error('Change password error:', { error: error.message });
    res.status(500).json({ message: 'Error changing password' });
  }
};

module.exports = {
  register,
  login,
  logout,
  logoutAll,
  refreshToken,
  changePassword,
  getActiveSessions,
  verifyEmail,
  resendVerificationEmail,
  getCurrentUser,
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
};
