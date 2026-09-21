import { Types } from 'mongoose';
import { Topic, ITopic } from '../database/models/Topic';
import { HierarchyNode } from '../database/models/HierarchyNode';
import { parseTopicName, LEVEL_KEYS, ParsedTopic } from '../utils/topicParser';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface EnsureNodesResult {
  yearNodeId: Types.ObjectId;
  semesterNodeId: Types.ObjectId;
  categoryNodeId: Types.ObjectId;
  contentTypeNodeId: Types.ObjectId;
  createdCount: number;
}

/**
 * Walks Year -> Semester -> Category -> ContentType, get-or-creating each
 * HierarchyNode along the way. This is the ONLY place new categories/
 * content types/years/semesters come into existence - and it never
 * consults a fixed list, only the parsed topic's own text.
 */
export async function ensureHierarchyNodes(parsed: ParsedTopic): Promise<EnsureNodesResult> {
  let parentId: Types.ObjectId | null = null;
  const ids: Types.ObjectId[] = [];
  let createdCount = 0;

  for (const levelKey of LEVEL_KEYS) {
    const segment = parsed.levels[levelKey];
    if (!segment) {
      throw new Error(`parseTopicName produced no segment for level "${levelKey}" - this should not happen for a valid parse.`);
    }

    // upsert: create if missing, otherwise just fetch the existing node.
    // findOneAndUpdate with $setOnInsert avoids a race where two events
    // for the same new category arrive close together.
    const node = await HierarchyNode.findOneAndUpdate(
      { parentId, level: levelKey, normalizedName: segment.normalized },
      { $setOnInsert: { rawName: segment.raw, parentId, level: levelKey, normalizedName: segment.normalized } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (node.createdAt.getTime() === node.updatedAt.getTime()) {
      // freshly inserted this call (best-effort heuristic; fine for logging)
    }

    ids.push(node._id as Types.ObjectId);
    parentId = node._id as Types.ObjectId;
  }

  return {
    yearNodeId: ids[0],
    semesterNodeId: ids[1],
    categoryNodeId: ids[2],
    contentTypeNodeId: ids[3],
    createdCount,
  };
}

/**
 * Creates or updates the Topic document for a Telegram forum topic,
 * parsing its name and (if valid) wiring it into the hierarchy tree.
 * Safe to call repeatedly (e.g. on forum_topic_created AND forum_topic_edited).
 */
export async function upsertTopicFromTelegram(params: {
  chatId: number;
  telegramTopicId: number;
  rawName: string;
}): Promise<ITopic> {
  const parsed = parseTopicName(params.rawName, config.topicSeparator);

  const update: Partial<ITopic> = {
    rawName: parsed.rawName,
    normalizedName: parsed.normalizedName,
  };

  if (parsed.isValid) {
    const nodes = await ensureHierarchyNodes(parsed);
    Object.assign(update, {
      status: 'parsed',
      parseFailReason: undefined,
      year: parsed.levels.year!.raw,
      semester: parsed.levels.semester!.raw,
      category: parsed.levels.category!.raw,
      contentType: parsed.levels.contentType!.raw,
      yearNodeId: nodes.yearNodeId,
      semesterNodeId: nodes.semesterNodeId,
      categoryNodeId: nodes.categoryNodeId,
      contentTypeNodeId: nodes.contentTypeNodeId,
    });
  } else {
    Object.assign(update, { status: 'uncategorized', parseFailReason: parsed.reason });
  }

  const topic = await Topic.findOneAndUpdate(
    { chatId: params.chatId, telegramTopicId: params.telegramTopicId },
    { $set: update, $setOnInsert: { chatId: params.chatId, telegramTopicId: params.telegramTopicId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (topic.status === 'uncategorized') {
    logger.warn('Topic left uncategorized', { rawName: params.rawName, reason: parsed.reason });
  }

  return topic;
}

export async function getTopicByTelegramId(chatId: number, telegramTopicId: number) {
  return Topic.findOne({ chatId, telegramTopicId });
}
