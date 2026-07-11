import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

/**
 * Email sending result
 */
interface EmailResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  pending?: string[];
}

/**
 * Create nodemailer transporter
 */
const createTransporter = (): Transporter<SMTPTransport.SentMessageInfo> => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    // TLS certificate validation is left at its secure default (rejectUnauthorized:
    // true). Gmail presents a valid certificate; disabling validation would allow
    // man-in-the-middle interception of outgoing mail.
    requireTLS: true,
  });
};

/**
 * Send verification email
 */
const sendVerificationEmail = async (
  email: string,
  token: string,
  username: string
): Promise<boolean> => {
  // Skip email sending in E2E/test environments
  if (process.env.SKIP_EMAIL_VERIFICATION === 'true' || process.env.NODE_ENV === 'e2e') {
    console.log(`📧 [SKIP] Email sending disabled in ${process.env.NODE_ENV} environment`);
    console.log(`📧 [SKIP] Would have sent verification email to: ${email}`);
    return true;
  }

  try {
    console.log(`📧 Starting email send process for: ${email}`);
    console.log(`🔧 Email config check:`);
    console.log(`   - EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Missing'}`);
    console.log(`   - EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing'}`);
    console.log(`   - FRONTEND_URL: ${process.env.FRONTEND_URL}`);

    const transporter = createTransporter();

    // Test the connection first
    console.log(`🔍 Testing SMTP connection...`);
    await transporter.verify();
    console.log(`✅ SMTP connection verified`);

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"CodeCollabProj" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email address - CodeCollabProj',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to CodeCollabProj!</h2>
          <p>Hi ${username},</p>
          <p>Thank you for registering with CodeCollabProj. To complete your registration, please verify your email address by clicking the button below:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>

          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>

          <p>This link will expire in 24 hours.</p>

          <p>If you didn't create an account with CodeCollabProj, you can safely ignore this email.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from CodeCollabProj. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    console.log(`📧 Sending verification email to: ${email}`);
    console.log(`🔗 Verification URL: ${verificationUrl}`);

    const result: SentMessageInfo = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully');
    console.log('📧 Email result:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      pending: result.pending,
    } as EmailResult);

    return true;
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('❌ Error sending verification email:');
    console.error('   Error type:', err.name || 'Unknown');
    console.error('   Error message:', err.message);
    console.error('   Error code:', err.code);
    console.error('   Full error:', error);
    return false;
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (
  email: string,
  token: string,
  username: string
): Promise<boolean> => {
  // Skip email sending in E2E/test environments
  if (process.env.SKIP_EMAIL_VERIFICATION === 'true' || process.env.NODE_ENV === 'e2e') {
    console.log(`📧 [SKIP] Email sending disabled in ${process.env.NODE_ENV} environment`);
    console.log(`📧 [SKIP] Would have sent password reset email to: ${email}`);
    return true;
  }

  try {
    const transporter = createTransporter();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset your password - CodeCollabProj',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hi ${username},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>

          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>

          <p>This link will expire in 1 hour.</p>

          <p>If you didn't request a password reset, you can safely ignore this email.</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from CodeCollabProj. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};

export { sendVerificationEmail, sendPasswordResetEmail };
