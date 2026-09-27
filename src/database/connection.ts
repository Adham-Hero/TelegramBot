import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Serverless functions can get a fresh module instance per cold start, but
 * a WARM invocation reuses the same Node process/module cache as the last
 * one. Caching the connection promise on `global` (not just a local module
 * variable) means:
 *  - a warm invocation reuses the existing connection instead of opening a
 *    new one every single request (which was happening before - each
 *    request called `mongoose.connect()` again, re-registering listeners
 *    and risking exhausting MongoDB Atlas's connection limit under any
 *    real traffic, which shows up as random, hard-to-reproduce failures).
 *  - concurrent invocations that land on the same warm container await the
 *    SAME in-flight connection promise instead of racing to connect twice.
 */
declare global {
  // eslint-disable-next-line no-var
  var __mongooseConnPromise: Promise<typeof mongoose> | undefined;
  // eslint-disable-next-line no-var
  var __mongooseListenersAttached: boolean | undefined;
}

function attachListenersOnce() {
  if (global.__mongooseListenersAttached) return;
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', { message: err?.message }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  global.__mongooseListenersAttached = true;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  // Already connected on this warm instance - nothing to do.
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.set('strictQuery', true);
  attachListenersOnce();

  if (!global.__mongooseConnPromise) {
    global.__mongooseConnPromise = mongoose
      .connect(config.mongodbUri, {
        // Keep the pool small - a serverless function handles one request
        // at a time per instance, and Atlas free/shared tiers have a fairly
        // low total connection ceiling shared across ALL your functions.
        maxPoolSize: 5,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 20000,
        // Fail fast instead of silently queueing operations while
        // disconnected - we'd rather surface a clear error than hang until
        // the function times out.
        bufferCommands: false,
      })
      .catch((err) => {
        // Let the NEXT invocation retry a fresh connection instead of
        // permanently caching a rejected promise.
        global.__mongooseConnPromise = undefined;
        throw err;
      });
  }

  return global.__mongooseConnPromise;
}

/** Only used by the local polling entrypoint's graceful shutdown - never called from the Vercel function. */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  global.__mongooseConnPromise = undefined;
}
