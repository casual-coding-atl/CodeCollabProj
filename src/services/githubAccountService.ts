import { authClient, unwrap, unwrapVoid, AuthError } from '../lib/auth-client';

/**
 * The member's Linked GitHub Account (CONTEXT.md), over Better Auth's account
 * endpoints — `/list-accounts`, `/link-social`, `/unlink-account`.
 *
 * Linking is deliberately *only* linking: GitHub can never sign anybody in
 * (src/server/auth.ts disables `/sign-in/social`). What it buys is a token the
 * server can spend on GitHub reads on the member's behalf — and that token
 * lands on the member's `account` row, server-side, never in the browser.
 *
 * Everything here goes through `authClient`, never axios: `/api/auth/*` is
 * Better Auth's, and its `{ data, error }` results are reshaped into rejections
 * by `unwrap`/`unwrapVoid` so the hooks above see ordinary promises.
 */

const PROVIDER_ID = 'github';

/** Where GitHub sends the member back to, linked or not. */
const RETURN_PATH = '/security';

export interface LinkedGitHubAccount {
  id: string;
  accountId: string;
  providerId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  scopes?: string[];
}

/**
 * A deployment without `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` — every dev
 * machine and CI run, and any production box before the OAuth app is
 * registered — simply has no GitHub provider, and Better Auth answers 404
 * PROVIDER_NOT_FOUND. That is a configuration fact, not a member error, so say
 * so instead of showing "Not found".
 */
function explain(error: unknown): never {
  if (error instanceof AuthError) {
    if (error.code === 'PROVIDER_NOT_FOUND' || error.status === 404) {
      throw new AuthError(
        'GitHub is not configured on this server yet, so there is nothing to connect to. ' +
          'An administrator needs to set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
        error.status,
        error.code
      );
    }
    if (error.code === 'SESSION_NOT_FRESH') {
      throw new AuthError(
        'For your security, sign in again before changing your connected accounts.',
        error.status,
        error.code
      );
    }
  }
  throw error;
}

/**
 * What the OAuth round trip means when it comes back unhappy. Better Auth
 * redirects to `${errorCallbackURL}?error=<code>`; these are the codes the link
 * flow can produce.
 */
export function linkFailureMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case 'unable_to_link_account':
      return 'GitHub could not be connected. Check that your GitHub email address is verified.';
    case 'account_already_linked_to_different_user':
      return 'That GitHub account is already connected to another member.';
    case "email_doesn't_match":
      return 'GitHub could not be connected because the email addresses did not match.';
    case 'access_denied':
      return 'GitHub authorization was cancelled.';
    default:
      return 'GitHub could not be connected. Please try again.';
  }
}

export interface GithubAccountServiceInterface {
  get: () => Promise<LinkedGitHubAccount | null>;
  connect: () => Promise<void>;
  disconnect: (accountId?: string) => Promise<void>;
}

export const githubAccountService: GithubAccountServiceInterface = {
  /** The member's GitHub account row, or null when they have not connected one. */
  get: async (): Promise<LinkedGitHubAccount | null> => {
    const accounts = (await unwrap(authClient.listAccounts())) as LinkedGitHubAccount[] | null;
    return (accounts ?? []).find((account) => account.providerId === PROVIDER_ID) ?? null;
  },

  /**
   * Start the OAuth round trip. This navigates away from the app, so it never
   * resolves in the ordinary sense — the member comes back to /security, with
   * `?error=…` if GitHub or Better Auth refused.
   */
  connect: async (): Promise<void> => {
    const origin = import.meta.env.SSR ? '' : window.location.origin;
    const data = (await unwrap(
      authClient.linkSocial({
        provider: PROVIDER_ID,
        callbackURL: `${origin}${RETURN_PATH}`,
        errorCallbackURL: `${origin}${RETURN_PATH}`,
      })
    ).catch(explain)) as { url?: string; redirect?: boolean } | null;

    // Better Auth answers with the authorization URL; follow it ourselves so
    // the behaviour does not depend on the client's redirect handling.
    if (!import.meta.env.SSR && data?.url) window.location.href = data.url;
  },

  /**
   * Disconnect. Linked Repositories on projects stay exactly as they are —
   * they are public project data, not personal connection data (PRD #88).
   */
  disconnect: async (accountId?: string): Promise<void> => {
    await unwrapVoid(
      authClient.unlinkAccount(accountId ? { providerId: PROVIDER_ID, accountId } : { providerId: PROVIDER_ID })
    ).catch(explain);
  },
};

export default githubAccountService;
