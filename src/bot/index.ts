import { Telegraf } from 'telegraf';
import { config } from '../config';
import { logger } from '../utils/logger';
import { trackUser } from './handlers/userTracking';
import { handleForumTopicCreated, handleForumTopicEdited } from './handlers/topicEvents';
import { handleIncomingFile } from './handlers/fileEvents';
import { startCommand } from './commands/start';
import { searchCommand, plainTextSearchHandler } from './commands/search';
import { adminCommand, syncCommand, statsCommand } from './commands/admin';
import { callbackRouter } from './callbacks/callbackRouter';

export function createBot(): Telegraf {
  const bot = new Telegraf(config.botToken);

  bot.use(trackUser);

  // ---- Commands ----
  bot.start(startCommand);
  bot.command('search', searchCommand);
  bot.command('admin', adminCommand);
  bot.command('sync', syncCommand);
  bot.command('stats', statsCommand);

  // ---- Callback buttons ----
  bot.on('callback_query', callbackRouter);

  // ---- Messages from the archive group: topic + file discovery ----
  bot.on('message', async (ctx, next) => {
    const msg: any = ctx.message;

    if (msg.forum_topic_created) {
      await handleForumTopicCreated(ctx);
      return;
    }
    if (msg.forum_topic_edited) {
      await handleForumTopicEdited(ctx);
      return;
    }

    // File posted inside a topic in the archive group
    if (ctx.chat?.id === config.archiveGroupId) {
      await handleIncomingFile(ctx);
      return;
    }

    return next();
  });

  // Plain-text search convenience, only reached for private-chat text
  // messages that weren't consumed by the archive-group branch above.
  bot.on('text', plainTextSearchHandler);

  bot.catch((err, ctx) => {
    logger.error('Unhandled bot error', { err, updateType: ctx.updateType });
  });

  return bot;
}
