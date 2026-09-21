import { Schema, model, Document, Types } from 'mongoose';
import { LevelKey, LEVEL_KEYS } from '../../utils/topicParser';

/**
 * A single generic node in the Year -> Semester -> Category -> ContentType
 * tree. There is deliberately ONE schema for all four levels - the "level"
 * field is just data, never a separate hardcoded model/collection. This is
 * what lets a brand-new category or content type appear with zero code
 * changes: it's just a new document with a new `normalizedName`.
 */
export interface IHierarchyNode extends Document {
  level: LevelKey;
  parentId: Types.ObjectId | null;
  rawName: string; // first-seen display text, e.g. "Anatomy" or "تراكمي أولى"
  normalizedName: string; // grouping key, e.g. "anatomy"
  createdAt: Date;
  updatedAt: Date;
}

const HierarchyNodeSchema = new Schema<IHierarchyNode>(
  {
    level: { type: String, enum: LEVEL_KEYS, required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'HierarchyNode', default: null, index: true },
    rawName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true },
  },
  { timestamps: true }
);

// A given parent can only have ONE child with a given normalized name at a
// given level - this is what prevents "Anatomy" and "anatomy" from becoming
// two separate categories, while still allowing "Anatomy" to exist once
// under "ترم أول" and once under "ترم ثاني" (different parents).
HierarchyNodeSchema.index({ parentId: 1, level: 1, normalizedName: 1 }, { unique: true });

export const HierarchyNode = model<IHierarchyNode>('HierarchyNode', HierarchyNodeSchema);
