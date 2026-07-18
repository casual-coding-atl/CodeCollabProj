import { createFileRoute } from '@tanstack/react-router';
import bcrypt from 'bcryptjs';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

// POST /api/auth/change-password
export const Route = createFileRoute('/api/auth/change-password')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const authed = await requireUser(request);
        const body = (await request.json().catch(() => ({}))) as {
          currentPassword?: string;
          newPassword?: string;
        };
        if (!body.currentPassword || !body.newPassword)
          return error(400, 'Current and new password are required');
        if (body.newPassword.length < 8)
          return error(400, 'New password must be at least 8 characters');

        await connectDB();
        const user = await User.findById(authed._id).select('+password').exec();
        const hash = user?.get('password') as string | undefined;
        if (!user || typeof hash !== 'string') return error(404, 'User not found');
        const ok = await bcrypt.compare(body.currentPassword, hash);
        if (!ok) return error(400, 'Current password is incorrect');

        user.set('password', await bcrypt.hash(body.newPassword, 12));
        await user.save();
        return json({ message: 'Password changed successfully' });
      }),
    },
  },
});
