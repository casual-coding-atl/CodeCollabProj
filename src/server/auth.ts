import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { passkey } from '@better-auth/passkey';
import { connectDB } from './db';

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
 *   this?" and `requireUser` in ./http enforces isActive/isSuspended.
 *
 * The instance is built lazily because the Mongo `Db` handle only exists after
 * the shared Mongoose connection resolves — we reuse that pool rather than
 * opening a second MongoClient.
 */

const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;

/**
 * WebAuthn relying-party id: the registrable domain, no scheme or port —
 * `localhost` in dev, `codecollabproj.com` in prod. Derived from BETTER_AUTH_URL
 * so the two can't drift; PASSKEY_RP_ID overrides for odd deployments.
 */
function relyingPartyId(): string {
  if (process.env.PASSKEY_RP_ID) return process.env.PASSKEY_RP_ID;
  try {
    return new URL(baseURL).hostname;
  } catch {
    return 'localhost';
  }
}

function githubProvider() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  // Registered only when credentials exist, so dev/CI without a GitHub OAuth
  // app boots fine. The UI that uses it arrives with the GitHub linking work.
  if (!clientId || !clientSecret) return {};
  return { github: { clientId, clientSecret, scope: ['read:user', 'user:email'] } };
}

function buildAuth() {
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET (or JWT_SECRET) must be set');
  }
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
    },
    socialProviders: githubProvider(),
    user: {
      modelName: 'users',
      additionalFields: {
        // Members pick their own username at sign-up; the rest are server-owned
        // (input: false) so nobody can grant themselves a role or un-suspend.
        username: { type: 'string', required: false },
        role: { type: 'string', required: false, input: false },
        permissions: { type: 'string[]', required: false, input: false },
        isActive: { type: 'boolean', required: false, input: false },
        isSuspended: { type: 'boolean', required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Better Auth writes through the Mongo driver, so the Mongoose schema
          // defaults never fire. Stamp the app-domain defaults the legacy
          // register endpoint wrote, or a new member lands without a role or
          // the permission to create a project.
          before: async (user) => ({
            data: {
              role: 'user',
              permissions: ['project:create'],
              isActive: true,
              isSuspended: false,
              ...user,
            },
          }),
        },
      },
    },
    plugins: [passkey({ rpID: relyingPartyId(), rpName: 'CodeCollabProj' })],
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
