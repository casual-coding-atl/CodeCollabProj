// Seed a deterministic E2E test user (and a sample project) into MONGODB_URI.
// Idempotent — safe to run repeatedly. Used by CI before Playwright.
//
// The seeded members are written in their PRE-migration shape: the bcrypt hash
// lives in a legacy `password` field on the user doc, with none of the fields
// Better Auth expects (`name`, `emailVerified`) and no `account` row. The E2E
// global setup then runs `npm run migrate:auth` before the suite, so every run
// exercises the real migration path and signs in with a password that was only
// ever hashed by the old stack (PRD #88's testing decision).
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}
const EMAIL = process.env.E2E_EMAIL || 'e2e@codecollab.test';
const USERNAME = process.env.E2E_USERNAME || 'e2e_user';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e-password-123';
// A second user, used as the "requester" in collaboration/notification flows.
const EMAIL2 = process.env.E2E_EMAIL2 || 'e2e2@codecollab.test';
const USERNAME2 = process.env.E2E_USERNAME2 || 'e2e_user_two';
const PASSWORD2 = process.env.E2E_PASSWORD2 || 'e2e-password-123';
// A third user, suspended, so the suite can prove moderation still keeps
// somebody out after the migration — the story the whole cutover risks.
const EMAIL_SUSPENDED = process.env.E2E_EMAIL_SUSPENDED || 'e2e-suspended@codecollab.test';
const USERNAME_SUSPENDED = process.env.E2E_USERNAME_SUSPENDED || 'e2e_user_suspended';
const PASSWORD_SUSPENDED = process.env.E2E_PASSWORD_SUSPENDED || 'e2e-password-123';
const SUSPENSION_REASON = 'Suspended for end-to-end tests';

/** Accounts the registration spec creates; cleared so they can't pile up. */
const THROWAWAY_EMAIL = /^e2e-register-/;

const collection = (name) =>
  mongoose.model(name, new mongoose.Schema({}, { collection: name, strict: false }), name);

const User = mongoose.model('User', new mongoose.Schema({}, { collection: 'users', strict: false }));
const Project = mongoose.model('Project', new mongoose.Schema({}, { collection: 'projects', strict: false }));
const Notification = mongoose.model(
  'Notification',
  new mongoose.Schema({}, { collection: 'notifications', strict: false }),
);
const Message = mongoose.model(
  'Message',
  new mongoose.Schema({}, { collection: 'messages', strict: false, timestamps: true }),
);
// Better Auth's own collections.
const Account = collection('account');
const AuthSession = collection('session');
const Passkey = collection('passkey');
const Verification = collection('verification');

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

/**
 * This script deletes accounts, sessions, passkeys and notifications. Pointed at
 * the wrong database — a stale MONGODB_URI in a shell, a copy-pasted production
 * string — it would do that to real members. So it refuses to touch a database
 * whose name doesn't say it is for E2E, and the check happens after connecting
 * (so it sees the name the server actually resolved) but before the first write.
 *
 * E2E_ALLOW_DB=1 is the deliberate override, for a differently-named scratch DB.
 */
const dbName = mongoose.connection.name;
if (!/e2e/i.test(dbName || '') && process.env.E2E_ALLOW_DB !== '1') {
  console.error(
    `Refusing to seed "${dbName}": this script deletes data and the database name does not look like an E2E one.\n` +
      'Point MONGODB_URI at a database whose name contains "e2e", or set E2E_ALLOW_DB=1 if you are certain.',
  );
  await mongoose.disconnect();
  process.exit(1);
}

async function upsertLegacyUser(email, username, password, extra = {}) {
  const h = await bcrypt.hash(password, 10);
  await User.updateOne(
    { email },
    {
      $set: {
        email,
        username,
        password: h,
        role: 'user',
        permissions: ['project:create'],
        isActive: true,
        isSuspended: false,
        isEmailVerified: true,
        isProfilePublic: true,
        ...extra,
      },
      // Undo a previous run's migration so this run starts pre-migration again.
      $unset: { name: '', emailVerified: '' },
    },
    { upsert: true },
  );
  return User.findOne({ email });
}

const user = await upsertLegacyUser(EMAIL, USERNAME, PASSWORD);
const user2 = await upsertLegacyUser(EMAIL2, USERNAME2, PASSWORD2);
// Suspended indefinitely (no `suspendedUntil`), in the same pre-migration shape
// as the others — so the suite proves a suspended member is refused a session
// through the migrated credential, not through some legacy leftover.
const suspendedUser = await upsertLegacyUser(
  EMAIL_SUSPENDED,
  USERNAME_SUSPENDED,
  PASSWORD_SUSPENDED,
  { isSuspended: true, suspensionReason: SUSPENSION_REASON },
);

// Drop every Better Auth artefact belonging to the seeded members: their
// credential rows (so the migration re-creates them from the legacy hash),
// their sessions (so each run starts signed out) and their passkeys.
const ids = [user._id, user2._id, suspendedUser._id];
const idStrings = ids.map(String);
await Account.deleteMany({ userId: { $in: [...ids, ...idStrings] } });
await AuthSession.deleteMany({ userId: { $in: [...ids, ...idStrings] } });
await Passkey.deleteMany({ userId: { $in: [...ids, ...idStrings] } });

// Verification rows are keyed by an `identifier` that embeds either the email or
// the user id (`reset-password:<id>`, an address for email verification). Only
// the seeded members' rows go — this used to be an unscoped deleteMany({}), which
// on any shared database would have invalidated other people's live reset links.
const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const seededIdentifiers = [EMAIL, EMAIL2, EMAIL_SUSPENDED, ...idStrings];
await Verification.deleteMany({
  identifier: { $regex: seededIdentifiers.map(escape).join('|') },
});

// Members created by the registration spec on earlier runs, with everything
// Better Auth wrote for them.
const throwaway = await User.find({ email: THROWAWAY_EMAIL }, { _id: 1 });
if (throwaway.length > 0) {
  const staleIds = throwaway.map((u) => u._id);
  const staleIdStrings = staleIds.map(String);
  await Account.deleteMany({ userId: { $in: [...staleIds, ...staleIdStrings] } });
  await AuthSession.deleteMany({ userId: { $in: [...staleIds, ...staleIdStrings] } });
  await Passkey.deleteMany({ userId: { $in: [...staleIds, ...staleIdStrings] } });
  await User.deleteMany({ _id: { $in: staleIds } });
}

// Deterministic notifications: clear anything from previous runs for both users.
await Notification.deleteMany({ userId: { $in: ids } });

// One message in the first member's inbox, so the delete-confirmation spec has
// something to delete instead of skipping itself.
const MESSAGE_SUBJECT = 'E2E seeded message';
await Message.updateOne(
  { subject: MESSAGE_SUBJECT },
  {
    $set: {
      subject: MESSAGE_SUBJECT,
      content: 'A message seeded for end-to-end tests.',
      sender: user2._id,
      recipient: user._id,
      read: false,
    },
  },
  { upsert: true },
);

// Linked Repositories pointing at the GitHub API fixture server
// (e2e/fixtures/github-api.mjs), one per state a repo card can be in: a repo
// that resolves, one GitHub answers 404 for, and one behind a rate limit.
const LINKED_REPOS = [
  { repoId: 9001, owner: 'e2e-org', name: 'codecollab-web', linkedAt: new Date() },
  { repoId: 9002, owner: 'e2e-org', name: 'gone-repo', linkedAt: new Date() },
  { repoId: 9003, owner: 'e2e-org', name: 'rate-limited-repo', linkedAt: new Date() },
];

const TITLE = 'E2E Sample Project';
await Project.updateOne(
  { title: TITLE },
  {
    $set: {
      title: TITLE,
      description: 'A project seeded for end-to-end tests.',
      status: 'planning',
      owner: user._id,
      technologies: ['TypeScript'],
      tags: ['e2e'],
      collaborators: [],
      linkedRepos: LINKED_REPOS,
    },
  },
  { upsert: true },
);

// A second project, linking a repository that is private by the time anybody
// asks about it — the "linked, then made private" case. It lives on its own
// project so the sample project keeps exactly three cards for the spec that
// counts them.
const PRIVATE_TITLE = 'E2E Private Repo Project';
await Project.updateOne(
  { title: PRIVATE_TITLE },
  {
    $set: {
      title: PRIVATE_TITLE,
      description: 'A project whose linked repository went private.',
      status: 'planning',
      owner: user._id,
      technologies: ['TypeScript'],
      tags: ['e2e'],
      collaborators: [],
      linkedRepos: [
        { repoId: 9004, owner: 'e2e-org', name: 'private-repo', linkedAt: new Date() },
      ],
    },
  },
  { upsert: true },
);

// A third project with no linked repositories, used by the evaluation E2E spec
// to assert that the Reality Check finding is absent and no evidence section
// reaches the Claude fixture when there are no repos.
const NO_REPOS_TITLE = 'E2E No-Repos Project';
await Project.updateOne(
  { title: NO_REPOS_TITLE },
  {
    $set: {
      title: NO_REPOS_TITLE,
      description: 'A project with no linked repositories, seeded for evaluation E2E tests.',
      status: 'planning',
      owner: user._id,
      technologies: ['JavaScript'],
      tags: ['e2e'],
      collaborators: [],
      linkedRepos: [],
    },
  },
  { upsert: true },
);

// Anything the server cached from GitHub on a previous run, so a fixture that
// has since changed cannot be served out of a day-old cache entry.
await collection('github_cache').deleteMany({});

console.log(
  `seeded pre-migration E2E users ${EMAIL} + ${EMAIL2} + ${EMAIL_SUSPENDED} (suspended) ` +
    `(${throwaway.length} throwaway account(s) removed) and projects "${TITLE}", "${NO_REPOS_TITLE}"`,
);
await mongoose.disconnect();
