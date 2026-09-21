import { Context, MiddlewareFn } from 'telegraf';
import { User } from '../../database/models/User';
import { logger } from '../../utils/logger';

export const trackUser: MiddlewareFn<Context> = async (ctx, next) => {
  const from = ctx.from;
  if (from && !from.is_bot) {
    User.findOneAndUpdate(
      { telegramUserId: from.id },
      {
        $set: { username: from.username, firstName: from.first_name, lastSeenAt: new Date() },
        $setOnInsert: { telegramUserId: from.id },
      },
      { upsert: true }
    ).catch((err) => logger.error('trackUser failed', { err }));
  }
  return next();
};
