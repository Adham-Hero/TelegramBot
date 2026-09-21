import { Schema, model, Document } from 'mongoose';

export interface ISyncLog extends Document {
  startedAt: Date;
  finishedAt?: Date;
  triggeredBy: number; // telegram user id
  topicsReparsed: number;
  topicsNowParsed: number;
  nodesCreated: number;
  stillUncategorized: number;
  errorMessages: string[];
}

const SyncLogSchema = new Schema<ISyncLog>({
  startedAt: { type: Date, required: true, default: Date.now },
  finishedAt: Date,
  triggeredBy: { type: Number, required: true },
  topicsReparsed: { type: Number, default: 0 },
  topicsNowParsed: { type: Number, default: 0 },
  nodesCreated: { type: Number, default: 0 },
  stillUncategorized: { type: Number, default: 0 },
  errorMessages: { type: [String], default: [] },
});

export const SyncLog = model<ISyncLog>('SyncLog', SyncLogSchema);
