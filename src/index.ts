/**
 * SAFETY NET - this file must never start the bot or poll.
 *
 * Vercel auto-detects `src/index.ts` as a server entrypoint and runs it. An
 * older version of this project used this exact path for the local polling
 * entrypoint, and if that old copy is still deployed, Telegraf's
 * `bot.launch()` deletes the webhook and crashes. This stub replaces it: it
 * simply serves the webhook handler, so even if Vercel picks this file as the
 * entrypoint, the behaviour is correct (no polling, no webhook deletion).
 *
 * The real local polling entrypoint is `src/local.ts` (npm run dev / start).
 */
import handler from '../api/telegram';

export default handler;
