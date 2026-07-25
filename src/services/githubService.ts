import axios from 'axios';
import api from '../utils/api';
import type { RepoCardResponse } from '../types/github';

/**
 * GitHub, as the browser is allowed to see it: only ever through this app's own
 * proxy (`/api/github/*`), never api.github.com directly. The server holds the
 * tokens, the cache and the rate limit; the browser just asks for a card.
 *
 * The proxy answers a *state* — `ok`, `unavailable`, `temporarily-unavailable` —
 * and uses an honest HTTP status for each. Axios turns anything non-2xx into a
 * rejection, so this is where that is undone: a 404 or 503 carrying a known body
 * resolves as the state it describes, because a repository that was deleted is
 * something the card should draw, not an error the page should catch.
 */

function isRepoCardResponse(data: unknown): data is RepoCardResponse {
  const state = (data as { state?: unknown } | null)?.state;
  return state === 'ok' || state === 'unavailable' || state === 'temporarily-unavailable';
}

export interface GithubServiceInterface {
  repoCard: (owner: string, name: string) => Promise<RepoCardResponse>;
}

export const githubService: GithubServiceInterface = {
  /** The card fields of one linked repository, or the reason there are none. */
  repoCard: async (owner: string, name: string): Promise<RepoCardResponse> => {
    const path = `/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    try {
      const { data } = await api.get<RepoCardResponse>(path);
      if (isRepoCardResponse(data)) return data;
      throw new Error('Unrecognised response from the GitHub proxy');
    } catch (error) {
      const body = axios.isAxiosError(error) ? error.response?.data : undefined;
      if (isRepoCardResponse(body)) return body;

      // The proxy itself was unreachable (offline, 500, a validation 400).
      // Same shape as everything else, so the card has one thing to render.
      return {
        owner,
        name,
        state: 'temporarily-unavailable',
        reason: 'unavailable',
        message: 'GitHub details could not be loaded just now.',
      };
    }
  },
};

export default githubService;
