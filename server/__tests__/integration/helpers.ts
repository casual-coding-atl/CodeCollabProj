// Integration test harness: a real in-memory MongoDB plus the real Express auth
// router (real controllers, models, middleware, sessionService). Nothing about the
// behavior under test is mocked; email delivery is disabled through the app's own
// SKIP_EMAIL_VERIFICATION flag rather than a mock.
import express, { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const cookieParser = require('cookie-parser');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-characters-long';
process.env.SKIP_EMAIL_VERIFICATION = 'true';

let mongod: MongoMemoryServer;

export async function startDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export function buildAuthApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', require('../../routes/auth'));
  return app;
}
