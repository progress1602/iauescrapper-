import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IScraperLock {
  _id: string; // Resource/Job identifier e.g. "source:iaue-news" or "job:global"
  instanceId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

export type IScraperLockDocument = HydratedDocument<IScraperLock>;

const ScraperLockSchema = new Schema<IScraperLock>(
  {
    _id: { type: String, required: true },
    instanceId: { type: String, required: true },
    acquiredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, timestamps: false }
);

// MongoDB TTL index to automatically release dead locks after expiry
ScraperLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ScraperLockModel: Model<IScraperLock> =
  mongoose.models.ScraperLock ||
  mongoose.model<IScraperLock>('ScraperLock', ScraperLockSchema);
