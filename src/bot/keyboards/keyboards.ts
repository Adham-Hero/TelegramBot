import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { IHierarchyNode } from '../../database/models/HierarchyNode';
import { IArchiveFile } from '../../database/models/File';
import { encodeCallback } from '../../utils/callbackData';
import { emojiForYear, emojiForSemester, emojiForCategory, emojiForContentType } from '../../utils/emoji';
import { PageInfo } from '../../utils/pagination';
import { LevelKey } from '../../utils/topicParser';

function emojiFor(level: LevelKey, rawName: string): string {
  switch (level) {
    case 'year':
      return emojiForYear(rawName);
    case 'semester':
      return emojiForSemester(rawName);
    case 'category':
      return emojiForCategory(rawName);
    case 'contentType':
      return emojiForContentType(rawName);
  }
}

const MAX_LABEL_LEN = 40;
function truncate(s: string, max = MAX_LABEL_LEN): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** One button per child node (year/semester/category/contentType - whichever level `nodes` are). */
export function nodeListKeyboard(nodes: IHierarchyNode[], opts: { showHome?: boolean; backTargetId?: string | null } = {}) {
  const rows = nodes.map((n) => [
    Markup.button.callback(`${emojiFor(n.level, n.rawName)} ${truncate(n.rawName)}`, encodeCallback('node', String(n._id))),
  ]);
  rows.push(navRow(opts.backTargetId));
  return Markup.inlineKeyboard(rows) as { reply_markup: InlineKeyboardMarkup };
}

function navRow(backTargetId?: string | null) {
  const row = [];
  if (backTargetId !== undefined) {
    row.push(
      backTargetId
        ? Markup.button.callback('⬅️ رجوع', encodeCallback('node', backTargetId))
        : Markup.button.callback('⬅️ رجوع', encodeCallback('home'))
    );
  }
  row.push(Markup.button.callback('🏠 الرئيسية', encodeCallback('home')));
  return row;
}

export function fileListKeyboard(
  files: IArchiveFile[],
  pageInfo: PageInfo,
  contentTypeNodeId: string,
  backTargetId: string
) {
  const rows = files.map((f) => [
    Markup.button.callback(`📄 ${truncate(f.fileName || 'ملف بدون اسم', 45)}`, encodeCallback('file', String(f._id))),
  ]);

  const pageRow = [];
  if (pageInfo.page > 1) {
    pageRow.push(Markup.button.callback('⬅️ السابق', encodeCallback('node', contentTypeNodeId, pageInfo.page - 1)));
  }
  pageRow.push(Markup.button.callback(`${pageInfo.page}/${pageInfo.totalPages}`, 'noop'));
  if (pageInfo.page < pageInfo.totalPages) {
    pageRow.push(Markup.button.callback('التالي ➡️', encodeCallback('node', contentTypeNodeId, pageInfo.page + 1)));
  }
  if (pageRow.length) rows.push(pageRow);

  rows.push(navRow(backTargetId));
  return Markup.inlineKeyboard(rows) as { reply_markup: InlineKeyboardMarkup };
}

export function searchResultsKeyboard(pageInfo: PageInfo) {
  const pageRow = [];
  if (pageInfo.page > 1) {
    pageRow.push(Markup.button.callback('⬅️ السابق', encodeCallback('search_page', undefined, pageInfo.page - 1)));
  }
  pageRow.push(Markup.button.callback(`${pageInfo.page}/${pageInfo.totalPages}`, 'noop'));
  if (pageInfo.page < pageInfo.totalPages) {
    pageRow.push(Markup.button.callback('التالي ➡️', encodeCallback('search_page', undefined, pageInfo.page + 1)));
  }
  const rows = pageRow.length ? [pageRow] : [];
  rows.push(navRow(null));
  return Markup.inlineKeyboard(rows) as { reply_markup: InlineKeyboardMarkup };
}

export function homeKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('🏠 الرئيسية', encodeCallback('home'))]]) as {
    reply_markup: InlineKeyboardMarkup;
  };
}

export function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Sync', encodeCallback('admin_sync'))],
    [Markup.button.callback('📊 Stats', encodeCallback('admin_stats'))],
    [Markup.button.callback('⚠️ Uncategorized Topics', encodeCallback('admin_uncat', undefined, 1))],
    [Markup.button.callback('🏠 الرئيسية', encodeCallback('home'))],
  ]) as { reply_markup: InlineKeyboardMarkup };
}
