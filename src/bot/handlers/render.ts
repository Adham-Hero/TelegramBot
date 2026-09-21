import { Context } from 'telegraf';
import { Types } from 'mongoose';
import {
  listYears,
  listChildren,
  getNode,
  getBreadcrumb,
  listFilesForContentType,
  getFileById,
  nextLevel,
} from '../../services/archiveService';
import { searchFiles } from '../../services/searchService';
import { nodeListKeyboard, fileListKeyboard, searchResultsKeyboard, homeKeyboard } from '../keyboards/keyboards';
import { pageInfoFromTotal } from '../../utils/pagination';
import { config } from '../../config';
import { User } from '../../database/models/User';

async function send(ctx: Context, text: string, extra: any) {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
    } catch {
      // e.g. "message not modified" - fall back to a fresh message
      await ctx.reply(text, extra);
    }
    await ctx.answerCbQuery().catch(() => undefined);
  } else {
    await ctx.reply(text, extra);
  }
}

export async function renderHome(ctx: Context) {
  const years = await listYears();
  if (years.length === 0) {
    await send(ctx, 'لا توجد أي بيانات مؤرشفة بعد.\nتأكد أن التوبيكات مسمّاة بالشكل الصحيح ثم استخدم /sync.', homeKeyboard());
    return;
  }
  await send(ctx, '🎓 اختر السنة الدراسية:', nodeListKeyboard(years, { showHome: false }));
}

export async function renderNode(ctx: Context, nodeId: string, page = 1) {
  const node = await getNode(nodeId);
  if (!node) {
    await send(ctx, 'هذا القسم لم يعد موجودًا. تم إرجاعك للرئيسية.', homeKeyboard());
    return;
  }

  const step = nextLevel(node.level);

  if (step === 'files') {
    const { files, total } = await listFilesForContentType(node._id as Types.ObjectId, page, config.pageSize);
    const info = pageInfoFromTotal(total, page, config.pageSize);
    const breadcrumb = await getBreadcrumb(node._id as Types.ObjectId);
    const title = breadcrumb.map((n) => n.rawName).join(' › ');

    if (total === 0) {
      await send(ctx, `📂 ${title}\n\nلا توجد ملفات هنا بعد.`, nodeListKeyboard([], { backTargetId: node.parentId ? String(node.parentId) : null }));
      return;
    }

    const backId = node.parentId ? String(node.parentId) : null;
    await send(
      ctx,
      `📂 ${title}\n\nالملفات (${info.totalItems}):`,
      fileListKeyboard(files, info, String(node._id), backId as string)
    );
    return;
  }

  const children = await listChildren(node._id as Types.ObjectId);
  const breadcrumb = await getBreadcrumb(node._id as Types.ObjectId);
  const title = breadcrumb.map((n) => n.rawName).join(' › ');
  const backId = node.parentId ? String(node.parentId) : null;

  if (children.length === 0) {
    await send(ctx, `📂 ${title}\n\nلا توجد عناصر فرعية هنا بعد.`, nodeListKeyboard([], { backTargetId: backId }));
    return;
  }

  await send(ctx, `📂 ${title}`, nodeListKeyboard(children, { backTargetId: backId }));
}

export async function renderFile(ctx: Context, fileId: string) {
  const file = await getFileById(fileId);
  if (!file) {
    await ctx.answerCbQuery('هذا الملف لم يعد متاحًا.', { show_alert: true }).catch(() => undefined);
    return;
  }

  await ctx.answerCbQuery().catch(() => undefined);
  const caption = `📄 ${file.fileName || ''}\n${file.year} › ${file.semester} › ${file.category} › ${file.contentType}`.trim();

  try {
    switch (file.fileType) {
      case 'photo':
        await ctx.replyWithPhoto(file.telegramFileId, { caption });
        break;
      case 'video':
        await ctx.replyWithVideo(file.telegramFileId, { caption });
        break;
      case 'audio':
        await ctx.replyWithAudio(file.telegramFileId, { caption });
        break;
      case 'voice':
        await ctx.replyWithVoice(file.telegramFileId, { caption });
        break;
      case 'video_note':
        await ctx.replyWithVideoNote(file.telegramFileId);
        break;
      default:
        await ctx.replyWithDocument(file.telegramFileId, { caption });
    }
  } catch (err) {
    await ctx.reply('تعذر إرسال الملف. قد يكون قد تم حذفه من تيليجرام.');
  }
}

export async function renderSearchPage(ctx: Context, page: number) {
  const from = ctx.from;
  if (!from) return;
  const user = await User.findOne({ telegramUserId: from.id });
  const query = user?.lastSearchQuery;
  if (!query) {
    await send(ctx, 'لا يوجد بحث سابق. أرسل /search متبوعًا بكلمة البحث.', homeKeyboard());
    return;
  }
  await runSearch(ctx, query, page);
}

export async function runSearch(ctx: Context, query: string, page = 1) {
  const from = ctx.from;
  if (from) {
    await User.findOneAndUpdate(
      { telegramUserId: from.id },
      { $set: { lastSearchQuery: query, lastSearchAt: new Date() } },
      { upsert: true }
    );
  }

  const { files, total } = await searchFiles(query, page, config.pageSize);
  if (total === 0) {
    await send(ctx, `🔎 نتائج البحث عن: "${query}"\n\nلا توجد نتائج.`, homeKeyboard());
    return;
  }

  const info = pageInfoFromTotal(total, page, config.pageSize);
  const lines = files.map((f) => `📄 ${f.fileName || 'ملف'}\n   ${f.year} › ${f.semester} › ${f.category} › ${f.contentType}`);
  const text = `🔎 نتائج البحث عن: "${query}" (${total})\n\n${lines.join('\n\n')}`;

  await send(ctx, text, searchResultsKeyboard(info));
}
