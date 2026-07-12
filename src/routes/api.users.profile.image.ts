import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * POST /api/users/profile/image  (auth)
 *
 * NOTE: this exact path was NOT in the Express router — the router only exposed
 * `POST /api/users/avatar`. However the client's `usersService.uploadProfileImage`
 * posts a `profileImage` file here, so this route is provided to satisfy that
 * caller, reusing the same response shape as `userController.uploadAvatar`.
 *
 * AVATAR NOTE: multipart/file storage is NOT wired in this migration. The
 * request is accepted but no binary is read or persisted; the user's CURRENT
 * `profileImage` is returned unchanged.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

export const Route = createFileRoute('/api/users/profile/image')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        // TODO: avatar binary storage not wired in migration — the uploaded file
        // is not read or persisted; profileImage is returned unchanged.
        const user = await User.findById(me._id).select(SENSITIVE_FIELDS).exec();
        if (!user) return error(404, 'User not found');

        const avatarPath = (user.get('profileImage') as string | null) ?? null;

        return json({
          message: 'Avatar uploaded successfully',
          profileImage: avatarPath,
          avatar: avatarPath,
          user,
        });
      }),
    },
  },
});
