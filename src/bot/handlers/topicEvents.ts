import { Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { config } from '../../config';
import { upsertTopicFromTelegram } from '../../services/topicService';
import { logger } from '../../utils/logger';

type ForumTopicCreatedMessage = Message.ForumTopicCreatedMessage;
type ForumTopicEditedMessage = Message.ForumTopicEditedMessage;

function isFromArchiveGroup(ctx: Context): boolean {
  return ctx.chat?.id === config.archiveGroupId;
}

/**
 * A forum topic's identity (message_thread_id used everywhere else) equals
 * the message_id of the special "topic created" service message itself.
 */
export async function handleForumTopicCreated(ctx: Context) {
  if (!isFromArchiveGroup(ctx)) return;
  const msg = ctx.message as ForumTopicCreatedMessage;
  const topicId = msg.message_id;
  const name = msg.forum_topic_created.name;

  try {
    const topic = await upsertTopicFromTelegram({
      chatId: ctx.chat!.id,
      telegramTopicId: topicId,
      rawName: name,
    });
    logger.info('Forum topic created & registered', { topicId, name, status: topic.status });
  } catch (err) {
    logger.error('Failed to register created topic', { topicId, name, err });
  }
}

/** Renaming a topic is how an admin can "fix" a malformed name after the fact. */
export async function handleForumTopicEdited(ctx: Context) {
  if (!isFromArchiveGroup(ctx)) return;
  const msg = ctx.message as ForumTopicEditedMessage;
  const topicId = msg.message_thread_id ?? msg.message_id;
  const name = msg.forum_topic_edited.name;
  if (!name) return; // edit may have changed only the icon, not the name

  try {
    const topic = await upsertTopicFromTelegram({
      chatId: ctx.chat!.id,
      telegramTopicId: topicId,
      rawName: name,
    });
    logger.info('Forum topic edited & re-registered', { topicId, name, status: topic.status });
  } catch (err) {
    logger.error('Failed to re-register edited topic', { topicId, name, err });
  }
}
