import mongoose from 'mongoose';

export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Telegram forum topic names have a hard 128-character limit; guard defensively. */
export function isPlausibleTopicName(name: string): boolean {
  return isNonEmptyString(name) && name.length <= 256;
}
