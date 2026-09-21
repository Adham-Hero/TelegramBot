import { Context } from 'telegraf';
import { config } from '../../config';
import { adminMenuKeyboard } from '../keyboards/keyboards';
import { runSync, getStats } from '../../services/syncService';
import { Topic } from '../../database/models/Topic';
import { pageInfoFromTotal } from '../../utils/pagination';
import { mongoSkipLimit } from '../../utils/pagination';
import { Markup } from 'telegraf';
import { encodeCallback } from '../../utils/callbackData';

export function isAdmin(ctx: Context): boolean {
  return ctx.from?.id === config.adminId;
}

export async function requireAdmin(ctx: Context): Promise<boolean> {
  if (!isAdmin(ctx)) {
    await ctx.reply('هذا الأمر متاح للأدمن فقط.');
    return false;
  }
  return true;
}

export async function adminCommand(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  await ctx.reply('⚙️ لوحة تحكم الأدمن', adminMenuKeyboard());
}

export async function syncCommand(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  await sendSyncResult(ctx);
}

export async function statsCommand(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  await sendStats(ctx);
}

export async function sendSyncResult(ctx: Context) {
  const notice = await ctx.reply('🔄 جاري الـ Sync...');
  const log = await runSync(ctx.from!.id);
  const errorsText = log.errorMessages.length ? `\n\n⚠️ أخطاء:\n${log.errorMessages.slice(0, 5).join('\n')}` : '';
  const text =
    `✅ اكتمل الـ Sync\n\n` +
    `توبيكات أُعيد فحصها: ${log.topicsReparsed}\n` +
    `تم تصنيفها بنجاح: ${log.topicsNowParsed}\n` +
    `عُقد جديدة أُنشئت: ${log.nodesCreated}\n` +
    `ما زال غير مصنّف: ${log.stillUncategorized}` +
    errorsText;

  try {
    await ctx.telegram.editMessageText(notice.chat.id, notice.message_id, undefined, text, adminMenuKeyboard());
  } catch {
    await ctx.reply(text, adminMenuKeyboard());
  }
}

export async function sendStats(ctx: Context) {
  const s = await getStats();
  const lastSyncText = s.lastSync
    ? `${s.lastSync.finishedAt ? s.lastSync.finishedAt.toISOString() : 'قيد التنفيذ'}`
    : 'لم يتم تشغيله بعد';

  const text =
    `📊 إحصائيات البوت\n\n` +
    `👥 المستخدمين: ${s.users}\n` +
    `🗂️ التوبيكات: ${s.topics} (⚠️ غير مصنّف: ${s.uncategorized})\n` +
    `🎓 السنوات: ${s.years}\n` +
    `📚 الترمات: ${s.semesters}\n` +
    `📂 الأقسام/المواد: ${s.categories}\n` +
    `📄 أنواع المحتوى: ${s.contentTypes}\n` +
    `📁 الملفات: ${s.files}\n` +
    `🕐 آخر Sync: ${lastSyncText}`;

  const extra = adminMenuKeyboard();
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      await ctx.answerCbQuery().catch(() => undefined);
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(text, extra);
}

export async function sendUncategorized(ctx: Context, page: number) {
  const pageSize = 10;
  const { skip, limit } = mongoSkipLimit(page, pageSize);
  const [topics, total] = await Promise.all([
    Topic.find({ status: 'uncategorized' }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Topic.countDocuments({ status: 'uncategorized' }),
  ]);
  const info = pageInfoFromTotal(total, page, pageSize);

  if (total === 0) {
    const text = '✅ لا توجد توبيكات غير مصنّفة حاليًا.';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, adminMenuKeyboard()).catch(() => ctx.reply(text, adminMenuKeyboard()));
      await ctx.answerCbQuery().catch(() => undefined);
    } else {
      await ctx.reply(text, adminMenuKeyboard());
    }
    return;
  }

  const lines = topics.map((t) => `• "${t.rawName}"\n  السبب: ${t.parseFailReason || 'تنسيق غير مطابق'}`);
  const text = `⚠️ توبيكات غير مصنّفة (${total}):\n\n${lines.join('\n\n')}`;

  const pageRow = [];
  if (info.page > 1) pageRow.push(Markup.button.callback('⬅️', encodeCallback('admin_uncat', undefined, info.page - 1)));
  pageRow.push(Markup.button.callback(`${info.page}/${info.totalPages}`, 'noop'));
  if (info.page < info.totalPages) pageRow.push(Markup.button.callback('➡️', encodeCallback('admin_uncat', undefined, info.page + 1)));

  const keyboard = Markup.inlineKeyboard([pageRow, [Markup.button.callback('⚙️ رجوع للوحة الأدمن', encodeCallback('admin_menu'))]]);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, keyboard);
      await ctx.answerCbQuery().catch(() => undefined);
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(text, keyboard);
}
