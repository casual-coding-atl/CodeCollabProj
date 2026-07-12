import { createFileRoute } from '@tanstack/react-router';
import bcrypt from 'bcryptjs';
import { handler, json, error, issueSession, setAuthCookies, isCurrentlySuspended } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

// POST /api/auth/login — replicates authController.login response shape.
export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        await connectDB();
        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          password?: string;
        };
        if (!body.email || !body.password) return error(400, 'Email and password are required');

        const user = await User.findOne({ email: String(body.email).toLowerCase().trim() })
          .select('+password')
          .exec();
        const hash = user?.get('password') as string | undefined;
        if (!user || typeof hash !== 'string') return error(401, 'Invalid email or password');

        const ok = await bcrypt.compare(body.password, hash);
        if (!ok) return error(401, 'Invalid email or password');
        if (user.isActive === false) return error(403, 'Your account has been deactivated');
        if (isCurrentlySuspended(user)) return error(403, 'Your account is suspended');

        const { accessToken, refreshToken } = await issueSession(String(user._id));
        return json(
          {
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60,
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              role: user.role,
              permissions: user.permissions,
              isActive: user.isActive,
              isSuspended: user.isSuspended,
            },
          },
          200,
          setAuthCookies(accessToken, refreshToken),
        );
      }),
    },
  },
});
