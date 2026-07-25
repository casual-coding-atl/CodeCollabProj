import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import * as z from 'zod';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { passkey } from '@better-auth/passkey';
import { connectDB } from './db';
import { User } from './models';
import { accessDenialReason } from './access';

/**
 * Better Auth — the app's authentication layer (ADR 0002).
 *
 * Notable choices, all validated before building — see "Validated before
 * building" in docs/adr/0002-adopt-better-auth.md, which records what the
 * (since deleted) throwaway prototype proved and the one surprise it found:
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
 *   here), never through Better Auth's always-on POST /update-user. Somebody
 *   who signs up *through GitHub* never types one, so one is derived from their
 *   GitHub login — see `deriveUsername`.
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
 * The slice of GitHub's `GET /user` payload this app reads. Better Auth hands
 * `mapProfileToUser` the whole thing; declaring only what we use keeps us off
 * a type from a transitive dependency (`@better-auth/core`).
 */
type GithubProfile = { login?: string | null; email?: string | null };

/**
 * GitHub, registered only when credentials exist so dev/CI without an OAuth app
 * boots fine.
 *
 * GitHub now signs members **in and up**: an identity GitHub vouches for and
 * this app has never seen becomes a member here, and one it recognises by
 * verified email is linked onto the account that already exists. (It was
 * linking-only for one release — `disableSignUp` + a disabled
 * `/sign-in/social` — while the sign-in UI was still being built.)
 *
 * `mapProfileToUser` exists solely to answer the one question GitHub cannot:
 * what to call the new member. `username` is a required additional field, and
 * Better Auth validates required fields on the OAuth create path exactly as on
 * `/sign-up/email` (`parseAdditionalUserInputFromProviderProfile` →
 * `parseInputData`, better-auth/dist/db/schema.mjs), so without this every
 * GitHub sign-up would die as `?error=username_is_required`. Only fields
 * declared in `user.additionalFields` survive that filter, which is why we
 * return `username` and nothing else.
 *
 * It runs on *every* GitHub callback, including sign-ins by members who have
 * been here for years, and the derived name is then thrown away (Better Auth
 * only reads it on the create branch; `updateUserInfoOnLink` and
 * `overrideUserInfoOnSignIn` are both off, so an existing member's username is
 * never overwritten). One extra query per GitHub sign-in is the price of not
 * having to guess which branch the callback is about to take.
 *
 * It must not throw. `mapProfileToUser` runs inside `getUserInfo`, which the
 * OAuth callback calls *before* its try/catch (better-auth/dist/api/routes/
 * callback.mjs — `getUserInfo` at the top, the `try` only around
 * `handleOAuthUserInfo`). A throw here — a Mongo blip in the uniqueness probe,
 * or `deriveUsername` giving up — would escape as an unhandled rejection with
 * the authorization code already spent, stranding the member on raw JSON at the
 * callback URL. So a failed derivation falls back to a random-suffixed name
 * (`randomUsername`) and lets account creation proceed; the unique index on
 * `users.username` is the backstop if that name is somehow taken too.
 */
function githubProvider() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  return {
    github: {
      clientId,
      clientSecret,
      // These scopes are appended to Better Auth's own `read:user`/`user:email`
      // and are the *only* thing the stored token can do. That is fine here
      // precisely because the token never leaves the server: `/get-access-token`
      // and friends are shut (DISABLED_AUTH_PATHS) and the repo proxy is gated,
      // so a broad scope would still only ever be spent by our own read paths.
      scope: ['read:user', 'user:email'],
      mapProfileToUser: async (profile: GithubProfile) => {
        try {
          return { username: await deriveUsername(profile.login, profile.email) };
        } catch (err) {
          // Never let a derivation failure escape the callback (see above).
          console.warn('[auth] GitHub username derivation failed, using a random one:', err);
          return { username: randomUsername(profile.login ?? profile.email) };
        }
      },
    },
  };
}

/**
 * Endpoints Better Auth mounts that this app refuses to serve. Better Auth
 * mounts them unconditionally, so `disabledPaths` is the only way to say no.
 *
 *  - `/get-access-token`, `/refresh-token` — these hand the caller's browser
 *    the member's decrypted GitHub OAuth token. The whole point of linking is
 *    that the token stays on the server (PRD #88, story 24): the browser gets
 *    repo data from our own proxy, never credentials. Left mounted, any signed-
 *    in tab — or any XSS in one — could read the token straight out of the API
 *    and spend it against GitHub as the member.
 *  - `/account-info` — proxies GitHub's user-info call on the member's rate
 *    budget, on demand, for no feature this app has.
 *
 * `/sign-in/social` used to be on this list and deliberately is not any more:
 * it is how signing in with GitHub starts. The token endpoints are a different
 * argument entirely — they are about what a *browser* may hold, not about who
 * may sign in — so they stay shut.
 *
 * Nothing server-side loses anything: `auth.api.*` and the GitHub reads in
 * ./github go through the database and the account row directly.
 */
export const DISABLED_AUTH_PATHS = [
  '/get-access-token',
  '/refresh-token',
  '/account-info',
] as const;

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

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;

/** Escape a value for use inside a RegExp literal. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether somebody already holds this username, compared case-insensitively so
 * `Alex` cannot be minted alongside `alex`.
 */
async function usernameTaken(username: string): Promise<boolean> {
  await connectDB();
  const taken = await User.exists({
    username: new RegExp(`^${escapeRegExp(username)}$`, 'i'),
  }).exec();
  return Boolean(taken);
}

/**
 * Refuse a username somebody already holds. Runs in the user-create hook, so it
 * covers every path that creates a member, not just POST /sign-up/email.
 *
 * This is a check-then-insert, so a unique index does the actual enforcing: the
 * migration builds an exact-case unique index on `users.username`
 * (`users_username_unique`), which turns two same-name sign-ups in the same
 * handful of milliseconds into one winner and one duplicate-key error rather
 * than two rows. Exact-case, not case-insensitive, because a case-insensitive
 * unique index needs a collation the legacy `users` collection was not created
 * with; this check stays case-insensitive so `Alex`/`alex` still cannot coexist
 * in the ordinary (non-racing) path, and the index closes the narrow window it
 * cannot.
 */
export async function assertUsernameAvailable(username: unknown): Promise<void> {
  if (typeof username !== 'string' || username.length === 0) return;
  if (await usernameTaken(username)) {
    throw new APIError('CONFLICT', {
      code: 'USERNAME_TAKEN',
      message: 'An account with that username already exists',
    });
  }
}

/**
 * Fold a GitHub login — or, failing that, an email local part — into a name
 * this app would have accepted from a member typing it: 3–30 characters of
 * letters, digits and underscores (`usernameSchema`).
 *
 * GitHub logins allow `-`, email local parts allow `.` and more; both become
 * `_` rather than being dropped, so `alex-robinett` stays legible as
 * `alex_robinett` instead of collapsing into `alexrobinett`. Runs of separators
 * collapse and the edges are trimmed, because `__alex__` is nobody's idea of a
 * name. What survives can still be too short (GitHub allows one-character
 * logins), so it is padded — and if nothing survives at all, `member` stands in
 * and the collision suffix below makes it `member2`, `member3`, …
 *
 * Pure on purpose: no database, no uniqueness. That is `deriveUsername`.
 */
export function sanitizeUsername(seed: unknown): string {
  const base = String(seed ?? '')
    // An email address contributes its local part; a GitHub login has no `@`,
    // so the same line serves both.
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, USERNAME_MAX);
  if (!base) return 'member';
  return base.padEnd(USERNAME_MIN, '_');
}

/** `alex` + 2 → `alex2`, keeping the whole thing inside 30 characters. */
function withSuffix(base: string, n: number): string {
  const suffix = String(n);
  return `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
}

/**
 * A last-resort username that does not touch the database, for when
 * `deriveUsername` cannot (a Mongo blip, or every suffix somehow taken). It is
 * not checked for uniqueness on purpose — the caller is on a path that must not
 * throw (`mapProfileToUser`), and the `users.username` unique index is the
 * backstop if this six-digit suffix collides, which is a coin flip against an
 * empty room. The member can rename afterwards through PUT /api/users/profile.
 */
export function randomUsername(seed: unknown): string {
  const base = sanitizeUsername(seed);
  return withSuffix(base, 100_000 + Math.floor(Math.random() * 900_000));
}

/**
 * The username a member GitHub is introducing gets, since they never typed one.
 *
 * Preference order is GitHub's `login` (the name they already answer to) then
 * the email local part, sanitized by `sanitizeUsername` and then made unique:
 * `alex`, `alex2`, `alex3`, … case-insensitively, so it cannot collide with the
 * `Alex` who is already here. Members can rename themselves afterwards through
 * PUT /api/users/profile.
 *
 * Only the sequential range is tried before giving up on politeness and
 * reaching for randomness: a hundred queries is already an absurd number of
 * namesakes, and an unbounded loop would turn one hostile signup pattern into a
 * denial of service. Failing outright is the last resort, and surfaces to the
 * member as a GitHub round trip that could not create their account.
 */
export async function deriveUsername(login: unknown, email: unknown): Promise<string> {
  const preferred = typeof login === 'string' && login.trim() !== '' ? login : email;
  const base = sanitizeUsername(preferred);

  if (!(await usernameTaken(base))) return base;
  for (let n = 2; n <= 100; n++) {
    const candidate = withSuffix(base, n);
    if (!(await usernameTaken(candidate))) return candidate;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomUsername(base);
    if (!(await usernameTaken(candidate))) return candidate;
  }
  throw new APIError('CONFLICT', {
    code: 'USERNAME_TAKEN',
    message: 'Could not find an available username for this GitHub account',
  });
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

// ── new-member defaults ──────────────────────────────────────────────────────

/** The route path Better Auth's email/password sign-up runs under. */
const EMAIL_SIGNUP_PATH = '/sign-up/email';

/**
 * The app-domain fields every new member row needs, merged onto whatever Better
 * Auth is about to write. Extracted from the `user.create.before` hook so the
 * one genuinely tricky decision in it — when to force `emailVerified` — is
 * unit-testable without standing up an OAuth flow.
 *
 * `role`/`permissions`/`isActive`/`isSuspended` are defaults: they sit *before*
 * the spread so an explicit incoming value wins (nothing sets them today, but a
 * future admin-create path might).
 *
 * `emailVerified` is the careful one, and it depends on which endpoint is
 * creating the member (`createdViaPath`, from Better Auth's endpoint context):
 *  - `/sign-up/email` — forced true. Verification is stubbed and no sender is
 *    wired, so an unverified local account would be a dead end; the legacy
 *    register endpoint made verified accounts and the migration backfilled every
 *    member as verified. Drop this the day email sending lands.
 *  - the OAuth callback (`/callback/:id`) — left exactly as GitHub reported it.
 *    Forcing it true here would mint a *falsely* verified local row for an email
 *    the member never proved they own (GitHub lets you attach an unverified
 *    address), and that lie would outlive this hook. `disableImplicitLinking`
 *    already refuses to merge such a row, but it must not claim a verification
 *    GitHub declined to give.
 */
export function newMemberDefaults<T extends Record<string, unknown>>(
  user: T,
  createdViaPath: string | undefined,
): T & { role: string; permissions: string[]; isActive: boolean; isSuspended: boolean } {
  return {
    role: 'user',
    // PROTOTYPE(meetup-gate): new signups no longer start with project:create —
    // it is earned via Meetup verification. Pre-gate members keep theirs
    // (grandfathered). Real build: backfill + this flip. Was ['project:create'].
    permissions: [],
    isActive: true,
    isSuspended: false,
    ...user,
    ...(createdViaPath === EMAIL_SIGNUP_PATH ? { emailVerified: true } : {}),
  };
}

// ── the instance ─────────────────────────────────────────────────────────────

/**
 * The whole configuration, over whichever database adapter it is handed.
 *
 * The adapter is a parameter for one reason: it lets a test build *this* config
 * — the real hooks, the real disabled paths — over an in-memory store and ask
 * an endpoint what it answers. Production always passes the MongoDB adapter,
 * through `getAuth` below.
 */
export function buildAuth(database: BetterAuthOptions['database']) {
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET (or JWT_SECRET) must be set');
  }
  const baseURL = resolveBaseURL();

  return betterAuth({
    database,
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
    // See DISABLED_AUTH_PATHS: the token endpoints stay shut so the OAuth token
    // never reaches a browser. Social sign-in itself is served.
    disabledPaths: [...DISABLED_AUTH_PATHS],
    account: {
      accountLinking: {
        // A member links GitHub from their security settings, already signed
        // in. Insisting the GitHub email match the app email would block the
        // ordinary case of a separate work or personal GitHub address, and
        // Better Auth still requires that GitHub email to be *verified* before
        // it will link, which is the check that matters.
        allowDifferentEmails: true,

        // Automatic linking-by-email is off, and this is a security decision,
        // not a preference. The gate in better-auth/dist/oauth2/link-account.mjs
        // that decides whether a GitHub sign-in may attach itself to a member
        // who *already exists* (found by email) is:
        //
        //   !isTrustedProvider && !userInfo.emailVerified
        //     || requireLocalEmailVerified && !dbUser.user.emailVerified
        //     || accountLinking.enabled === false
        //     || accountLinking.disableImplicitLinking === true   ← this
        //
        // With `disableImplicitLinking: true`, an email match on an existing
        // account is *always* refused (returns "account not linked", which the
        // callback turns into `?error=account_not_linked`) rather than merged.
        // A new email still creates an account, and a member who linked GitHub
        // explicitly from /security still signs in — that path finds the linked
        // `account` row and never reaches this gate.
        //
        // The reason it cannot be left to the emailVerified checks alone:
        // `emailVerified` on the *local* row is not proof the person signing in
        // with GitHub owns it. Anyone can register an email/password account for
        // an address they do not control (verification is stubbed — the create
        // hook stamps `emailVerified: true`), then wait for the real owner to
        // sign in with GitHub and have their verified GitHub identity silently
        // merged onto the attacker's row, password and sessions intact. Making
        // /security — where the member is already authenticated — the only merge
        // path removes that whole class. (`trustedProviders` stays empty for the
        // mirror-image reason: naming a provider trusted *waives* the incoming
        // `emailVerified` check, it does not impose one.)
        disableImplicitLinking: true,
        trustedProviders: [],
      },
    },
    user: {
      modelName: 'users',
      additionalFields: {
        // Members pick their own username at sign-up — required, format-checked
        // and (in the create hook) unique. Somebody arriving through GitHub
        // never typed one, so `mapProfileToUser` derives it before Better Auth
        // gets here; `required: true` is enforced on that path too, which is
        // exactly why it has to. The rest are server-owned
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
        // Carried so a suspended member can be told *why*, and until when,
        // instead of meeting a console that answers 403 to everything with no
        // explanation. Server-owned like the rest: `input: false` means nobody
        // can set or clear their own suspension through Better Auth.
        suspensionReason: { type: 'string', required: false, input: false },
        suspendedUntil: { type: 'date', required: false, input: false },
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
          // the permission to create a project. Every path that mints a member
          // comes through here — /sign-up/email and the GitHub callback alike.
          //
          // The username has already been validated by then (Better Auth's
          // field validator), whether the member typed it or `deriveUsername`
          // built it; what is left is the uniqueness check no validator can do.
          //
          // The second argument is Better Auth's endpoint context (the store
          // from `runWithEndpointContext`, dist/api/dispatch.mjs), whose `path`
          // is the route that triggered the create — `/sign-up/email` or, for
          // OAuth, `/callback/:id`. It is how we tell an email sign-up from a
          // GitHub one; see `emailVerified` below.
          before: async (user, context) => {
            await assertUsernameAvailable((user as { username?: unknown }).username);
            const createdVia = (context as { path?: string } | null)?.path;
            // The emailVerified decision (and why it turns on `createdVia`)
            // lives in newMemberDefaults, next to its unit tests.
            return { data: newMemberDefaults(user as Record<string, unknown>, createdVia) };
          },
        },
      },
      session: {
        create: {
          // Every sign-in mints its session through
          // `internalAdapter.createSession`, and the OAuth callback is no
          // exception (better-auth/dist/oauth2/link-account.mjs) — so a
          // suspended member cannot get in through GitHub either.
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
    cached = connectDB().then(() => {
      // Mongoose bundles the mongodb driver v6 while the app depends on v7; the
      // two `Db` types are structurally incompatible but wire-identical at
      // runtime.
      const db = mongoose.connection.db as unknown as Db;
      if (!db) throw new Error('MongoDB connection not ready');
      return buildAuth(mongodbAdapter(db));
    });
  }
  return cached;
}
