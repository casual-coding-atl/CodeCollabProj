import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * GET /api/users/profile/me  →  userController.getMyProfile  (auth)
 *
 * Returns the current user's OWN profile (includes `email`, since only
 * password/token fields are stripped via `.select(SENSITIVE_FIELDS)`).
 * Response: `User`.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

export const Route = createFileRoute('/api/users/profile/me')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        const user = await User.findById(me._id).select(SENSITIVE_FIELDS).exec();

        return json(user);
      }),
    },
  },
});
