import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import type { Auth } from '../server/auth';
import type { Permission, User, UserRole } from '../types';

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

type AuthFailure = {
  message?: string;
  status?: number;
  statusText?: string;
  code?: string;
} | null;

type AuthResult<T> = { data: T | null; error?: AuthFailure };

function fail(error: NonNullable<AuthFailure>): never {
  throw new AuthError(
    error.message || error.statusText || 'Request failed',
    error.status ?? 500,
    error.code
  );
}

/** Resolve a Better Auth call to its data, or reject with an `AuthError`. */
export async function unwrap<T>(call: Promise<AuthResult<T>>): Promise<T> {
  const res = await call;
  if (res.error) fail(res.error);
  return res.data as T;
}

/** Same, for endpoints whose success payload is empty (sign-out, revoke, …). */
export async function unwrapVoid(call: Promise<AuthResult<unknown>>): Promise<void> {
  const res = await call;
  if (res.error) fail(res.error);
}

// ── user shape ───────────────────────────────────────────────────────────────

/**
 * Map a Better Auth session user onto the app's `User`. Components read both
 * `id` and `_id` (Mongo's spelling, which the rest of the API returns), so both
 * are populated from the one identifier Better Auth gives us.
 */
export function toAppUser(user: SessionUser): User & { _id: string } {
  return {
    id: user.id,
    _id: user.id,
    email: user.email,
    username: user.username || user.name || user.email,
    profileImage: user.image ?? undefined,
    role: (user.role as UserRole) || 'user',
    permissions: (user.permissions as Permission[]) || [],
    isActive: user.isActive !== false,
    isSuspended: user.isSuspended === true,
    isEmailVerified: user.emailVerified,
    // Fields the session doesn't carry — the profile endpoints own them.
    skills: [],
    experience: 'beginner',
    availability: 'flexible',
    portfolioLinks: [],
    socialLinks: {},
    isProfilePublic: true,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}
