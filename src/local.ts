import { connectDatabase } from './database/connection';
import { createBot } from './bot';
import { logger } from './utils/logger';
import { config } from './config';

/**
 * LOCAL/POLLING ENTRYPOINT ONLY. This file is what `npm run dev` and
 * `npm start` run - it is NEVER used on Vercel (the deployed function is
 * api/telegram.ts, which handles webhook updates instead). Keeping this
 * clearly separate avoids ever having both a polling process AND a
 * webhook registered against the same bot at once, which Telegram itself
 * rejects with a 409 Conflict (polling's getUpdates fails loudly while a
 * webhook is set) - so run this only when BOT_MODE=polling.
 */
async function main() {
  if (config.botMode !== 'polling') {
    logger.error(
      'BOT_MODE is not "polling", but this is the local POLLING entrypoint (src/local.ts). ' +
        'Refusing to start polling: if a webhook is also registered with Telegram for this bot, ' +
        'running both at once causes conflicts. Set BOT_MODE=polling in your local .env for ' +
        'development, or test webhook mode locally with `vercel dev` instead of `npm run dev`/`npm start`.'
    );
    process.exit(1);
  }

  await connectDatabase();

  const bot = createBot();

  await bot.launch();

  logger.info('Bot launched in polling mode');

  // Graceful shutdown helper
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Stopping bot...`);
    try {
      await bot.stop(signal);
      logger.info('Bot stopped gracefully');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', {
        err: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', {
    err: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  process.exit(1);
});