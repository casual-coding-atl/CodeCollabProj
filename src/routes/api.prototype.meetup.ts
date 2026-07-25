import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { FAKE_MEETUP_ACCOUNTS, grantFor, resetGrant } from '../server/meetup-prototype';

/**
 * PROTOTYPE(meetup-gate) — throwaway. See src/server/meetup-prototype.ts.
 * GET    → verification status for the signed-in member + the fake identities.
 * DELETE → drop this member's prototype grant (replay the flow).
 */
export const Route = createFileRoute('/api/prototype/meetup')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const user = await requireUser(request);
        const permissions = (user.get('permissions') as string[] | undefined) ?? [];
        const grant = grantFor(String(user._id));
        return json({
          canCreate: permissions.includes('project:create') || grant !== null,
          grandfathered: permissions.includes('project:create'),
          grant,
          accounts: FAKE_MEETUP_ACCOUNTS,
        });
      }),
      DELETE: handler(async ({ request }) => {
        const user = await requireUser(request);
        resetGrant(String(user._id));
        return json({ ok: true });
      }),
    },
  },
});
