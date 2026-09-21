/**
 * IMPORTANT: This module is PURELY cosmetic.
 *
 * The text name (raw/normalized) is always the source of truth for
 * identity, grouping and lookups. Nothing here is ever used to decide
 * what category/content-type something belongs to - only which icon
 * to draw next to it. If a name isn't recognized, we fall back to a
 * generic icon and everything keeps working correctly.
 */

const CONTENT_TYPE_HINTS: Array<[RegExp, string]> = [
  [/شرح|lecture|محاضر/i, '📖'],
  [/اسئلة|أسئلة|questions?/i, '📝'],
  [/امتحان|exam/i, '🧪'],
  [/مراجع/i, '📄'],
  [/ملخص|summary/i, '🗒️'],
  [/ملف|files?/i, '📁'],
  [/pdf/i, '📕'],
  [/فيديو|video/i, '🎥'],
  [/واجب|assignment|homework/i, '✍️'],
  [/تراكمي|cumulative/i, '📚'],
];

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/anatomy|تشريح/i, '🫀'],
  [/physiology|وظائف/i, '🧠'],
  [/pharmacology|صيدل/i, '💊'],
  [/microbiology|ميكروب/i, '🦠'],
  [/pathology|باثول/i, '🧬'],
  [/biochemistry|كيمياء حيوية/i, '⚗️'],
  [/تراكمي/i, '📚'],
  [/متنوع/i, '📂'],
  [/مراجع/i, '📄'],
];

const SEMESTER_HINTS: Array<[RegExp, string]> = [
  [/صيفي|summer/i, '☀️'],
  [/ترم اول|ترم أول|first/i, '📚'],
  [/ترم ثاني|second/i, '📚'],
];

function firstMatch(text: string, table: Array<[RegExp, string]>, fallback: string): string {
  for (const [pattern, emoji] of table) {
    if (pattern.test(text)) return emoji;
  }
  return fallback;
}

export function emojiForYear(_yearRaw: string): string {
  return '🎓';
}

export function emojiForSemester(semesterRaw: string): string {
  return firstMatch(semesterRaw, SEMESTER_HINTS, '📚');
}

export function emojiForCategory(categoryRaw: string): string {
  return firstMatch(categoryRaw, CATEGORY_HINTS, '📂');
}

export function emojiForContentType(contentTypeRaw: string): string {
  return firstMatch(contentTypeRaw, CONTENT_TYPE_HINTS, '📄');
}
