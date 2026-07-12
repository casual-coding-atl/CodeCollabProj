import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * GET /api/users  →  userController.getAllUsers  (auth)
 *
 * Returns every PUBLIC profile, sorted newest-first, with sensitive fields and
 * `email` stripped via `.select()`. Raw mongoose docs are returned so the JSON
 * shape (incl. `_id`) matches Express exactly. Response: `User[]`.
 */

// NEVER return these — mirrors SENSITIVE_FIELDS in userController.js.
const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        await requireUser(request);
        await connectDB();

        const users = await User.find({ isProfilePublic: true })
          .select(`${SENSITIVE_FIELDS} -email`)
          .sort({ createdAt: -1 })
          .exec();

        return json(users);
      }),
    },
  },
});
