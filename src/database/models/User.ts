import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  telegramUserId: number;
  username?: string;
  firstName?: string;
  lastSeenAt: Date;
  createdAt: Date;

  // Short-lived UI state, needed because callback_data can't carry free
  // text like a search query (see utils/callbackData.ts).
  lastSearchQuery?: string;
  lastSearchAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    telegramUserId: { type: Number, required: true, unique: true, index: true },
    username: String,
    firstName: String,
    lastSeenAt: { type: Date, default: Date.now },

    lastSearchQuery: String,
    lastSearchAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const User = model<IUser>('User', UserSchema);
