const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const envValidator = require('./utils/envValidator');
const logger = require('./utils/logger');
const scheduledTasks = require('./utils/scheduledTasks');
const { initGridFS } = require('./utils/gridfs');
const { RATE_LIMITS } = require('./config/constants');
const {
  trackFailedAuth,
  trackSuspiciousActivity,
  trackAccessViolations,
} = require('./middleware/securityMonitoring');

// Load environment variables
dotenv.config();
// Force redeploy - updated auth verification logic

// Validate environment variables before starting server
try {
  envValidator.validateEnvironment();
  logger.info('Server starting with secure configuration', envValidator.getSanitizedEnvInfo());
} catch (error) {
  logger.error('Server startup failed:', { error: error.message });
  process.exit(1);
}

// Create Express app
const app = express();

// Configure upload path for Railway volumes
const path = require('path');
const fs = require('fs');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
global.uploadPath = uploadPath; // Make uploadPath globally accessible for multer in routes

// Ensure upload directory exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true, mode: 0o755 });
  console.log(`✅ Created upload directory: ${uploadPath}`);
} else {
  console.log(`✅ Upload directory exists: ${uploadPath}`);
  try {
    const files = fs.readdirSync(uploadPath);
    console.log(`📁 Current files in uploads: ${files.length}`);
  } catch (err) {
    console.error('❌ Error reading upload directory:', err.message);
  }
}

// Make uploadPath available globally for controllers
global.uploadPath = uploadPath;
logger.info('Upload path configured', {
  uploadPath,
  isProduction: process.env.NODE_ENV === 'production',
});

// Trust proxy for Railway/production deployments
// This allows express-rate-limit to correctly identify users behind proxies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware - applied first
// Generate nonce for CSP (in production, use proper nonce generation)
const generateNonce = () => {
  return Buffer.from(crypto.randomBytes(16)).toString('base64');
};

app.use((req, res, next) => {
  // Generate nonce for this request
  res.locals.nonce = generateNonce();
  next();
});

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// CORS configuration - restrictive
const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL]
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// MongoDB injection prevention
app.use(mongoSanitize());

// Security monitoring middleware
app.use(trackSuspiciousActivity);
app.use(trackFailedAuth);
app.use(trackAccessViolations);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware (for httpOnly cookie auth)
app.use(cookieParser());

// Serve static files from uploads directory with security
app.use(
  '/uploads',
  (req, res, next) => {
    // Security headers for uploads
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year

    // Allow cross-origin access for avatar images (production and development)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    next();
  },
  express.static(uploadPath)
);

// Rate limiting - general (with admin exemption)
const generalLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL_WINDOW_MS,
  max: RATE_LIMITS.GENERAL_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(RATE_LIMITS.GENERAL_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin routes
  skip: (req) => {
    // Skip for admin routes - they have their own protection
    return req.path.startsWith('/api/admin');
  },
  handler: (req, res) => {
    logger.rateLimitHit({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      limit: 'general',
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(RATE_LIMITS.GENERAL_WINDOW_MS / 1000),
    });
  },
});

// Admin-specific rate limiting (more permissive)
const adminLimiter = rateLimit({
  windowMs: RATE_LIMITS.ADMIN_WINDOW_MS,
  max: RATE_LIMITS.ADMIN_MAX_REQUESTS,
  message: {
    error: 'Too many admin requests, please slow down.',
    retryAfter: 300, // 5 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.rateLimitHit({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      limit: 'admin',
    });
    res.status(429).json({
      error: 'Too many admin requests, please slow down.',
      retryAfter: 300,
    });
  },
});

// Only apply rate limiting in production
if (process.env.NODE_ENV === 'production') {
  app.use(generalLimiter);
}

// Auth-specific rate limiting
const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH_WINDOW_MS,
  max: RATE_LIMITS.AUTH_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: Math.ceil(RATE_LIMITS.AUTH_WINDOW_MS / 1000),
  },
  handler: (req, res) => {
    logger.rateLimitHit({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      limit: 'auth',
      severity: 'high',
    });
    res.status(429).json({
      error: 'Too many authentication attempts from this IP, please try again later.',
      retryAfter: 900,
    });
  },
});

// Password reset rate limiting (stricter)
const passwordResetLimiter = rateLimit({
  windowMs: RATE_LIMITS.PASSWORD_RESET_WINDOW_MS,
  max: RATE_LIMITS.PASSWORD_RESET_MAX_ATTEMPTS,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many password reset requests from this IP, please try again later.',
    retryAfter: Math.ceil(RATE_LIMITS.PASSWORD_RESET_WINDOW_MS / 1000),
  },
  handler: (req, res) => {
    logger.rateLimitHit({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      limit: 'password_reset',
      severity: 'high',
    });
    res.status(429).json({
      error: 'Too many password reset requests from this IP, please try again later.',
      retryAfter: Math.ceil(RATE_LIMITS.PASSWORD_RESET_WINDOW_MS / 1000),
    });
  },
});

// Apply auth rate limiting to auth routes (production only)
if (process.env.NODE_ENV === 'production') {
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/refresh-token', authLimiter);
  app.use('/api/auth/request-password-reset', passwordResetLimiter);
  app.use('/api/auth/reset-password', passwordResetLimiter);
}

// MongoDB Connection
const MONGODB_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/codecollabproj';

// Only try to connect if we're not in test mode
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGODB_URI, {
      // Add MongoDB connection optimizations
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      logger.info('Connected to MongoDB');
      // Initialize GridFS for avatar storage
      initGridFS(mongoose.connection);
    })
    .catch((error) => {
      logger.error('MongoDB connection error:', { error: error.message });
      logger.warn('Server will continue without database connection');
      // Don't exit the process, let it continue without DB
    });
} else {
  logger.info('Test mode - skipping MongoDB connection');
}

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const commentRoutes = require('./routes/comments');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/comments', commentRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to CodeCollabProj API' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Import error handling middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 404 handler
app.use('*', notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
    securityFeatures: ['helmet', 'cors', 'rate-limiting', 'mongo-sanitize', 'session-management'],
  });

  // Start scheduled security tasks
  scheduledTasks.start();
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  // Stop scheduled tasks
  scheduledTasks.stop();

  server.close(() => {
    logger.info('Server closed');
    mongoose.connection
      .close(false)
      .then(() => {
        logger.info('MongoDB connection closed');
        logger.info('Server shutdown completed', { signal });
        process.exit(0);
      })
      .catch((err) => {
        logger.error('Error closing MongoDB connection:', { error: err.message });
        process.exit(1);
      });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    promise: promise.toString(),
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});
