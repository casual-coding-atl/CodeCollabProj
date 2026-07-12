import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';

const SENSITIVE = [
  'password',
  'refreshToken',
  'emailVerificationToken',
  'emailVerificationExpires',
  'passwordResetToken',
  'passwordResetExpires',
];

// GET /api/auth/me — current user (getCurrentUser). Returns the user object,
// sensitive fields stripped.
export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const user = await requireUser(request);
        const obj = user.toObject() as Record<string, unknown>;
        for (const k of SENSITIVE) delete obj[k];
        return json(obj);
      }),
    },
  },
});
