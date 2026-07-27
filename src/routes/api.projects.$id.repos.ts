import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { linkRepo, mongoRepoLinkDeps } from '../server/repo-linking';

/**
 * /api/projects/$id/repos
 *   POST → link a public GitHub repository to this project (owner only)
 *
 * Body: `{ url }` — a github.com link in any common form — or `{ owner, name }`.
 *
 * An adapter, on purpose: authenticate, hand the work to ../server/repo-linking
 * (which owns every rule and is tested there), turn its answer into JSON. The
 * repository is validated against GitHub — it must exist and be public — before
 * anything is saved, and what gets stored is GitHub's numeric id plus the
 * owner/name from that response.
 */
export const Route = createFileRoute('/api/projects/$id/repos')({
  server: {
    handlers: {
      POST: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const body = await request.json().catch(() => ({}));
        const answer = await linkRepo(mongoRepoLinkDeps, {
          projectId: params.id,
          userId: String(user._id),
          body,
        });

        return json(answer.body, answer.status);
      }),
    },
  },
});
