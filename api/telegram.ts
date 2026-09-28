import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Telegraf } from 'telegraf';
import mongoose from 'mongoose';

/**
 * The app modules are loaded lazily (dynamic import) instead of at the top
 * of the file. src/config throws if a required environment variable is
 * missing; with a static import that would crash the whole function before
 * any code here could run, and you'd only see a generic Vercel 500. Loading
 * lazily lets us report exactly what is wrong (see GET ?check=1) and lets
 * the POST path log it clearly.
 */
type App = {
  connectDatabase: typeof import('../src/database/connection').connectDatabase;
  createBot: typeof import('../src/bot').createBot;
  ProcessedUpdate: typeof import('../src/database/models/ProcessedUpdate').ProcessedUpdate;
  logger: typeof import('../src/utils/logger').logger;
};

let appPromise: Promise<App> | null = null;

function loadApp(): Promise<App> {
  if (!appPromise) {
    appPromise = (async () => {
      const [{ connectDatabase }, { createBot }, { ProcessedUpdate }, { logger }] = await Promise.all([
        import('../src/database/connection'),
        import('../src/bot'),
        import('../src/database/models/ProcessedUpdate'),
        import('../src/utils/logger'),
      ]);
      return { connectDatabase, createBot, ProcessedUpdate, logger };
    })().catch((err) => {
      appPromise = null; // allow a retry on the next invocation
      throw err;
    });
  }
  return appPromise;
}

// One bot per warm instance -> handlers registered exactly once.
let botReady: Promise<Telegraf> | null = null;

function getBot(app: App): Promise<Telegraf> {
  if (!botReady) {
    botReady = (async () => {
      const b = app.createBot();
      try {
        b.botInfo = await b.telegram.getMe();
      } catch (err: any) {
        app.logger.warn('getMe pre-fetch failed', { message: err?.message });
      }
      return b;
    })();
  }
  return botReady;
}

const REQUIRED_ENV = ['BOT_TOKEN', 'ADMIN_ID', 'ARCHIVE_GROUP_ID', 'MONGODB_URI'];

/** Removes anything that looks like a connection string from an error message. */
function safeMessage(err: any): string {
  return String(err?.message ?? err).replace(/mongodb(\+srv)?:\/\/\S+/gi, '<mongodb-uri>').slice(0, 300);
}

/**
 * Always answers 200 to Telegram's POSTs, whatever happens internally:
 * a non-200 makes Telegram redeliver the same update, which re-runs every
 * side effect (duplicate messages). Errors are logged instead. The
 * ProcessedUpdate guard additionally skips any update_id seen before.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Diagnostics: open /api/telegram?check=1 in a browser. Reports only
    // yes/no facts and error names - never any secret values.
    if (req.query?.check) {
      const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k] || process.env[k]!.trim() === '');
      const result: Record<string, unknown> = {
        ok: false,
        missingEnv,
        webhookSecretConfigured: Boolean(process.env.WEBHOOK_SECRET),
      };
      if (missingEnv.length === 0) {
        try {
          const app = await loadApp();
          await app.connectDatabase();
          await mongoose.connection.db!.admin().ping();
          result.mongo = 'ok';
          result.ok = true;
        } catch (err: any) {
          result.mongo = `error: ${safeMessage(err)}`;
        }
      }
      return res.status(200).json(result);
    }

    if (req.query?.warm) {
      try {
        const app = await loadApp();
        await Promise.all([app.connectDatabase(), getBot(app)]);
        return res.status(200).json({ ok: true, warm: true });
      } catch (err: any) {
        console.error('Warm-up failed:', safeMessage(err));
        return res.status(200).json({ ok: false, warm: false });
      }
    }

    return res.status(200).json({ ok: true, service: 'telegram-archive-bot', mode: 'webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Optional shared secret: Telegram echoes the secret_token given to
  // setWebhook in this header. If WEBHOOK_SECRET is set here it MUST match
  // the one used when running `npm run set-webhook`, otherwise every real
  // update is rejected with 401 and the bot appears completely dead.
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    console.warn('Rejected webhook request: missing/invalid secret token (does WEBHOOK_SECRET match set-webhook?)');
    return res.status(401).json({ ok: false });
  }

  const update = req.body;
  const updateId = typeof update?.update_id === 'number' ? update.update_id : undefined;

  try {
    const app = await loadApp();
    const { logger } = app;
    const [, botInstance] = await Promise.all([app.connectDatabase(), getBot(app)]);

    if (updateId !== undefined) {
      try {
        await app.ProcessedUpdate.create({ updateId });
      } catch (dedupeErr: any) {
        if (dedupeErr?.code === 11000) {
          logger.warn('Duplicate Telegram update ignored', { updateId });
          return res.status(200).json({ ok: true, duplicate: true });
        }
        logger.error('Dedupe check failed, processing update anyway', { updateId, message: safeMessage(dedupeErr) });
      }
    }

    await botInstance.handleUpdate(update);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Telegram webhook error:', { updateId, message: safeMessage(err), stack: err?.stack });
    return res.status(200).json({ ok: false, error: 'handled_internally' });
  }
}
