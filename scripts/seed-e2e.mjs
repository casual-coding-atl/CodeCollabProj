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

async function upsertLegacyUser(email, username, password) {
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

// Drop every Better Auth artefact belonging to the seeded members: their
// credential rows (so the migration re-creates them from the legacy hash),
// their sessions (so each run starts signed out) and their passkeys.
const ids = [user._id, user2._id];
const idStrings = ids.map(String);
await Account.deleteMany({ userId: { $in: [...ids, ...idStrings] } });
await AuthSession.deleteMany({ userId: { $in: [...ids, ...idStrings] } });
await Passkey.deleteMany({ userId: { $in: [...ids, ...idStrings] } });
await Verification.deleteMany({});

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
    },
  },
  { upsert: true },
);

console.log(
  `seeded pre-migration E2E users ${EMAIL} + ${EMAIL2} (${throwaway.length} throwaway account(s) removed) and project "${TITLE}"`,
);
await mongoose.disconnect();
