/**
 * Normalization utilities.
 *
 * The whole "dynamic archive" idea depends on treating two differently-typed
 * but semantically-identical topic names as the SAME node in the hierarchy.
 * e.g. "Anatomy" and "anatomy" and "  Anatomy " must all map to one category.
 *
 * We keep two representations everywhere:
 *  - `raw`        -> exactly what came from Telegram (for display/debugging)
 *  - `normalized` -> used as the actual grouping/lookup key
 */

// Normalize Arabic-Indic / Persian digits to plain ASCII digits so
// "ترم ١" and "ترم 1" are treated the same if that ever comes up.
const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

// Remove Arabic diacritics (tashkeel) and tatweel so minor typing
// differences don't create duplicate categories.
function stripArabicDiacritics(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // tashkeel
    .replace(/\u0640/g, ''); // tatweel
}

// Unify alef / yaa / taa-marbuta variants often typed inconsistently.
function unifyArabicLetters(input: string): string {
  return input
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Produces a stable, comparable key from any free-text segment
 * (year / semester / category / content type). This key is NEVER shown
 * to the user - it's only used for grouping/deduplication.
 */
export function normalizeSegment(input: string): string {
  let s = input ?? '';
  s = collapseWhitespace(s);
  s = normalizeDigits(s);
  s = stripArabicDiacritics(s);
  s = unifyArabicLetters(s);
  s = s.toLowerCase(); // harmless no-op for Arabic, helps Latin names (Anatomy vs anatomy)
  return s;
}

/**
 * Cleans a raw topic name for storage/display: trims, collapses inner
 * whitespace around separators, without destroying casing or the
 * original script (Arabic/Latin/mixed).
 */
export function cleanRawTopicName(rawName: string, separator: string): string {
  return rawName
    .split(separator)
    .map((part) => collapseWhitespace(part))
    .filter((part) => part.length > 0)
    .join(` ${separator} `);
}
