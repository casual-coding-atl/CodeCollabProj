#!/usr/bin/env node

/**
 * Generate secure secrets for production deployment
 * Run this script to generate strong JWT secrets and database passwords
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generateSecurePassword(length = 32) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    // Use a CSPRNG (crypto.randomInt) rather than Math.random for secret material.
    password += charset.charAt(crypto.randomInt(charset.length));
  }
  return password;
}

function generateEnvFile() {
  const jwtSecret = generateSecureSecret(64);
  const jwtRefreshSecret = generateSecureSecret(64);
  const dbPassword = generateSecurePassword(24);

  const envContent = `# ========================================
# CodeCollab Server Environment Configuration
# ========================================
# SECURITY WARNING: 
# - Never commit this file to version control
# - Keep these secrets secure and backed up safely
# - Generated on: ${new Date().toISOString()}

# Server Configuration
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-domain.com

# Database Configuration
# SECURITY: Strong auto-generated password
MONGODB_URI=mongodb://admin:${dbPassword}@mongodb:27017/codecollabproj?authSource=admin

# JWT Configuration
# SECURITY: Strong auto-generated secrets (128 characters each)
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}

# Email Configuration (Update with your email service)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password_here

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
AUTH_RATE_LIMIT_MAX=5

# Session Configuration
MAX_CONCURRENT_SESSIONS=3
SESSION_TIMEOUT_MINUTES=30

# File Upload Configuration
UPLOAD_MAX_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# Logging Configuration
LOG_LEVEL=info
ENABLE_SECURITY_LOGGING=true
`;

  return { envContent, secrets: { jwtSecret, jwtRefreshSecret, dbPassword } };
}

function main() {
  console.log('🔐 Generating secure secrets for production...\n');

  try {
    const { envContent, secrets } = generateEnvFile();

    // Write to .env file
    const envPath = path.join(__dirname, '../.env.production');
    fs.writeFileSync(envPath, envContent);

    console.log('✅ Production environment file generated: .env.production');
    console.log('\n🔒 Generated Secrets:');
    console.log(`   JWT Secret: ${secrets.jwtSecret.substring(0, 20)}... (128 characters)`);
    console.log(
      `   JWT Refresh Secret: ${secrets.jwtRefreshSecret.substring(0, 20)}... (128 characters)`
    );
    console.log(`   Database Password: ${secrets.dbPassword.substring(0, 8)}... (24 characters)`);

    console.log('\n📋 Next Steps:');
    console.log('1. Review and update the .env.production file with your specific settings');
    console.log('2. Update EMAIL_USER and EMAIL_PASSWORD with your email service credentials');
    console.log('3. Update FRONTEND_URL with your actual domain');
    console.log('4. Copy .env.production to .env for local use or deploy to your server');
    console.log('5. Ensure .env files are added to .gitignore');
    console.log('6. Back up these secrets securely');

    console.log('\n⚠️  Security Reminders:');
    console.log('- Never commit .env files to version control');
    console.log('- Store secrets in secure environment variable systems in production');
    console.log('- Rotate secrets periodically');
    console.log('- Use different secrets for different environments');
  } catch (error) {
    console.error('❌ Error generating secrets:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateSecureSecret, generateSecurePassword };
