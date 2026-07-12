import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Single shared Mongoose connection for the whole server runtime.
 *
 * TanStack Start server functions can each execute independently, so we cache
 * the connection promise on `globalThis` to avoid opening a new pool per call
 * (and to survive dev HMR). Points at the SAME MongoDB the legacy Express
 * server uses — this migration is a transport change, not a data migration.
 */
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/codecollabproj';

interface GlobalWithMongoose {
  __ccpMongoose?: Promise<typeof mongoose>;
}
const g = globalThis as unknown as GlobalWithMongoose;

export function connectDB(): Promise<typeof mongoose> {
  if (!g.__ccpMongoose) {
    g.__ccpMongoose = mongoose.connect(MONGODB_URI).then((m) => {
      // eslint-disable-next-line no-console
      console.log('[web] MongoDB connected');
      return m;
    });
  }
  return g.__ccpMongoose;
}
