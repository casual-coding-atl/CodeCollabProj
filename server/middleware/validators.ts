import { body, ValidationChain } from 'express-validator';

const { passwordValidator } = require('../utils/passwordValidator');
const { VALIDATION_LIMITS } = require('../config/constants');

/**
 * Registration request validators
 */
const registerValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.EMAIL_MAX_LENGTH })
    .withMessage(`Email must not exceed ${VALIDATION_LIMITS.EMAIL_MAX_LENGTH} characters`),
  body('password')
    .custom(passwordValidator)
    .withMessage(
      'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
    ),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({
      min: VALIDATION_LIMITS.USERNAME_MIN_LENGTH,
      max: VALIDATION_LIMITS.USERNAME_MAX_LENGTH,
    })
    .withMessage(
      `Username must be between ${VALIDATION_LIMITS.USERNAME_MIN_LENGTH} and ${VALIDATION_LIMITS.USERNAME_MAX_LENGTH} characters`
    )
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
];

/**
 * Login request validators
 */
const loginValidator: ValidationChain[] = [
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Profile update request validators
 */
const profileUpdateValidator: ValidationChain[] = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
  body('skills.*').optional().trim().notEmpty().withMessage('Skill cannot be empty'),
  body('experience')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid experience level'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must not exceed 100 characters'),
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Timezone must not exceed 50 characters'),
  body('availability')
    .optional()
    .isIn(['full-time', 'part-time', 'weekends', 'evenings', 'flexible'])
    .withMessage('Invalid availability'),
  body('portfolioLinks').optional().isArray().withMessage('Portfolio links must be an array'),
  body('portfolioLinks.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Portfolio link name is required'),
  body('portfolioLinks.*.url')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('Portfolio link must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('Portfolio link must be a valid URL'),
  body('socialLinks.github')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('GitHub URL must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('GitHub URL must be a valid URL'),
  body('socialLinks.linkedin')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('LinkedIn URL must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('LinkedIn URL must be a valid URL'),
  body('socialLinks.twitter')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('Twitter URL must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('Twitter URL must be a valid URL'),
  body('socialLinks.website')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('Website URL must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('Website URL must be a valid URL'),
  body('isProfilePublic')
    .optional()
    .isBoolean()
    .withMessage('Profile visibility must be a boolean'),
];

/**
 * Project creation/update request validators
 */
const projectValidator: ValidationChain[] = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('technologies')
    .optional()
    .custom((value: string | string[] | undefined) => {
      // Handle both array and JSON string formats
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed);
        } catch {
          throw new Error('Technologies must be a valid JSON array');
        }
      }
      return Array.isArray(value);
    })
    .withMessage('Technologies must be an array'),
  body('technologies.*').optional().trim().notEmpty().withMessage('Technology cannot be empty'),
  body('githubUrl')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('GitHub URL must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('GitHub URL must be a valid URL'),
  body('liveUrl')
    .optional()
    .trim()
    .custom((value: string | undefined) => {
      if (value && value.trim() !== '') {
        if (!value.match(/^https?:\/\/.+/)) {
          throw new Error('Live URL must be a valid URL');
        }
      }
      return true;
    })
    .withMessage('Live URL must be a valid URL'),
  body('requiredSkills').optional().isArray().withMessage('Required skills must be an array'),
  body('requiredSkills.*').optional().trim().notEmpty().withMessage('Skill cannot be empty'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().trim().notEmpty().withMessage('Tag cannot be empty'),
  body('resources').optional().isArray().withMessage('Resources must be an array'),
  body('resources.*.name').optional().trim().notEmpty().withMessage('Resource name is required'),
  body('resources.*.url').optional().trim().isURL().withMessage('Resource URL must be valid'),
  body('status')
    .optional()
    .isIn(['ideation', 'in_progress', 'completed'])
    .withMessage('Invalid project status'),
];

/**
 * Project update validator — same rules as create, but every field is optional so
 * partial updates (PUT) aren't rejected for omitting title/description.
 */
const projectUpdateValidator: ValidationChain[] = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  ...projectValidator.slice(2),
];

/**
 * Message request validators
 */
const messageValidator: ValidationChain[] = [
  body('recipientId')
    .notEmpty()
    .withMessage('Recipient ID is required')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Message subject is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Subject must be between 1 and 100 characters'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
];

/**
 * Comment request validators
 */
const commentValidator: ValidationChain[] = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
];

module.exports = {
  registerValidator,
  loginValidator,
  profileUpdateValidator,
  projectValidator,
  projectUpdateValidator,
  commentValidator,
  messageValidator,
};

export {
  registerValidator,
  loginValidator,
  profileUpdateValidator,
  projectValidator,
  projectUpdateValidator,
  commentValidator,
  messageValidator,
};
