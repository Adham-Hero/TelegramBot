import { Schema, model, Document, Types } from 'mongoose';

export type TelegramFileKind = 'document' | 'photo' | 'video' | 'audio' | 'voice' | 'video_note' | 'other';

export interface IArchiveFile extends Document {
  chatId: number;
  messageId: number;
  telegramFileId: string; // Telegram file_id, used to resend without re-upload
  telegramTopicId: number;
  topicId: Types.ObjectId;

  fileName?: string;
  fileType: TelegramFileKind;
  mimeType?: string;
  fileSize?: number;
  caption?: string;

  // Denormalized for fast search / display without joining Topic every time
  year: string;
  semester: string;
  category: string;
  contentType: string;
  contentTypeNodeId: Types.ObjectId;

  senderId?: number;
  createdAt: Date;
}

const ArchiveFileSchema = new Schema<IArchiveFile>(
  {
    chatId: { type: Number, required: true, index: true },
    messageId: { type: Number, required: true },
    telegramFileId: { type: String, required: true },
    telegramTopicId: { type: Number, required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },

    fileName: String,
    fileType: { type: String, required: true },
    mimeType: String,
    fileSize: Number,
    caption: String,

    year: { type: String, required: true },
    semester: { type: String, required: true },
    category: { type: String, required: true },
    contentType: { type: String, required: true },
    contentTypeNodeId: { type: Schema.Types.ObjectId, ref: 'HierarchyNode', required: true, index: true },

    senderId: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevents double-inserting the same Telegram message on repeated syncs.
ArchiveFileSchema.index({ chatId: 1, messageId: 1 }, { unique: true });

// Supports the "Search" feature (section 20) without a full-text index
// dependency; combined with a text index below for fileName search.
ArchiveFileSchema.index({ fileName: 'text', category: 'text', contentType: 'text', year: 'text', semester: 'text' });

export const ArchiveFile = model<IArchiveFile>('ArchiveFile', ArchiveFileSchema);
