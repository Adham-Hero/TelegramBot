import { Schema, model, Document, Types } from 'mongoose';

export type TopicStatus = 'parsed' | 'uncategorized';

export interface ITopic extends Document {
  chatId: number;
  telegramTopicId: number; // message_thread_id
  rawName: string;
  normalizedName: string;
  status: TopicStatus;
  parseFailReason?: string;

  // Denormalized raw display text per level, kept even when status is
  // 'uncategorized' is impossible (those fields stay undefined) - only
  // populated once parsing succeeds.
  year?: string;
  semester?: string;
  category?: string;
  contentType?: string;

  // References into the generic HierarchyNode tree (leaf = contentType node)
  yearNodeId?: Types.ObjectId;
  semesterNodeId?: Types.ObjectId;
  categoryNodeId?: Types.ObjectId;
  contentTypeNodeId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const TopicSchema = new Schema<ITopic>(
  {
    chatId: { type: Number, required: true, index: true },
    telegramTopicId: { type: Number, required: true },
    rawName: { type: String, required: true },
    normalizedName: { type: String, required: true },
    status: { type: String, enum: ['parsed', 'uncategorized'], required: true, default: 'uncategorized', index: true },
    parseFailReason: { type: String },

    year: String,
    semester: String,
    category: String,
    contentType: String,

    yearNodeId: { type: Schema.Types.ObjectId, ref: 'HierarchyNode' },
    semesterNodeId: { type: Schema.Types.ObjectId, ref: 'HierarchyNode' },
    categoryNodeId: { type: Schema.Types.ObjectId, ref: 'HierarchyNode' },
    contentTypeNodeId: { type: Schema.Types.ObjectId, ref: 'HierarchyNode' },
  },
  { timestamps: true }
);

// One Telegram topic (per chat) must map to exactly one Topic document.
TopicSchema.index({ chatId: 1, telegramTopicId: 1 }, { unique: true });

export const Topic = model<ITopic>('Topic', TopicSchema);
