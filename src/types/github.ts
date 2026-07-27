/**
 * The wire contract between the GitHub proxy (`GET /api/github/repos/$owner/$name`)
 * and the repo cards that render it — the one shape both sides agree on.
 *
 * It is deliberately a *discriminated union of states*, not "data or an error":
 * a repository that was deleted, turned private or is momentarily beyond a rate
 * limit is a normal thing for a card to show, not a failure of the page. The
 * project page must never break because GitHub is having a bad day (PRD #88).
 */

/** The card fields of a repository, as GitHub described it. */
export interface RepoCardData {
  repoId: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  openIssues: number;
  pushedAt: string | null;
  archived: boolean;
  htmlUrl: string;
}

/**
 * Why a repository cannot be described right now, and whether that is permanent.
 *
 * There is deliberately no `private`. On this public endpoint, "private" and "no
 * such repository" are the same answer, word for word — telling them apart would
 * let anyone walk owner/name pairs and learn which private repositories exist,
 * using the server's own GitHub token to do it. `blocked` stays distinct because
 * GitHub says so publicly (a 451), so it reveals nothing.
 */
export type RepoCardUnavailableReason = 'not-found' | 'blocked';
export type RepoCardTemporaryReason = 'rate-limited' | 'unauthorized' | 'unavailable';

interface RepoCardIdentity {
  /** Echoed back in every state, so a card always has a title to show. */
  owner: string;
  name: string;
}

export type RepoCardResponse =
  | (RepoCardIdentity & {
      state: 'ok';
      repo: RepoCardData;
      /** When the server last heard this from GitHub. */
      fetchedAt: string;
      /** True when GitHub could not be reached and the cache answered instead. */
      stale: boolean;
    })
  | (RepoCardIdentity & {
      state: 'unavailable';
      reason: RepoCardUnavailableReason;
      message: string;
    })
  | (RepoCardIdentity & {
      state: 'temporarily-unavailable';
      reason: RepoCardTemporaryReason;
      message: string;
    });

/**
 * How long a repo card stays fresh: ten minutes (PRD #88), server-side in the
 * `github_cache` collection and client-side as the query's `staleTime`. Shared
 * from here so the two cannot drift apart — a client that refetched sooner would
 * only ever be served the same cached document.
 */
export const REPO_CARD_FRESHNESS_MS = 10 * 60 * 1000;
