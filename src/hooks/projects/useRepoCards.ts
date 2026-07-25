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
 * `staleTime` is the same ten minutes the server keeps a card fresh for
 * (`REPO_CARD_FRESHNESS_MS`): refetching sooner would only be served the same
 * cached document. Failures are not retried because the proxy never fails in the
 * interesting sense — "this repository is gone" and "GitHub is rate limiting"
 * both arrive as ordinary answers to render.
 */

export type RepoCardQuery = UseQueryResult<RepoCardResponse, Error>;

const repoCardQuery = (owner: string, name: string) => ({
  queryKey: queryKeys.github.repoCard(owner, name),
  queryFn: (): Promise<RepoCardResponse> => githubService.repoCard(owner, name),
  staleTime: REPO_CARD_FRESHNESS_MS,
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
