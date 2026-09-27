import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDatabase } from '../src/database/connection';
import { createBot } from '../src/bot';
import { ProcessedUpdate } from '../src/database/models/ProcessedUpdate';
import { logger } from '../src/utils/logger';
import type { Telegraf } from 'telegraf';

// Module-level singleton: on a WARM invocation this module is not
// re-evaluated, so `bot` stays set and handlers are registered exactly
// once for the lifetime of this function instance. A cold start gets a
// fresh module (and a fresh, single registration) - never duplicated.
let bot: Telegraf | null = null;

function getBot(): Telegraf {
  if (!bot) {
    bot = createBot();
  }
  return bot;
}

/**
 * IMPORTANT: this handler ALWAYS responds with HTTP 200 to Telegram,
 * whatever happens internally (success, a handled error, or an unexpected
 * crash). This is deliberate, not an oversight:
 *
 * Telegram's webhook delivery retries automatically whenever it doesn't
 * get a fast 200 response - and a retry means the ENTIRE update is
 * reprocessed from scratch. If our handler throws and we answer with a
 * 500 (as this endpoint used to), Telegram queues the exact same update
 * for redelivery, which re-runs every side effect (sending a file,
 * posting a message, etc.) again - this is what caused the bot to appear
 * to "randomly" send duplicate/repeated messages. Errors are still fully
 * logged server-side; they're just never turned into a reason for
 * Telegram to retry.
 *
 * The ProcessedUpdate guard below is the second, independent layer: even
 * if a redelivery ever does happen (network hiccup, Telegram-side retry
 * before our 200 was received, etc.), it's detected and skipped instead
 * of being processed twice.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple health check - lets you confirm the deployment is live by just
  // opening the URL in a browser, and is what `set-webhook.ts` uses to
  // sanity-check the target before registering it with Telegram.
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'telegram-archive-bot', mode: 'webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Optional but recommended: if WEBHOOK_SECRET is set, only accept
  // requests that carry the matching secret Telegram attaches when you
  // register the webhook with a secret_token (see scripts/set-webhook.ts).
  // This stops anyone who finds/guesses your URL from POSTing fake
  // "Telegram updates" straight at your bot.
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = req.headers['x-telegram-bot-api-secret-token'];
    if (provided !== expectedSecret) {
      logger.warn('Rejected webhook request with invalid/missing secret token');
      // Still fine to use a non-200 here - this request never came from
      // Telegram in the first place, so there's no legitimate update for
      // Telegram itself to retry.
      return res.status(401).json({ ok: false });
    }
  }

  const update = req.body;
  const updateId = typeof update?.update_id === 'number' ? update.update_id : undefined;

  try {
    await connectDatabase();

    if (updateId !== undefined) {
      try {
        await ProcessedUpdate.create({ updateId });
      } catch (dedupeErr: any) {
        if (dedupeErr?.code === 11000) {
          // Duplicate key = we've already processed this exact update_id.
          // This is a Telegram retry of something we already handled -
          // acknowledge and stop here WITHOUT running the handler again.
          logger.warn('Duplicate Telegram update ignored', { updateId });
          return res.status(200).json({ ok: true, duplicate: true });
        }
        // Dedupe bookkeeping itself failed for some other reason (e.g. a
        // transient Mongo error). Log it and continue processing anyway -
        // a rare duplicate is a much smaller problem than silently
        // dropping a legitimate update.
        logger.error('Dedupe check failed, processing update anyway', {
          updateId,
          message: dedupeErr?.message,
        });
      }
    }

    await getBot().handleUpdate(update);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    logger.error('Telegram webhook error', {
      updateId,
      message: err?.message,
      // Stack traces are fine to log (they never contain secrets), but we
      // deliberately never log req.body in full or any env var values.
      stack: err?.stack,
    });
    // See the big comment above `handler`: always 200, never 500, so
    // Telegram doesn't queue this update for a retry.
    return res.status(200).json({ ok: false, error: 'handled_internally' });
  }
}
