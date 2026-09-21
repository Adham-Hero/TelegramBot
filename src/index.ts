import { connectDatabase, disconnectDatabase } from './database/connection';
import { createBot } from './bot';
import { logger } from './utils/logger';

async function bootstrap() {
  // 1. الاتصال بقاعدة البيانات
  await connectDatabase();

  // 2. إنشاء وتشغيل البوت
  const bot = await createBot();
  await bot.launch();
  logger.info('Bot launched in polling mode');

  // 3. معالجة الإيقاف الآمن للتطبيق (Graceful Shutdown)
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      bot.stop(signal);
      if (typeof disconnectDatabase === 'function') {
        await disconnectDatabase();
      }
      logger.info('Cleanup complete. Exiting process.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', { err });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

// 4. التقاط الأخطاء غير المعالجة على مستوى النظام
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown', { err: err.message, stack: err.stack });
  process.exit(1);
});

// 5. بدء تنفيذ التطبيق
bootstrap().catch((err) => {
  logger.error('Fatal startup error', {
    err: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});