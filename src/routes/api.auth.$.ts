import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '../server/auth';
import { handler } from '../server/http';

/**
 * Every /api/auth/* endpoint, served by Better Auth (ADR 0002).
 *
 * This one splat route replaces the ~13 hand-written `api.auth.*.ts` files:
 * sign-in/sign-up/sign-out, session listing and revocation, password change and
 * reset, passkey registration and assertion, and the OAuth callbacks — Better
 * Auth's own router dispatches on the path.
 */
const delegate = handler(async ({ request }) => {
  const auth = await getAuth();
  return auth.handler(request);
});

export const Route = createFileRoute('/api/auth/$')({
  server: { handlers: { GET: delegate, POST: delegate } },
});
