import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { linkAndVerify } from '../server/meetup-prototype';

/**
 * PROTOTYPE(meetup-gate) — throwaway. The whole simulated OAuth dance in one
 * POST: "sign in" as the chosen fake identity, check group membership, grant.
 */
export const Route = createFileRoute('/api/prototype/meetup/link')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const user = await requireUser(request);
        const body = (await request.json().catch(() => ({}))) as { meetupId?: unknown };
        const result = linkAndVerify(
          String(user._id),
          typeof body.meetupId === 'string' ? body.meetupId : ''
        );
        return json(result, result.ok ? 200 : 403);
      }),
    },
  },
});
