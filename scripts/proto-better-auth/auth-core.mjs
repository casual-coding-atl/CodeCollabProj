// PROTOTYPE — portable core. Pure logic, no terminal code.
// If validated, this shape moves (as TS) into src/server/auth.ts + a real
// migration script. See README.md for the question being answered.
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

/**
 * Better Auth configured the way Phase 1 intends:
 * - existing `users` collection mapped as the user model
 * - bcrypt (cost 12, matching api.auth.register.ts) instead of default scrypt
 * - app-domain fields declared as additionalFields so they round-trip
 */
export function createAuth(db) {
  return betterAuth({
    database: mongodbAdapter(db),
    secret: 'proto-secret-not-for-production',
    baseURL: 'http://localhost:3000',
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      password: {
        hash: (password) => bcrypt.hash(password, 12),
        verify: ({ hash, password }) => bcrypt.compare(password, hash),
      },
    },
    user: {
      modelName: 'users',
      additionalFields: {
        username: { type: 'string', required: false },
        role: { type: 'string', required: false },
        isActive: { type: 'boolean', required: false },
        isSuspended: { type: 'boolean', required: false },
      },
    },
  });
}

/** Insert a user shaped exactly like the legacy register endpoint writes them. */
export async function seedLegacyUser(db, { username, email, password }) {
  const hash = await bcrypt.hash(password, 12);
  const doc = {
    username,
    email,
    password: hash,
    role: 'user',
    isActive: true,
    isSuspended: false,
    isVerified: true,
    createdAt: new Date(),
  };
  const { insertedId } = await db.collection('users').insertOne(doc);
  return insertedId;
}

/**
 * The Phase-1 migration, in miniature: for every user with a legacy
 * `password` field, create a credential `account` row holding the hash and
 * backfill the fields Better Auth requires (`name`, `emailVerified`,
 * timestamps). Idempotent: skips users that already have a credential account.
 */
export async function migrateLegacyUsers(db) {
  const users = db.collection('users');
  const accounts = db.collection('account');
  const legacy = await users.find({ password: { $exists: true } }).toArray();
  const migrated = [];
  for (const u of legacy) {
    const existing = await accounts.findOne({ userId: u._id, providerId: 'credential' });
    if (existing) continue;
    const now = new Date();
    await accounts.insertOne({
      userId: u._id,
      accountId: String(u._id),
      providerId: 'credential',
      password: u.password,
      createdAt: now,
      updatedAt: now,
    });
    await users.updateOne(
      { _id: u._id },
      {
        $set: {
          name: u.username ?? u.email,
          emailVerified: u.isVerified ?? true,
          createdAt: u.createdAt ?? now,
          updatedAt: now,
        },
        $unset: { password: '' },
      },
    );
    migrated.push(u.email);
  }
  return migrated;
}

/**
 * requireUser's future shape: Better Auth answers "whose session?", then we
 * enforce isActive/suspension from the user doc — exactly like today's
 * getAuthUser in src/server/http.ts.
 */
export async function guardSession(auth, db, cookie) {
  const res = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!res) return { userId: null, allowed: false, reason: 'no valid session' };
  const user = await db.collection('users').findOne({ _id: new ObjectId(res.user.id) });
  if (!user) return { userId: res.user.id, allowed: false, reason: 'user doc missing' };
  if (user.isActive === false) return { userId: res.user.id, allowed: false, reason: 'inactive' };
  const suspended =
    user.isSuspended && (!user.suspendedUntil || new Date() < new Date(user.suspendedUntil));
  if (suspended) return { userId: res.user.id, allowed: false, reason: 'suspended' };
  return { userId: res.user.id, allowed: true, reason: 'ok' };
}
