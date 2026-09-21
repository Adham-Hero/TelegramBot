import { connectDatabase } from './database/connection';
import { createBot } from './bot';
import { config } from './config';
import { logger } from './utils/logger';

async function main() {
  await connectDatabase();
  const bot = await createBot();

  if (config.botMode === 'webhook') {
    if (!config.webhookDomain) {
      throw new Error('BOT_MODE=webhook requires WEBHOOK_DOMAIN to be set in .env');
    }
    await bot.launch({
      webhook: {
        domain: config.webhookDomain,
        port: config.webhookPort,
      },
    });
    logger.info(`Bot launched in webhook mode on port ${config.webhookPort}`);
  } else {
    await bot.launch();
    logger.info('Bot launched in polling mode');
  }

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
