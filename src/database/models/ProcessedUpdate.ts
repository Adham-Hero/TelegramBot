import { Schema, model, Document } from 'mongoose';

/**
 * Telegram's webhook delivery is "at least once", not "exactly once": if
 * our endpoint doesn't answer 200 quickly enough (cold start, a slow
 * MongoDB query, a transient error), Telegram WILL retry the same update
 * later. Without this guard, a retried update runs the full handler again
 * - which, for something like "send this file" or "post this message",
 * means the user gets the exact same message a second (or third...) time.
 * That's the most common cause of a bot "randomly" sending duplicate/
 * repeated messages.
 *
 * Recording the update_id here (with a unique index) lets us detect a
 * redelivery atomically and skip reprocessing it, even across cold starts
 * and even if two retries arrive almost simultaneously.
 */
export interface IProcessedUpdate extends Document {
  updateId: number;
  processedAt: Date;
}

const ProcessedUpdateSchema = new Schema<IProcessedUpdate>({
  updateId: { type: Number, required: true, unique: true },
  // TTL index: Mongo automatically deletes these documents 3 days after
  // creation, so this collection never grows unbounded. We only need the
  // dedupe window to cover Telegram's actual retry period, not forever.
  processedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 },
});

export const ProcessedUpdate = model<IProcessedUpdate>('ProcessedUpdate', ProcessedUpdateSchema);
