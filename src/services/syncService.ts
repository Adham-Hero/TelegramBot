import { Topic } from '../database/models/Topic';
import { HierarchyNode } from '../database/models/HierarchyNode';
import { ArchiveFile } from '../database/models/File';
import { SyncLog, ISyncLog } from '../database/models/SyncLog';
import { parseTopicName } from '../utils/topicParser';
import { ensureHierarchyNodes } from './topicService';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * IMPORTANT - what /sync can and cannot do:
 *
 * The Telegram Bot API has no method to list a forum's existing topics
 * (that capability - `getForumTopics` - is MTProto/user-account only).
 * So this bot can only ever know about a topic once a
 * forum_topic_created/edited service message, or a regular message inside
 * it, has actually passed through the bot's updates (see
 * bot/handlers/topicEvents.ts and bot/handlers/fileEvents.ts, which write
 * to the database in real time as that happens).
 *
 * /sync therefore does NOT reach out to Telegram at all. It is a
 * reconciliation pass over what has already been captured:
 *   1. Re-parse any topic still marked "uncategorized" (covers the case
 *      where an admin renamed a malformed topic to fix its format).
 *   2. Re-derive/verify hierarchy nodes for every parsed topic, creating
 *      any that are missing (self-healing if a previous write partially
 *      failed).
 *   3. Recompute counts for the admin stats screen.
 *
 * New topics/files created *after* the bot was added are already live -
 * they don't need /sync at all, they appear immediately.
 */
export async function runSync(triggeredBy: number): Promise<ISyncLog> {
  const log = await SyncLog.create({ startedAt: new Date(), triggeredBy });
  const errors: string[] = [];
  let topicsReparsed = 0;
  let topicsNowParsed = 0;

  try {
    const uncategorized = await Topic.find({ status: 'uncategorized' });
    topicsReparsed = uncategorized.length;

    for (const topic of uncategorized) {
      try {
        const parsed = parseTopicName(topic.rawName, config.topicSeparator);
        if (!parsed.isValid) continue; // still can't parse it, leave as-is

        const nodes = await ensureHierarchyNodes(parsed);
        topic.set({
          status: 'parsed',
          parseFailReason: undefined,
          normalizedName: parsed.normalizedName,
          year: parsed.levels.year!.raw,
          semester: parsed.levels.semester!.raw,
          category: parsed.levels.category!.raw,
          contentType: parsed.levels.contentType!.raw,
          yearNodeId: nodes.yearNodeId,
          semesterNodeId: nodes.semesterNodeId,
          categoryNodeId: nodes.categoryNodeId,
          contentTypeNodeId: nodes.contentTypeNodeId,
        });
        await topic.save();
        topicsNowParsed += 1;
      } catch (err: any) {
        errors.push(`Topic ${topic.telegramTopicId}: ${err.message}`);
        logger.error('Sync: failed to reparse topic', { topicId: topic.telegramTopicId, err });
      }
    }

    // Self-heal: make sure every parsed topic's 4 node references actually resolve.
    const parsedTopics = await Topic.find({ status: 'parsed' });
    let nodesCreated = 0;
    for (const topic of parsedTopics) {
      const ids = [topic.yearNodeId, topic.semesterNodeId, topic.categoryNodeId, topic.contentTypeNodeId];
      const missing = ids.some((id) => !id);
      if (!missing) continue;
      try {
        const parsed = parseTopicName(topic.rawName, config.topicSeparator);
        if (!parsed.isValid) continue;
        const before = await HierarchyNode.countDocuments();
        const nodes = await ensureHierarchyNodes(parsed);
        const after = await HierarchyNode.countDocuments();
        nodesCreated += after - before;
        topic.set({
          yearNodeId: nodes.yearNodeId,
          semesterNodeId: nodes.semesterNodeId,
          categoryNodeId: nodes.categoryNodeId,
          contentTypeNodeId: nodes.contentTypeNodeId,
        });
        await topic.save();
      } catch (err: any) {
        errors.push(`Topic ${topic.telegramTopicId} (self-heal): ${err.message}`);
      }
    }

    const stillUncategorized = await Topic.countDocuments({ status: 'uncategorized' });

    log.set({
      finishedAt: new Date(),
      topicsReparsed,
      topicsNowParsed,
      nodesCreated,
      stillUncategorized,
      errorMessages: errors,
    });
    await log.save();
    return log;
  } catch (err: any) {
    errors.push(err.message);
    log.set({ finishedAt: new Date(), errorMessages: errors });
    await log.save();
    throw err;
  }
}

export async function getStats() {
  const [users, topics, uncategorized, years, semesters, categories, contentTypes, files, lastSync] = await Promise.all([
    (await import('../database/models/User')).User.countDocuments(),
    Topic.countDocuments(),
    Topic.countDocuments({ status: 'uncategorized' }),
    HierarchyNode.countDocuments({ level: 'year' }),
    HierarchyNode.countDocuments({ level: 'semester' }),
    HierarchyNode.countDocuments({ level: 'category' }),
    HierarchyNode.countDocuments({ level: 'contentType' }),
    ArchiveFile.countDocuments(),
    SyncLog.findOne().sort({ startedAt: -1 }),
  ]);

  return { users, topics, uncategorized, years, semesters, categories, contentTypes, files, lastSync };
}
