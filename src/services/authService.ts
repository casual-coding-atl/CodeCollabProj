import {
  authClient,
  toAppUser,
  unwrap,
  unwrapVoid,
  type AuthSession,
  type Passkey,
  type SessionUser,
} from '../lib/auth-client';
import type { LoginCredentials, RegisterData, User } from '../types';

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
export type AppUser = User & { _id: string };

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
      throw new Error('Passkey sign-in did not return a session');
    }
    return toAppUser(data.user as SessionUser);
  },

  /** The signed-in member, or null when there is no session (not an error). */
  getCurrentUser: async (): Promise<AppUser | null> => {
    const { data, error } = await authClient.getSession();
    if (error || !data?.user) return null;
    return toAppUser(data.user as SessionUser);
  },

  /**
   * This browser's session row, so the sessions list can mark which one the
   * member is looking at (`list-sessions` doesn't say).
   */
  getCurrentSession: async (): Promise<AuthSession | null> => {
    const { data, error } = await authClient.getSession();
    if (error || !data?.session) return null;
    return data.session as AuthSession;
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

  /** Prompts the authenticator; a cancelled prompt rejects. */
  addPasskey: async (name?: string): Promise<void> => {
    const res = await authClient.passkey.addPasskey(name ? { name } : undefined);
    if (res?.error) {
      const { message, statusText, status, code } = res.error as {
        message?: string;
        statusText?: string;
        status?: number;
        code?: string;
      };
      const err = new Error(message || statusText || 'Could not register a passkey');
      Object.assign(err, { status, code });
      throw err;
    }
  },

  deletePasskey: async (id: string): Promise<void> => {
    await unwrapVoid(authClient.passkey.deletePasskey({ id }));
  },
};

export default authService;
