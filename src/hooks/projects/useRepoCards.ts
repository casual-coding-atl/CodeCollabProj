import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { githubService } from '../../services/githubService';
import { queryKeys } from '../../config/queryClient';
import { REPO_CARD_FRESHNESS_MS, type RepoCardResponse } from '../../types/github';
import type { LinkedRepo } from '../../types';

/**
 * The GitHub details behind a project's Linked Repositories.
 *
 * `useLinkedRepos` reads what the project *stores* (repo id, owner, name);
 * this reads what GitHub *says* about them — stars, language, open issues, last
 * push. One query per repository, keyed by owner/name, so a repository linked to
 * two projects is fetched once.
 *
 * A *card* is fresh for the same ten minutes the server keeps one fresh for
 * (`REPO_CARD_FRESHNESS_MS`): asking sooner would only be served the same cached
 * document. A *failure* is not — "GitHub is rate limiting" and "the proxy could
 * not be reached" arrive as ordinary answers here, and holding one for ten
 * minutes would leave a card saying "temporarily unavailable" long after the
 * blip that caused it. Those go stale in half a minute, so the next render tries
 * again. Hence `staleTime` as a function of what the query actually holds.
 *
 * Nothing is retried on the spot: every one of these is a considered answer from
 * the proxy, not a lost packet.
 */

export type RepoCardQuery = UseQueryResult<RepoCardResponse, Error>;

/** How long a card that could not be shown is worth holding on to. */
export const REPO_CARD_FAILURE_STALE_MS = 30 * 1000;

const repoCardQuery = (owner: string, name: string) => ({
  queryKey: queryKeys.github.repoCard(owner, name),
  queryFn: (): Promise<RepoCardResponse> => githubService.repoCard(owner, name),
  staleTime: (query: { state: { data?: RepoCardResponse } }): number =>
    query.state.data?.state === 'ok' ? REPO_CARD_FRESHNESS_MS : REPO_CARD_FAILURE_STALE_MS,
  retry: 0,
  refetchOnWindowFocus: false,
});

/** One repository's card data. */
export const useRepoCard = (owner: string, name: string): RepoCardQuery =>
  useQuery(repoCardQuery(owner, name));

/** A project's repositories, in the order they are linked. */
export const useRepoCards = (repos: ReadonlyArray<LinkedRepo>): RepoCardQuery[] =>
  useQueries({ queries: repos.map((repo) => repoCardQuery(repo.owner, repo.name)) });

export default { useRepoCard, useRepoCards };
