import {
  authClient,
  unwrap,
  unwrapVoid,
  AuthError,
  isGithubProviderMissing,
} from '../lib/auth-client';

/**
 * The member's Linked GitHub Account (CONTEXT.md), over Better Auth's account
 * endpoints — `/list-accounts`, `/link-social`, `/unlink-account`.
 *
 * This is the *already signed in* half of GitHub: attaching an identity to the
 * account you are sitting in. Signing in (and signing up) with GitHub is
 * `authService.signInWithGithub`. What linking buys on top of identity is a
 * token the server can spend on GitHub reads on the member's behalf — and that
 * token lands on the member's `account` row, server-side, never in the browser.
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
 * PROVIDER_NOT_FOUND. `isGithubProviderMissing` (shared with the sign-in flow,
 * in src/lib/auth-client) is the predicate; the sentence is not shared, because
 * "nothing to connect to" and "no way to sign in" are different news.
 */
function explain(error: unknown): never {
  if (error instanceof AuthError) {
    if (isGithubProviderMissing(error)) {
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
      // Also what a member sees when the unique index on `account` refuses the
      // write (see scripts/migrate-better-auth.mjs) — the account row already
      // exists, here or on somebody else's member. Both are worth naming,
      // because "verify your email" alone would send them hunting for the
      // wrong thing.
      return (
        'GitHub could not be connected. Check that your GitHub email address is verified, ' +
        'and that this GitHub account is not already connected to another member.'
      );
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
   *
   * Relative callback URLs, for the same reason `signInWithGithub` uses them:
   * Better Auth validates them against its own origin (`trustedOrigins`), and an
   * absolute `window.location.origin` off by a `www.`/apex/preview host is
   * rejected 403 INVALID_CALLBACK_URL. A relative path resolves against Better
   * Auth's base URL and lands wherever the app is actually served.
   */
  connect: async (): Promise<void> => {
    const data = (await unwrap(
      authClient.linkSocial({
        provider: PROVIDER_ID,
        callbackURL: RETURN_PATH,
        errorCallbackURL: RETURN_PATH,
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
