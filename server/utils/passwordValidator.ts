/**
 * Password validation utility
 * Provides consistent password validation across the application
 */

const { PASSWORD_REQUIREMENTS } = require('../config/constants');

/**
 * Password validation result
 */
interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result with isValid boolean and errors array
 */
const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] };
  }

  // Check minimum length
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters long`);
  }

  // Check for uppercase letter
  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (
    PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL &&
    !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
  ) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Express validator custom validator for password
 * @param value - Password value to validate
 * @returns true if valid, throws Error if invalid
 */
const passwordValidator = (value: string): boolean => {
  const validation = validatePassword(value);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  return true;
};

module.exports = {
  validatePassword,
  passwordValidator,
};

export { PasswordValidationResult };
