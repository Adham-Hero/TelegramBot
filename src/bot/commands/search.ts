import { Context } from 'telegraf';
import { runSearch } from '../handlers/render';

export async function searchCommand(ctx: Context) {
  const text = (ctx.message as any)?.text as string | undefined;
  const query = text?.split(' ').slice(1).join(' ').trim();

  if (!query) {
    await ctx.reply('استخدم الأمر هكذا:\n/search Anatomy\nأو أرسل كلمة البحث مباشرة في رسالة.');
    return;
  }

  await runSearch(ctx, query, 1);
}

/** Lets people just type a word in a private chat with the bot instead of typing /search every time. */
export async function plainTextSearchHandler(ctx: Context) {
  const text = (ctx.message as any)?.text as string | undefined;
  if (!text || text.startsWith('/')) return;
  if (ctx.chat?.type !== 'private') return; // never treat group chatter as a search
  await runSearch(ctx, text.trim(), 1);
}
