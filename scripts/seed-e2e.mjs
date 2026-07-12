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

const User = mongoose.model('User', new mongoose.Schema({}, { collection: 'users', strict: false }));
const Project = mongoose.model('Project', new mongoose.Schema({}, { collection: 'projects', strict: false }));

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

const hash = await bcrypt.hash(PASSWORD, 10);
await User.updateOne(
  { email: EMAIL },
  {
    $set: {
      email: EMAIL,
      username: USERNAME,
      password: hash,
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
const user = await User.findOne({ email: EMAIL });

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

console.log(`seeded E2E user ${EMAIL} and project "${TITLE}"`);
await mongoose.disconnect();
