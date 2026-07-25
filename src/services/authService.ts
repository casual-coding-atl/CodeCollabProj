import {
  authClient,
  toAppUser,
  toAuthError,
  unwrap,
  unwrapVoid,
  type AuthenticatedMember,
  type AuthSession,
  type Passkey,
  type SessionUser,
} from '../lib/auth-client';
import { isGithubProviderMissing } from './githubAccountService';
import type { LoginCredentials, RegisterData } from '../types';

/**
 * The app's auth operations, expressed over Better Auth (ADR 0002).
 *
 * Every method here is a thin, typed adapter over `authClient` that returns a
 * plain promise (rejecting with an `AuthError`) so the TanStack Query hooks
 * above it stay unchanged in shape. There is no token storage: the session
 * lives in Better Auth's httpOnly `better-auth.session_token` cookie, which the
 * browser sends automatically — nothing about it is readable from JavaScript,
 * which is the point.
 */

/** The user as the rest of the app consumes it (`_id` alongside `id`). */
export type AppUser = AuthenticatedMember;

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetData {
  token: string;
  password: string;
}

export interface AuthServiceInterface {
  register: (data: RegisterData) => Promise<AppUser>;
  login: (credentials: LoginCredentials) => Promise<AppUser>;
  loginWithPasskey: () => Promise<AppUser>;
  signInWithGithub: (errorPath?: string) => Promise<void>;
  getCurrentUser: () => Promise<AppUser | null>;
  getCurrentSession: () => Promise<AuthSession | null>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (data: PasswordChangeData) => Promise<void>;
  getActiveSessions: () => Promise<AuthSession[]>;
  revokeSession: (token: string) => Promise<void>;
  revokeOtherSessions: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ message: string }>;
  resetPassword: (data: PasswordResetData) => Promise<{ message: string }>;
  resendVerificationEmail: (email: string) => Promise<{ message: string }>;
  verifyEmail: (token: string) => Promise<{ message: string }>;
  listPasskeys: () => Promise<Passkey[]>;
  addPasskey: (name?: string) => Promise<void>;
  deletePasskey: (id: string) => Promise<void>;
}

/** Where Better Auth sends the member after they click a reset link. */
const RESET_PASSWORD_PATH = '/reset-password';

function resetRedirectTo(): string {
  return import.meta.env.SSR
    ? RESET_PASSWORD_PATH
    : `${window.location.origin}${RESET_PASSWORD_PATH}`;
}

// ── sign in with GitHub ──────────────────────────────────────────────────────

/** Where a member who signed in (or signed up) with GitHub lands. */
const GITHUB_SUCCESS_PATH = '/dashboard';

/**
 * What a GitHub round trip that came back unhappy means, in the member's words.
 *
 * Better Auth does not fail a social sign-in with a response — the browser is
 * away at github.com when it goes wrong — it redirects to
 * `${errorCallbackURL}?error=<code>`. These are the codes the sign-in flow can
 * produce; `linkFailureMessage` in ./githubAccountService is the same idea for
 * the linking flow, which can fail in different ways.
 */
export function githubSignInFailureMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case 'access_denied':
      return 'GitHub sign-in was cancelled.';
    case 'signup_disabled':
      // Only reachable if the server is reconfigured to refuse GitHub sign-ups;
      // saying "use your email" beats leaving them staring at a code.
      return 'This server does not create accounts from GitHub. Sign in with your email and password instead.';
    case 'account_not_linked':
      // Better Auth's answer when the GitHub email matches a member but cannot
      // be trusted onto it — an unverified GitHub email address.
      return (
        'An account already uses that email address. Verify your email address on GitHub, or ' +
        'sign in with your password and connect GitHub from your security settings.'
      );
    case 'unable_to_create_user':
      return 'Your account could not be created from GitHub. Please try again, or sign up with an email address.';
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_DEACTIVATED':
      // Our own session guard (src/server/auth.ts) refusing to mint a session,
      // surfaced through the same redirect.
      return 'This account cannot sign in. Please contact an administrator.';
    case 'state_not_found':
    case 'invalid_state':
      return 'The GitHub sign-in took too long or was started in another tab. Please try again.';
    default:
      return 'GitHub could not sign you in. Please try again.';
  }
}

export const authService: AuthServiceInterface = {
  /**
   * Sign up. Better Auth requires a display `name`; members only ever pick a
   * username, so the username is the name (exactly what the migration
   * backfilled for existing members). `autoSignIn` is on server-side, so a
   * successful registration also starts a session.
   */
  register: async ({ username, email, password }: RegisterData): Promise<AppUser> => {
    const data = await unwrap(
      authClient.signUp.email({ email, password, name: username, username })
    );
    return toAppUser(data.user as SessionUser);
  },

  login: async ({ email, password }: LoginCredentials): Promise<AppUser> => {
    const data = await unwrap(authClient.signIn.email({ email, password }));
    return toAppUser(data.user as SessionUser);
  },

  /**
   * Sign in with a registered passkey. The browser's WebAuthn prompt happens
   * inside this call; a cancelled prompt rejects like any other failure.
   */
  loginWithPasskey: async (): Promise<AppUser> => {
    const data = await unwrap(authClient.signIn.passkey());
    if (!data?.user) {
      throw toAuthError({ message: 'Passkey sign-in did not return a session', status: 500 });
    }
    return toAppUser(data.user as SessionUser);
  },

  /**
   * Sign in with GitHub — which, for somebody GitHub knows and this app does
   * not, also signs them up (src/server/auth.ts).
   *
   * Like every OAuth start this navigates away, so it never resolves in the
   * ordinary sense: the member comes back to /dashboard signed in, or to
   * `errorPath` with `?error=<code>` for `githubSignInFailureMessage` to read.
   * The one thing it *can* reject with is a server that has no GitHub OAuth app
   * configured at all, which is worth a sentence rather than a bare "Not found".
   */
  signInWithGithub: async (errorPath = '/login'): Promise<void> => {
    const origin = import.meta.env.SSR ? '' : window.location.origin;
    const data = (await unwrap(
      authClient.signIn.social({
        provider: 'github',
        callbackURL: `${origin}${GITHUB_SUCCESS_PATH}`,
        errorCallbackURL: `${origin}${errorPath}`,
      })
    ).catch((error: unknown) => {
      if (isGithubProviderMissing(error)) {
        throw toAuthError({
          message:
            'GitHub is not configured on this server yet, so there is no way to sign in with it. ' +
            'An administrator needs to set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
          status: (error as { status?: number }).status ?? 404,
          code: (error as { code?: string }).code,
        });
      }
      throw error;
    })) as { url?: string; redirect?: boolean } | null;

    // Follow the authorization URL ourselves rather than depending on the
    // client's own redirect handling, exactly as the linking flow does.
    if (!import.meta.env.SSR && data?.url) window.location.href = data.url;
  },

  /**
   * The signed-in member, or `null` when nobody is.
   *
   * Only an *answered* "no session" is null. A 500, a dropped connection or a
   * proxy error throws, because the difference matters: treating a fault as
   * "signed out" would cache an anonymous answer for the whole staleTime and
   * throw a perfectly valid member out of every guarded page until it expired.
   * Better Auth answers an anonymous request with 200 and a null body, so the
   * two really are distinguishable.
   */
  getCurrentUser: async (): Promise<AppUser | null> => {
    const { data, error } = await authClient.getSession();
    if (error) throw toAuthError(error);
    return data?.user ? toAppUser(data.user as SessionUser) : null;
  },

  /**
   * This browser's session row, so the sessions list can mark which one the
   * member is looking at (`list-sessions` doesn't say). Faults throw here for
   * the same reason: a silent null would leave every row unlabelled and offer
   * to revoke the session the member is sitting in.
   */
  getCurrentSession: async (): Promise<AuthSession | null> => {
    const { data, error } = await authClient.getSession();
    if (error) throw toAuthError(error);
    return (data?.session as AuthSession | undefined) ?? null;
  },

  logout: async (): Promise<void> => {
    await unwrapVoid(authClient.signOut());
  },

  /**
   * Sign out everywhere. Other devices are revoked first — signing out first
   * would destroy the very session that authorizes the revocation.
   */
  logoutAll: async (): Promise<void> => {
    await unwrapVoid(authClient.revokeOtherSessions());
    await unwrapVoid(authClient.signOut());
  },

  /** Changing the password signs the member out of every *other* device. */
  changePassword: async ({ currentPassword, newPassword }): Promise<void> => {
    await unwrapVoid(
      authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    );
  },

  getActiveSessions: async (): Promise<AuthSession[]> => {
    return unwrap(authClient.listSessions()) as Promise<AuthSession[]>;
  },

  /** Sessions are addressed by their token, not their id. */
  revokeSession: async (token: string): Promise<void> => {
    await unwrapVoid(authClient.revokeSession({ token }));
  },

  revokeOtherSessions: async (): Promise<void> => {
    await unwrapVoid(authClient.revokeOtherSessions());
  },

  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    // `POST /api/auth/request-password-reset` (Better Auth ≥1.6 — the older
    // `forget-password` spelling is gone). `redirectTo` is where the emailed
    // link lands after Better Auth validates the token and appends it.
    await unwrapVoid(authClient.requestPasswordReset({ email, redirectTo: resetRedirectTo() }));
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  },

  resetPassword: async ({ token, password }: PasswordResetData): Promise<{ message: string }> => {
    await unwrapVoid(authClient.resetPassword({ token, newPassword: password }));
    return { message: 'Your password has been reset.' };
  },

  resendVerificationEmail: async (email: string): Promise<{ message: string }> => {
    await unwrapVoid(authClient.sendVerificationEmail({ email }));
    return { message: 'Verification email sent.' };
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    await unwrapVoid(authClient.verifyEmail({ query: { token } }));
    return { message: 'Your email address has been verified.' };
  },

  listPasskeys: async (): Promise<Passkey[]> => {
    return unwrap(authClient.passkey.listUserPasskeys()) as Promise<Passkey[]>;
  },

  /**
   * Prompts the authenticator; a cancelled prompt rejects with the same
   * `AuthError` shape as every other failure here (callers read `.code` to tell
   * a cancellation from a real fault). `addPasskey` resolves to a bare
   * `{ error }` rather than going through `unwrap`, because on success its
   * payload is the new passkey, which nothing needs — the list is refetched.
   */
  addPasskey: async (name?: string): Promise<void> => {
    const res = await authClient.passkey.addPasskey(name ? { name } : undefined);
    if (res?.error) {
      throw toAuthError({ ...res.error, message: res.error.message || 'Could not add a passkey' });
    }
  },

  deletePasskey: async (id: string): Promise<void> => {
    await unwrapVoid(authClient.passkey.deletePasskey({ id }));
  },
};

export default authService;
