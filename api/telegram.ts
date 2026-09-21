import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDatabase } from '../src/database/connection';
import { createBot } from '../src/bot';
import { logger } from '../src/utils/logger';

let bot: ReturnType<typeof createBot> | null = null;

function getBot(): ReturnType<typeof createBot> {
  if (!bot) {
    bot = createBot();
  }

  return bot;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'telegram-archive-bot',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    await connectDatabase();

    const botInstance = getBot();

    await botInstance.handleUpdate(req.body);

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    logger.error('Telegram webhook error', {
      err: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
}
