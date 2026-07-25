import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import * as z from 'zod';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { passkey } from '@better-auth/passkey';
import { connectDB } from './db';
import { User } from './models';
import { accessDenialReason } from './access';

/**
 * Better Auth — the app's authentication layer (ADR 0002).
 *
 * Notable choices, all validated by `scripts/proto-better-auth`:
 * - The existing `users` collection *is* Better Auth's user model
 *   (`user.modelName`), so every `Project.owner` / `collaborators.userId`
 *   ObjectId reference survives untouched. App-domain fields are declared as
 *   `additionalFields` so they round-trip through sessions instead of being
 *   stripped.
 * - Passwords stay bcryptjs cost 12 (what the legacy register endpoint wrote),
 *   overriding Better Auth's scrypt default — nobody resets a password.
 * - Roles and suspension stay ours: Better Auth answers "whose session is
 *   this?", and the rules in ./access decide whether that member may hold a
 *   session at all — enforced here when one is minted and in ./http on every
 *   request.
 * - Usernames stay ours too: settable once at sign-up (validated and unique
 *   here), never through Better Auth's always-on POST /update-user.
 *
 * The instance is built lazily because the Mongo `Db` handle only exists after
 * the shared Mongoose connection resolves — we reuse that pool rather than
 * opening a second MongoClient.
 */

const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;

/**
 * The origin Better Auth signs callbacks and scopes cookies to.
 *
 * There is a dev default and deliberately no production one: a prod deploy that
 * silently fell back to http://localhost:3000 would trust the wrong origin and
 * hand out a non-Secure cookie. Fail the boot instead.
 */
export function resolveBaseURL(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'BETTER_AUTH_URL must be set in production — it is the origin Better Auth ' +
        'trusts for callbacks and scopes the session cookie to (e.g. https://app.example.com).',
    );
  }
  return 'http://localhost:3000';
}

/**
 * WebAuthn relying-party id: the registrable domain, no scheme or port —
 * `localhost` in dev, `codecollabproj.com` in prod. Derived from BETTER_AUTH_URL
 * so the two can't drift; PASSKEY_RP_ID overrides for odd deployments.
 */
function relyingPartyId(baseURL: string): string {
  if (process.env.PASSKEY_RP_ID) return process.env.PASSKEY_RP_ID;
  try {
    return new URL(baseURL).hostname;
  } catch {
    return 'localhost';
  }
}

/**
 * GitHub, registered only when credentials exist so dev/CI without an OAuth app
 * boots fine.
 *
 * Linking-only, by design: the roadmap wants members to *attach* a GitHub
 * identity to the account they already have, and never to sign in (let alone
 * sign up) with one. Two layers enforce that, because they fail differently:
 *
 *  - `disableImplicitSignUp` + `disableSignUp` stop the OAuth callback from
 *    ever creating a user, whatever kicked the flow off;
 *  - `/sign-in/social` is in `disabledPaths` below, so the public entry point
 *    to social sign-in 404s even for a member who *has* linked GitHub.
 *
 * `POST /link-social` is a different endpoint and its callback branch returns
 * before any of the sign-up machinery (see better-auth's oauth2/link-account),
 * so linking keeps working. Undo both when GitHub sign-in is actually wanted.
 */
function githubProvider() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return {
    github: {
      clientId,
      clientSecret,
      scope: ['read:user', 'user:email'],
      disableImplicitSignUp: true,
      disableSignUp: true,
    },
  };
}

// ── usernames ────────────────────────────────────────────────────────────────

/**
 * The legacy `registerValidation` rules, recovered from the retired Express
 * router: 3–30 characters, letters/digits/underscore. Applied by Better Auth as
 * the `username` field's input validator, so sign-up rejects a bad one before
 * anything is written.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters long')
  .max(30, 'Username must not exceed 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

/** Escape a value for use inside a RegExp literal. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Refuse a username somebody already holds, comparing case-insensitively so
 * `Alex` cannot be minted alongside `alex`. Runs in the user-create hook, so it
 * covers every path that creates a member, not just POST /sign-up/email.
 *
 * There is a race here that only a unique index could close, and a
 * case-insensitive unique index needs a collation the legacy `users` collection
 * does not have. Losing the race needs two sign-ups for the same name in the
 * same handful of milliseconds; the migration script reports existing duplicates
 * so an index can be added deliberately later.
 */
export async function assertUsernameAvailable(username: unknown): Promise<void> {
  if (typeof username !== 'string' || username.length === 0) return;
  await connectDB();
  const taken = await User.exists({
    username: new RegExp(`^${escapeRegExp(username)}$`, 'i'),
  }).exec();
  if (taken) {
    throw new APIError('CONFLICT', {
      code: 'USERNAME_TAKEN',
      message: 'An account with that username already exists',
    });
  }
}

/**
 * Better Auth mounts POST /update-user unconditionally and passes any declared
 * additional field straight through, which would let any signed-in member claim
 * (or blank) anybody's username. Usernames change through PUT
 * /api/users/profile or not at all, so reject the field here.
 *
 * Split out from the middleware to stay unit-testable.
 */
export function assertNoUsernameChange(path: string, body: unknown): void {
  if (path !== '/update-user') return;
  if (typeof body !== 'object' || body === null) return;
  if (!('username' in body)) return;
  throw new APIError('FORBIDDEN', {
    code: 'USERNAME_CANNOT_BE_UPDATED',
    message: 'Username cannot be changed through this endpoint',
  });
}

// ── who may hold a session ───────────────────────────────────────────────────

/**
 * The gate on minting a session. Better Auth is happy to hand a suspended or
 * deactivated member a fresh session — their password still verifies, their
 * passkey still asserts — which would make admin revocation cosmetic and hand
 * them working /api/auth/* endpoints (change-password, passkey enrolment).
 *
 * One `session.create.before` hook covers every way in: password, passkey and
 * any future OAuth sign-in.
 */
export async function assertMemberMaySignIn(userId: unknown): Promise<void> {
  await connectDB();
  const user = await User.findById(String(userId)).exec();
  if (!user) {
    throw new APIError('UNAUTHORIZED', {
      code: 'USER_NOT_FOUND',
      message: 'Account not found',
    });
  }
  const denial = accessDenialReason(user);
  if (denial === 'deactivated') {
    throw new APIError('FORBIDDEN', {
      code: 'ACCOUNT_DEACTIVATED',
      message: 'This account has been deactivated',
    });
  }
  if (denial === 'suspended') {
    throw new APIError('FORBIDDEN', {
      code: 'ACCOUNT_SUSPENDED',
      message: 'This account is suspended',
    });
  }
}

// ── the instance ─────────────────────────────────────────────────────────────

function buildAuth() {
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET (or JWT_SECRET) must be set');
  }
  const baseURL = resolveBaseURL();
  // Mongoose bundles the mongodb driver v6 while the app depends on v7; the two
  // `Db` types are structurally incompatible but wire-identical at runtime.
  const db = mongoose.connection.db as unknown as Db;
  if (!db) throw new Error('MongoDB connection not ready');

  return betterAuth({
    database: mongodbAdapter(db),
    secret,
    baseURL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      password: {
        hash: (password) => bcrypt.hash(password, 12),
        verify: ({ hash, password }) => bcrypt.compare(password, hash),
      },
      // Without this, POST /request-password-reset 400s instead of giving the
      // legacy non-enumerating "if this email exists, check your inbox". No
      // sender is wired yet (see CLAUDE.md "Known gaps"), so the link goes to
      // the server log — and only outside production, where it would be a
      // password-reset token sitting in the log drain.
      sendResetPassword: async ({ user, url }) => {
        if (process.env.NODE_ENV === 'production') {
          console.warn(
            `[auth] password reset requested for ${user.email} but no email sender is configured — the member will never receive it.`,
          );
          return;
        }
        console.warn(`[auth] password reset for ${user.email} (no email sender wired): ${url}`);
      },
    },
    socialProviders: githubProvider(),
    // See githubProvider(): linking is supported, social sign-in is not.
    disabledPaths: ['/sign-in/social'],
    user: {
      modelName: 'users',
      additionalFields: {
        // Members pick their own username at sign-up — required, format-checked
        // and (in the create hook) unique. The rest are server-owned
        // (input: false) so nobody can grant themselves a role or un-suspend.
        username: {
          type: 'string',
          required: true,
          validator: { input: usernameSchema },
        },
        role: { type: 'string', required: false, input: false },
        permissions: { type: 'string[]', required: false, input: false },
        isActive: { type: 'boolean', required: false, input: false },
        isSuspended: { type: 'boolean', required: false, input: false },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        assertNoUsernameChange(ctx.path, ctx.body);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Better Auth writes through the Mongo driver, so the Mongoose schema
          // defaults never fire. Stamp the app-domain defaults the legacy
          // register endpoint wrote, or a new member lands without a role or
          // the permission to create a project.
          before: async (user) => {
            await assertUsernameAvailable((user as { username?: unknown }).username);
            return {
              data: {
                role: 'user',
                permissions: ['project:create'],
                isActive: true,
                isSuspended: false,
                ...user,
                // AFTER the spread on purpose: sign-up hands us
                // `emailVerified: false`, but verification is disabled and no
                // sender is wired, so an unverified account would be a dead end.
                // The legacy register endpoint created verified accounts and the
                // migration backfilled every existing member as verified —
                // this keeps that invariant. Drop it the day email sending lands.
                emailVerified: true,
              },
            };
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            await assertMemberMaySignIn(session.userId);
          },
        },
      },
    },
    plugins: [passkey({ rpID: relyingPartyId(baseURL), rpName: 'CodeCollabProj' })],
  });
}

export type Auth = ReturnType<typeof buildAuth>;

let cached: Promise<Auth> | undefined;

/** The shared Better Auth instance, built once the Mongo connection is up. */
export function getAuth(): Promise<Auth> {
  if (!cached) {
    cached = connectDB().then(() => buildAuth());
  }
  return cached;
}
