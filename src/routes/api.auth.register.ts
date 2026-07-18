import { createFileRoute } from '@tanstack/react-router';
import bcrypt from 'bcryptjs';
import { handler, json, error, issueSession, setAuthCookies } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

// POST /api/auth/register — create account (dev auto-login branch of
// authController.register). Replicates the 201 response shape.
export const Route = createFileRoute('/api/auth/register')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        await connectDB();
        const body = (await request.json().catch(() => ({}))) as {
          username?: string;
          email?: string;
          password?: string;
        };
        const email = String(body.email ?? '').toLowerCase().trim();
        const username = String(body.username ?? '').trim();
        if (!email || !username || !body.password)
          return error(400, 'Username, email and password are required');
        if (body.password.length < 8) return error(400, 'Password must be at least 8 characters');

        const existing = await User.findOne({ $or: [{ email }, { username }] }).exec();
        if (existing) return error(409, 'An account with that email or username already exists');

        const hash = await bcrypt.hash(body.password, 12);
        const user = await User.create({
          username,
          email,
          password: hash,
          role: 'user',
          permissions: ['project:create'],
          isActive: true,
          isSuspended: false,
          // Email verification is disabled for now — new accounts are created
          // verified so nothing gates on it. Re-enable by setting this to false
          // (and wiring an email sender for the verify-email flow).
          isEmailVerified: true,
        });

        const { accessToken, refreshToken } = await issueSession(String(user._id));
        return json(
          {
            message: 'Account created successfully. You are automatically logged in.',
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60,
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              isEmailVerified: true,
            },
          },
          201,
          setAuthCookies(accessToken, refreshToken),
        );
      }),
    },
  },
});
