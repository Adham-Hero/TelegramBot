import { Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { config } from '../../config';
import { getTopicByTelegramId } from '../../services/topicService';
import { ArchiveFile, TelegramFileKind } from '../../database/models/File';
import { logger } from '../../utils/logger';

function isFromArchiveGroup(ctx: Context): boolean {
  return ctx.chat?.id === config.archiveGroupId;
}

interface ExtractedFile {
  telegramFileId: string;
  fileName?: string;
  fileType: TelegramFileKind;
  mimeType?: string;
  fileSize?: number;
}

function extractFile(msg: Message): ExtractedFile | null {
  const anyMsg = msg as any;
  if (anyMsg.document) {
    return {
      telegramFileId: anyMsg.document.file_id,
      fileName: anyMsg.document.file_name,
      fileType: 'document',
      mimeType: anyMsg.document.mime_type,
      fileSize: anyMsg.document.file_size,
    };
  }
  if (anyMsg.video) {
    return {
      telegramFileId: anyMsg.video.file_id,
      fileName: anyMsg.video.file_name,
      fileType: 'video',
      mimeType: anyMsg.video.mime_type,
      fileSize: anyMsg.video.file_size,
    };
  }
  if (anyMsg.audio) {
    return {
      telegramFileId: anyMsg.audio.file_id,
      fileName: anyMsg.audio.file_name ?? anyMsg.audio.title,
      fileType: 'audio',
      mimeType: anyMsg.audio.mime_type,
      fileSize: anyMsg.audio.file_size,
    };
  }
  if (anyMsg.voice) {
    return { telegramFileId: anyMsg.voice.file_id, fileType: 'voice', mimeType: anyMsg.voice.mime_type, fileSize: anyMsg.voice.file_size };
  }
  if (anyMsg.video_note) {
    return { telegramFileId: anyMsg.video_note.file_id, fileType: 'video_note', fileSize: anyMsg.video_note.file_size };
  }
  if (anyMsg.photo?.length) {
    const largest = anyMsg.photo[anyMsg.photo.length - 1];
    return { telegramFileId: largest.file_id, fileType: 'photo', fileSize: largest.file_size };
  }
  return null;
}

export async function handleIncomingFile(ctx: Context) {
  if (!isFromArchiveGroup(ctx)) return;
  const msg = ctx.message as Message;
  const threadId = (msg as any).message_thread_id as number | undefined;
  if (!threadId) return; // not inside any topic (e.g. General) - nothing to archive under

  const extracted = extractFile(msg);
  if (!extracted) return; // plain text message, nothing to archive

  const topic = await getTopicByTelegramId(ctx.chat!.id, threadId);
  if (!topic) {
    logger.warn('File received in an unknown topic (topic event missed?)', { threadId, messageId: msg.message_id });
    return;
  }
  if (topic.status !== 'parsed') {
    logger.info('File received under an uncategorized topic - stored on topic, but not archived under a category', {
      threadId,
      topicName: topic.rawName,
    });
    return;
  }

  try {
    await ArchiveFile.create({
      chatId: ctx.chat!.id,
      messageId: msg.message_id,
      telegramFileId: extracted.telegramFileId,
      telegramTopicId: threadId,
      topicId: topic._id,
      fileName: extracted.fileName,
      fileType: extracted.fileType,
      mimeType: extracted.mimeType,
      fileSize: extracted.fileSize,
      caption: (msg as any).caption,
      year: topic.year,
      semester: topic.semester,
      category: topic.category,
      contentType: topic.contentType,
      contentTypeNodeId: topic.contentTypeNodeId,
      senderId: ctx.from?.id,
    });
    logger.info('File archived', { fileName: extracted.fileName, topic: topic.rawName });
  } catch (err: any) {
    if (err?.code === 11000) {
      // duplicate messageId -> already archived (e.g. re-processed on restart). Safe to ignore.
      return;
    }
    logger.error('Failed to archive incoming file', { err });
  }
}
