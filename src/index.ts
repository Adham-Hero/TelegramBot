import { connectDatabase } from './database/connection';
import { createBot } from './bot';
import { logger } from './utils/logger';

async function main() {
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