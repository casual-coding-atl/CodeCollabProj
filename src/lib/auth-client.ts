import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import type { Auth } from '../server/auth';
import type { Permission, UserRole } from '../types';

/**
 * The browser's half of Better Auth (ADR 0002).
 *
 * Everything the client needs — sign-in/up/out, session listing and revocation,
 * password change/reset, passkeys — is a method on this object; there are no
 * hand-written `/api/auth/*` calls left. `inferAdditionalFields<Auth>()` reads
 * the server config's `additionalFields` (username, role, permissions,
 * isActive, isSuspended) so the session user is typed with the app's own fields
 * rather than Better Auth's bare user.
 *
 * The `Auth` import is type-only: it disappears at build time, so importing the
 * server config here does not pull server code into the browser bundle.
 */

/**
 * Same-origin in the browser. Under SSR `window` is a throwing unenv stub (see
 * CLAUDE.md), so we never touch it — the branch is compiled out of the client
 * bundle by `import.meta.env.SSR`. Nothing on the server actually calls the
 * client, but `createAuthClient` resolves a base URL at module load.
 */
function resolveBaseURL(): string {
  if (!import.meta.env.SSR) return window.location.origin;
  return process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  plugins: [passkeyClient(), inferAdditionalFields<Auth>()],
});

/** The session user as Better Auth returns it, including the app's own fields. */
export type SessionUser = typeof authClient.$Infer.Session.user;
/** One row of `GET /api/auth/list-sessions`. */
export type AuthSession = typeof authClient.$Infer.Session.session;
/** One row of `GET /api/auth/passkey/list-user-passkeys`. */
export type Passkey = typeof authClient.$Infer.Passkey;

// ── errors ───────────────────────────────────────────────────────────────────

/**
 * Better Auth returns `{ data, error }` instead of throwing. Mutations and
 * queries in this app expect a rejected promise, and the pages render
 * `error.response.data.message` (an axios habit from the old service), so the
 * failure is reshaped once, here, to satisfy both.
 */
export class AuthError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly response: { status: number; data: { message: string; code?: string } };

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    this.response = { status, data: { message, code } };
  }
}

export type AuthFailure = {
  message?: string;
  status?: number;
  statusText?: string;
  code?: string;
} | null;

type AuthResult<T> = { data: T | null; error?: AuthFailure };

/** Reshape one of Better Auth's `error` objects into the app's `AuthError`. */
export function toAuthError(error: NonNullable<AuthFailure>): AuthError {
  return new AuthError(
    error.message || error.statusText || 'Request failed',
    error.status ?? 500,
    error.code
  );
}

/** Resolve a Better Auth call to its data, or reject with an `AuthError`. */
export async function unwrap<T>(call: Promise<AuthResult<T>>): Promise<T> {
  const res = await call;
  if (res.error) throw toAuthError(res.error);
  return res.data as T;
}

/** Same, for endpoints whose success payload is empty (sign-out, revoke, …). */
export async function unwrapVoid(call: Promise<AuthResult<unknown>>): Promise<void> {
  const res = await call;
  if (res.error) throw toAuthError(res.error);
}

// ── WebAuthn ─────────────────────────────────────────────────────────────────

/**
 * Whether this browser can do WebAuthn at all. Called from an effect, never
 * during render: the server can't know, and branching on it while rendering
 * would produce markup that doesn't match the hydrated tree.
 */
export function supportsPasskeys(): boolean {
  return !import.meta.env.SSR && typeof window.PublicKeyCredential === 'function';
}

/**
 * A member dismissing the system passkey prompt is not a failure — it's them
 * changing their mind, and it must not raise an error toast at someone who
 * pressed Escape on purpose. Better Auth reports both its own `AUTH_CANCELLED`
 * and SimpleWebAuthn's ceremony codes, which is what a `NotAllowedError` from
 * `navigator.credentials` becomes.
 */
const CANCELLATION_CODES = new Set([
  'AUTH_CANCELLED',
  'REGISTRATION_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  'NotAllowedError',
  'AbortError',
]);

export function isPasskeyCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, name, message } = error as { code?: string; name?: string; message?: string };
  if (code && CANCELLATION_CODES.has(code)) return true;
  if (name && CANCELLATION_CODES.has(name)) return true;
  return /NotAllowedError|aborted|cancell?ed/i.test(message ?? '');
}

// ── user shape ───────────────────────────────────────────────────────────────

/**
 * Who the browser believes is signed in.
 *
 * Deliberately NOT the app's full `User`: a session carries identity and
 * authorization, not a profile. The earlier shape padded out `skills`,
 * `experience`, `availability` and friends with invented defaults so it could
 * claim to be a `User`, which meant any component reading them off `useAuth()`
 * silently got fiction instead of the member's actual profile. Those fields
 * belong to `useMyProfile()` / `/api/users/profile/me`, and are absent here so
 * the type system says so.
 */
export interface AuthenticatedMember {
  /** Better Auth's id. `_id` is the same value under Mongo's spelling, which
   *  the rest of the API returns — components read whichever they know. */
  id: string;
  _id: string;
  email: string;
  username: string;
  /** Better Auth's display name; the migration backfilled it from `username`. */
  name: string;
  profileImage?: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  isSuspended: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Map a Better Auth session user onto the shape the app's components read. */
export function toAppUser(user: SessionUser): AuthenticatedMember {
  return {
    id: user.id,
    _id: user.id,
    email: user.email,
    username: user.username || user.name || user.email,
    name: user.name || user.username || user.email,
    profileImage: user.image ?? undefined,
    role: (user.role as UserRole) || 'user',
    permissions: (user.permissions as Permission[]) || [],
    isActive: user.isActive !== false,
    isSuspended: user.isSuspended === true,
    isEmailVerified: user.emailVerified,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}
