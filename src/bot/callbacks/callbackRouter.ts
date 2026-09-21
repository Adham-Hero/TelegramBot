import { Context } from 'telegraf';
import { decodeCallback } from '../../utils/callbackData';
import { renderHome, renderNode, renderFile, renderSearchPage } from '../handlers/render';
import { isAdmin, sendSyncResult, sendStats, sendUncategorized } from '../commands/admin';
import { adminMenuKeyboard } from '../keyboards/keyboards';
import { logger } from '../../utils/logger';

export async function callbackRouter(ctx: Context) {
  const data = (ctx.callbackQuery as any)?.data as string | undefined;
  if (!data) return;

  if (data === 'noop') {
    await ctx.answerCbQuery().catch(() => undefined);
    return;
  }

  try {
    const decoded = decodeCallback(data);

    switch (decoded.action) {
      case 'home':
        await renderHome(ctx);
        return;

      case 'node':
        if (!decoded.id) return;
        await renderNode(ctx, decoded.id, decoded.page ?? 1);
        return;

      case 'file':
        if (!decoded.id) return;
        await renderFile(ctx, decoded.id);
        return;

      case 'search_page':
        await renderSearchPage(ctx, decoded.page ?? 1);
        return;

      case 'admin_menu':
        if (!isAdmin(ctx)) return ctx.answerCbQuery('غير مصرح.', { show_alert: true });
        await ctx.editMessageText('⚙️ لوحة تحكم الأدمن', adminMenuKeyboard());
        await ctx.answerCbQuery().catch(() => undefined);
        return;

      case 'admin_sync':
        if (!isAdmin(ctx)) return ctx.answerCbQuery('غير مصرح.', { show_alert: true });
        await ctx.answerCbQuery('جاري التشغيل...').catch(() => undefined);
        await sendSyncResult(ctx);
        return;

      case 'admin_stats':
        if (!isAdmin(ctx)) return ctx.answerCbQuery('غير مصرح.', { show_alert: true });
        await sendStats(ctx);
        return;

      case 'admin_uncat':
        if (!isAdmin(ctx)) return ctx.answerCbQuery('غير مصرح.', { show_alert: true });
        await sendUncategorized(ctx, decoded.page ?? 1);
        return;

      default:
        await ctx.answerCbQuery().catch(() => undefined);
    }
  } catch (err) {
    logger.error('callbackRouter error', { data, err });
    await ctx.answerCbQuery('حدث خطأ، حاول مرة أخرى.', { show_alert: true }).catch(() => undefined);
  }
}
