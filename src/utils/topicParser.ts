import { cleanRawTopicName, normalizeSegment } from './normalizer';

/**
 * The hierarchy level names are configuration, not business logic.
 * They only describe POSITIONS in the pipe-separated topic name -
 * they carry no assumption about what values can appear there.
 * "category" does NOT mean "must be a real academic subject" - it can be
 * "متنوعات", "تراكمي أولى", "مراجعات عامة", or anything else.
 *
 * If tomorrow you want a 5-level or 3-level hierarchy, change this array
 * (and MIN/MAX below) - nothing else in the codebase hardcodes depth.
 */
export const LEVEL_KEYS = ['year', 'semester', 'category', 'contentType'] as const;
export type LevelKey = typeof LEVEL_KEYS[number];

// Currently we require exactly 4 levels (per spec). The parser is written
// generically so relaxing this to a range (e.g. 3-4) later is a one-line change.
export const MIN_LEVELS = LEVEL_KEYS.length;
export const MAX_LEVELS = LEVEL_KEYS.length;

export interface TopicSegment {
  raw: string;
  normalized: string;
}

export interface ParsedTopic {
  rawName: string;
  normalizedName: string;
  separator: string;
  segments: TopicSegment[];
  levels: Partial<Record<LevelKey, TopicSegment>>;
  isValid: boolean;
  reason?: string;
}

/**
 * Splits a raw topic name into cleaned segments using the configured
 * separator, tolerating extra spaces around it ("A | B" vs "A|B" vs "A |  B").
 */
function splitSegments(rawName: string, separator: string): TopicSegment[] {
  const cleaned = cleanRawTopicName(rawName, separator);
  return cleaned
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => ({ raw: part, normalized: normalizeSegment(part) }));
}

/**
 * Parses a topic name of the form:
 *   السنة | الترم | Category/Section | Content Type
 *
 * No hardcoded list of valid years/semesters/categories/content types is
 * ever consulted here - any non-empty text segment is accepted as-is at
 * its position. Validity is purely structural (right number of segments).
 */
export function parseTopicName(rawName: string, separator = '|'): ParsedTopic {
  const segments = splitSegments(rawName, separator);
  const normalizedName = segments.map((s) => s.normalized).join(` ${separator} `);

  const base: ParsedTopic = {
    rawName: rawName.trim(),
    normalizedName,
    separator,
    segments,
    levels: {},
    isValid: false,
  };

  if (segments.length < MIN_LEVELS || segments.length > MAX_LEVELS) {
    return {
      ...base,
      reason: `Expected ${MIN_LEVELS} segments separated by "${separator}", got ${segments.length}. ` +
        `Topic will be filed under Uncategorized until an admin reviews it.`,
    };
  }

  const levels: Partial<Record<LevelKey, TopicSegment>> = {};
  LEVEL_KEYS.forEach((key, idx) => {
    levels[key] = segments[idx];
  });

  return {
    ...base,
    levels,
    isValid: true,
  };
}

/** Convenience accessor once you know parsing succeeded. */
export function getLevelRaw(parsed: ParsedTopic, key: LevelKey): string | undefined {
  return parsed.levels[key]?.raw;
}

export function getLevelNormalized(parsed: ParsedTopic, key: LevelKey): string | undefined {
  return parsed.levels[key]?.normalized;
}
