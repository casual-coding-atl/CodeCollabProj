// Seed a deterministic E2E test user (and a sample project) into MONGODB_URI.
// Idempotent — safe to run repeatedly. Used by CI before Playwright.
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

const User = mongoose.model('User', new mongoose.Schema({}, { collection: 'users', strict: false }));
const Project = mongoose.model('Project', new mongoose.Schema({}, { collection: 'projects', strict: false }));
const Notification = mongoose.model(
  'Notification',
  new mongoose.Schema({}, { collection: 'notifications', strict: false }),
);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

async function upsertUser(email, username, password) {
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
    },
    { upsert: true },
  );
  return User.findOne({ email });
}

const user = await upsertUser(EMAIL, USERNAME, PASSWORD);
const user2 = await upsertUser(EMAIL2, USERNAME2, PASSWORD2);

// Deterministic notifications: clear anything from previous runs for both users.
await Notification.deleteMany({ userId: { $in: [user._id, user2._id] } });

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

console.log(`seeded E2E users ${EMAIL} + ${EMAIL2} and project "${TITLE}"`);
await mongoose.disconnect();
