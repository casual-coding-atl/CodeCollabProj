// One-off, idempotent migration onto Better Auth (ADR 0002).
//
// For every legacy user doc it:
//   - inserts a `credential` row in the `account` collection carrying the
//     existing bcrypt hash, so nobody has to reset a password;
//   - backfills the fields Better Auth expects (`name`, `emailVerified`,
//     `createdAt`, `updatedAt`);
//   - drops the legacy `password` field from the user doc.
//
// Safe to run repeatedly: users that already have a credential account and the
// backfilled fields are skipped. Run it BEFORE deploying the auth switch. The
// legacy `sessions` collection is left alone (retired, drop it after verifying)
// — every member signs in once after deploy.
//
// Usage:  MONGODB_URI=... npm run migrate:auth  [-- --dry-run]
//
// The per-user transform lives in src/server/auth-migration.ts (unit-tested);
// this file is only the Mongo plumbing. Node strips the TypeScript on import
// (Node >= 22.6 with --experimental-strip-types, default from 22.18).
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { planUserMigration } from '../src/server/auth-migration.ts';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('MONGODB_URI is required — refusing to run.');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db();
const users = db.collection('users');
const accounts = db.collection('account');

console.log(`[migrate:auth] ${dryRun ? 'DRY RUN — ' : ''}${db.databaseName}`);

let accountsCreated = 0;
let usersBackfilled = 0;
let skipped = 0;

const cursor = users.find({});
for await (const user of cursor) {
  const hasCredentialAccount =
    (await accounts.countDocuments(
      { userId: user._id, providerId: 'credential' },
      { limit: 1 },
    )) > 0;

  const plan = planUserMigration(user, { now: new Date(), hasCredentialAccount });
  if (!plan.changed) {
    skipped += 1;
    continue;
  }

  if (!dryRun && plan.account) await accounts.insertOne(plan.account);
  if (plan.account) accountsCreated += 1;

  const update = {};
  if (Object.keys(plan.set).length > 0) update.$set = plan.set;
  if (plan.unset.length > 0) {
    update.$unset = Object.fromEntries(plan.unset.map((field) => [field, '']));
  }
  if (Object.keys(update).length > 0) {
    if (!dryRun) await users.updateOne({ _id: user._id }, update);
    usersBackfilled += 1;
  }

  console.log(`[migrate:auth] ${user.email ?? user._id}: ${plan.account ? 'credential + ' : ''}backfill`);
}

console.log(
  `[migrate:auth] done — ${accountsCreated} credential account(s), ${usersBackfilled} user doc(s) updated, ${skipped} already migrated.`,
);
await client.close();
