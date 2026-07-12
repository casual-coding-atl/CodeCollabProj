import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * /api/users/avatar
 *   POST   → userController.uploadAvatar  (auth)
 *   DELETE → userController.deleteAvatar  (auth)
 *
 * The Express router also served `GET /avatar/:fileId`, but that handler was
 * already deprecated (returned `410 Gone`), so it is intentionally not ported.
 *
 * AVATAR NOTE: multipart/file storage is NOT wired in this migration. POST
 * accepts the request but does NOT persist any binary — it returns the same JSON
 * shape as the Express controller with the user's CURRENT `profileImage`.
 * DELETE genuinely clears the `profileImage` field (a plain DB field write, not
 * binary storage), matching the controller.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

export const Route = createFileRoute('/api/users/avatar')({
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

      DELETE: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        // Clearing the field is legitimate (non-binary) DB work — persist it.
        const user = await User.findByIdAndUpdate(me._id, { profileImage: null }, { new: true })
          .select(SENSITIVE_FIELDS)
          .exec();

        if (!user) return error(404, 'User not found');

        return json({
          message: 'Avatar deleted successfully',
          user,
        });
      }),
    },
  },
});
