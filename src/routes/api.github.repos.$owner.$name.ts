import { createFileRoute } from '@tanstack/react-router';
import { handler, json, getAuthUser } from '../server/http';
import { parseRepoRef, resolveGitHubTokens, type RepoRef } from '../server/github';
import { fetchRepoCard, repoCardPayload, unavailablePayload } from '../server/github-cache';
import { findLinkedRepo } from '../server/repo-linking';

/**
 * /api/github/repos/$owner/$name
 *   GET → the card fields of a repository this app already links (PRD #88)
 *
 * **Public, but not open.** A project page is readable by anyone, so its repo
 * cards must be too — hence `getAuthUser` rather than `requireUser`. What keeps
 * that from being a free GitHub proxy for the internet is the gate below: the
 * repository must be a Linked Repository on some project. Without it, anyone
 * could spend this server's shared `GITHUB_TOKEN` budget on any repository they
 * liked, and mint a day-long cache document per owner/name pair they tried.
 *
 * A signed-in member's own GitHub token is used when they have one (their
 * 5,000/hour rather than the server's shared 60), falling through the tiers in
 * ../server/github when a token turns out to be revoked or spent. Tokens never
 * leave the server.
 *
 * The answer is always the same typed union (`src/types/github.ts`): `ok`,
 * `unavailable` or `temporarily-unavailable`. Callers render a state, never an
 * exception, which is what keeps a bad day at GitHub from breaking the project
 * page. Every refusal — an impossible name, a repository nothing links, one that
 * was deleted, one that is private — is the *same* unavailable answer, so this
 * endpoint cannot be used to find out what exists.
 *
 * Reads go through the cache in ../server/github-cache, so three cards on a page
 * cost at most three GitHub requests per ten minutes across all visitors.
 */

/** Enough of what was asked for to echo back, without echoing an essay. */
const clip = (value: string) => value.slice(0, 100);

export const Route = createFileRoute('/api/github/repos/$owner/$name')({
  server: {
    handlers: {
      GET: handler(async ({ request, params }) => {
        const asked: RepoRef = { owner: clip(params.owner), name: clip(params.name) };
        const refuse = () => {
          const { status, body } = unavailablePayload(asked);
          return json(body, status, { 'cache-control': 'no-store' });
        };

        // The same parser the link endpoint uses, so a path that could never be
        // a GitHub repository is refused before anything is looked up.
        const parsed = parseRepoRef({ owner: params.owner, name: params.name });
        if (!parsed.ok) return refuse();

        // The gate: only repositories some project actually links.
        const linked = await findLinkedRepo(parsed.ref);
        if (!linked) return refuse();

        const user = await getAuthUser(request);
        // Tiers, not one token: a member whose GitHub token has been revoked or
        // spent must still get their card, served by the server token or
        // anonymously (see tokenTiers in ../server/github).
        const tokens = await resolveGitHubTokens(user?._id);

        const { result, source, fetchedAt } = await fetchRepoCard(parsed.ref, { tokens });
        // The linked numeric id is the identity: a slug that now points at some
        // other repository is not this one (see repoCardPayload).
        const { status, body } = repoCardPayload(
          parsed.ref,
          result,
          { source, fetchedAt },
          { repoId: Number(linked.repoId) },
        );

        return json(body, status, {
          // Public data, and already cached server-side; letting a browser hold
          // it for a minute costs nothing and spares the round trip.
          'cache-control': status === 200 ? 'public, max-age=60' : 'no-store',
          // Where this answer came from, for anyone watching the cache work.
          'x-ccp-cache': source,
        });
      }),
    },
  },
});
