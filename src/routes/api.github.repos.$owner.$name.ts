import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, getAuthUser } from '../server/http';
import { parseRepoRef, resolveGitHubToken } from '../server/github';
import { fetchRepoCard, repoCardPayload } from '../server/github-cache';

/**
 * /api/github/repos/$owner/$name
 *   GET → the card fields of a public repository (PRD #88)
 *
 * **Public on purpose.** A project page is readable by anyone, so its repo
 * cards must be too — hence `getAuthUser` rather than `requireUser`. A signed-in
 * member's own GitHub token is used when they have one (their 5,000/hour rather
 * than the server's shared 60), and a visitor without a session simply reads
 * anonymously. Either way the token never leaves the server.
 *
 * The answer is always the same typed union (`src/types/github.ts`): `ok`,
 * `unavailable` (deleted or private — a 404) or `temporarily-unavailable` (rate
 * limit or outage — a 503/502). Callers render a state, never an exception,
 * which is what keeps a bad day at GitHub from breaking the project page.
 *
 * Reads go through the cache in ../server/github-cache, so three cards on a
 * page cost at most three GitHub requests per ten minutes across all visitors.
 */

export const Route = createFileRoute('/api/github/repos/$owner/$name')({
  server: {
    handlers: {
      GET: handler(async ({ request, params }) => {
        // The same parser the link endpoint uses, so a path that could never be
        // a GitHub repository is refused here rather than spent on a request.
        const parsed = parseRepoRef({ owner: params.owner, name: params.name });
        if (!parsed.ok) return error(parsed.status, parsed.message);

        const user = await getAuthUser(request);
        const token = await resolveGitHubToken(user?._id);

        const { result, source, fetchedAt } = await fetchRepoCard(parsed.ref, { token });
        const { status, body } = repoCardPayload(parsed.ref, result, { source, fetchedAt });

        return json(body, status, {
          // Public data, and already cached server-side; letting a browser hold
          // it for a minute costs nothing and spares the round trip.
          'cache-control': status === 200 ? 'public, max-age=60' : 'no-store',
        });
      }),
    },
  },
});
