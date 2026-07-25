// One-off, idempotent migration onto Better Auth (ADR 0002).
//
// A default run is PURELY ADDITIVE — it never removes anything:
//   - reports the email/username pathologies that will bite after cutover
//     (read-only, before a single write);
//   - creates the indexes Better Auth's hot paths need;
//   - upserts a `credential` row in the `account` collection carrying each
//     member's existing bcrypt hash, so nobody has to reset a password;
//   - backfills the fields Better Auth expects (`name`, `emailVerified`,
//     `createdAt`, `updatedAt`).
//
// Because it leaves the legacy `password` field on the user doc, it is safe to
// run BEFORE deploying the auth switch: the still-live legacy sign-in keeps
// working off that field, and rolling back is just redeploying the old code.
//
//   MONGODB_URI=... npm run migrate:auth              # additive, safe pre-deploy
//   MONGODB_URI=... npm run migrate:auth -- --dry-run # report + plan, no writes
//
// ⚠ AFTER the new sign-in is deployed AND verified in production, and only
// then, a second pass drops the legacy hash from the user docs:
//
//   MONGODB_URI=... npm run migrate:auth -- --cleanup
//
// Past that point the hashes live only in `account`, so rolling back to the
// legacy sign-in is no longer possible. Do not run it in the same maintenance
// window as the deploy.
//
// The legacy `sessions` collection is left alone (retired, drop it after
// verifying) — every member signs in once after deploy.
//
// The per-user transform lives in src/server/auth-migration.ts (unit-tested);
// this file is only the Mongo plumbing. Node strips the TypeScript on import
// (Node >= 22.6 with --experimental-strip-types, default from 22.18).
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { planUserMigration, reportDataPathologies } from '../src/server/auth-migration.ts';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('MONGODB_URI is required — refusing to run.');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const cleanup = process.argv.includes('--cleanup');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db();
const users = db.collection('users');
const accounts = db.collection('account');
const sessions = db.collection('session');

const mode = cleanup ? 'CLEANUP (drops legacy password field) — ' : '';
console.log(`[migrate:auth] ${dryRun ? 'DRY RUN — ' : ''}${mode}${db.databaseName}`);
if (cleanup && !dryRun) {
  console.log(
    '[migrate:auth] ⚠ cleanup removes the legacy `password` field. Only run this once the new sign-in is verified in production — afterwards you cannot roll back to the legacy sign-in.',
  );
}

// ── 1. read-only pathology report ────────────────────────────────────────────
// Better Auth looks members up by lowercased email and treats it as unique, and
// the app treats usernames as case-insensitively unique. Legacy data guarantees
// neither. Report before touching anything, so the operator can abort.
const report = reportDataPathologies(
  await users.find({}, { projection: { email: 1, username: 1 } }).toArray(),
);
console.log(`[migrate:auth] ${report.total} user doc(s) scanned.`);
if (report.clean) {
  console.log('[migrate:auth] pre-flight: no email or username pathologies.');
} else {
  const show = (list) => list.slice(0, 20).map(String).join(', ') + (list.length > 20 ? ', …' : '');
  if (report.missingEmail.length)
    console.warn(
      `[migrate:auth] ⚠ ${report.missingEmail.length} user(s) with no email — they cannot sign in with Better Auth: ${show(report.missingEmail)}`,
    );
  if (report.nonLowercaseEmail.length)
    console.warn(
      `[migrate:auth] ⚠ ${report.nonLowercaseEmail.length} email(s) not lowercased — Better Auth normalises the address it looks up, so these members will fail sign-in until the stored value is lowercased: ${show(report.nonLowercaseEmail)}`,
    );
  if (report.duplicateEmails.length)
    console.warn(
      `[migrate:auth] ⚠ ${report.duplicateEmails.length} email(s) duplicated once lowercased — only one of each pair will ever be found: ${show(report.duplicateEmails.map((d) => `${d.email} ×${d.count}`))}`,
    );
  if (report.missingUsername.length)
    console.warn(
      `[migrate:auth] ⚠ ${report.missingUsername.length} user(s) with no username: ${show(report.missingUsername)}`,
    );
  if (report.duplicateUsernames.length)
    console.warn(
      `[migrate:auth] ⚠ ${report.duplicateUsernames.length} username(s) duplicated case-insensitively — sign-up now rejects these, and a unique index cannot be added until they are resolved: ${show(report.duplicateUsernames.map((d) => `${d.username} ×${d.count}`))}`,
    );
}

// ── 2. indexes ───────────────────────────────────────────────────────────────
// Created before the loop: the partial unique index on `account` is what makes
// the credential upsert below safe to run twice at once (a losing racer gets a
// duplicate-key error instead of writing a second row).
//
// The uniqueness is scoped per provider on purpose — each of these states one
// invariant, and nothing constrains providers this app does not use.
//
// The two GitHub ones close a gap Better Auth leaves open: its link callback
// looks for an existing account row and then inserts one, with nothing in
// between. Two requests interleaving there can attach the same GitHub identity
// to two members, and a member can end up with a second GitHub row that a
// disconnect (which deletes one) would leave behind, still holding a live
// token. A Linked GitHub Account is one-per-member and one-member-per-identity
// (CONTEXT.md); only an index can actually say so.
const indexes = [
  [
    accounts,
    { userId: 1, providerId: 1 },
    {
      name: 'credential_per_user_unique',
      unique: true,
      partialFilterExpression: { providerId: 'credential' },
    },
  ],
  [
    accounts,
    { userId: 1, providerId: 1 },
    {
      name: 'github_per_user_unique',
      unique: true,
      partialFilterExpression: { providerId: 'github' },
    },
  ],
  [
    accounts,
    { providerId: 1, accountId: 1 },
    {
      name: 'github_identity_unique',
      unique: true,
      partialFilterExpression: { providerId: 'github' },
    },
  ],
  [sessions, { token: 1 }, { name: 'session_token_unique', unique: true }],
  [sessions, { userId: 1 }, { name: 'session_userId' }],
  [sessions, { expiresAt: 1 }, { name: 'session_expiresAt' }],
  [users, { email: 1 }, { name: 'users_email' }],
];

if (dryRun) {
  console.log(`[migrate:auth] would ensure ${indexes.length} index(es).`);
} else {
  for (const [collection, keys, options] of indexes) {
    try {
      await collection.createIndex(keys, options);
      console.log(`[migrate:auth] index ${collection.collectionName}.${options.name} ok`);
    } catch (e) {
      // A unique index over data that already violates it is a finding, not a
      // reason to abandon the run — the account backfill still has to happen.
      console.warn(
        `[migrate:auth] ⚠ could not create ${collection.collectionName}.${options.name}: ${e.message}`,
      );
    }
  }
}

// ── 3. per-user backfill ─────────────────────────────────────────────────────
let accountsCreated = 0;
let accountsRepaired = 0;
let usersBackfilled = 0;
let passwordsDropped = 0;
let skipped = 0;

const cursor = users.find({});
for await (const user of cursor) {
  const credentialAccount = await accounts.findOne({
    userId: user._id,
    providerId: 'credential',
  });

  const plan = planUserMigration(user, { now: new Date(), credentialAccount, cleanup });
  if (!plan.changed) {
    skipped += 1;
    continue;
  }

  if (plan.account) {
    // Upsert, not insert: idempotent, and safe if two runs overlap.
    const { userId, providerId, password, createdAt, updatedAt, accountId } = plan.account;
    if (!dryRun) {
      await accounts.updateOne(
        { userId, providerId },
        {
          $set: { accountId, password, updatedAt },
          $setOnInsert: { createdAt },
        },
        { upsert: true },
      );
    }
    if (plan.accountRepair) accountsRepaired += 1;
    else accountsCreated += 1;
  }

  const update = {};
  if (Object.keys(plan.set).length > 0) update.$set = plan.set;
  if (plan.unset.length > 0) {
    update.$unset = Object.fromEntries(plan.unset.map((field) => [field, '']));
    passwordsDropped += 1;
  }
  if (Object.keys(update).length > 0) {
    if (!dryRun) await users.updateOne({ _id: user._id }, update);
    usersBackfilled += 1;
  }

  const what = [
    plan.accountRepair ? 'credential repair' : plan.account ? 'credential' : null,
    Object.keys(plan.set).length > 0 ? 'backfill' : null,
    plan.unset.length > 0 ? 'drop legacy password' : null,
  ].filter(Boolean);
  console.log(`[migrate:auth] ${user.email ?? user._id}: ${what.join(' + ')}`);
}

console.log(
  `[migrate:auth] done — ${accountsCreated} credential account(s) created, ${accountsRepaired} repaired, ${usersBackfilled} user doc(s) updated, ${passwordsDropped} legacy password field(s) dropped, ${skipped} already migrated.`,
);
if (!cleanup) {
  console.log(
    '[migrate:auth] legacy `password` fields left in place — rollback is still possible. Run with --cleanup once the new sign-in is verified in production.',
  );
}
await client.close();
