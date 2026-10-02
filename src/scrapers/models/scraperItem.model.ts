import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type ScraperContentType =
  | 'page'
  | 'announcement'
  | 'programme'
  | 'faculty'
  | 'department'
  | 'course'
  | 'document'
  | 'oer'
  | 'unknown';

export type ScraperItemStatus = 'active' | 'changed' | 'removed' | 'ignored';

export interface IScraperItem {
  sourceId: Types.ObjectId;
  url: string;
  canonicalUrl: string;
  externalId: string;
  contentHash: string;
  title: string;
  contentType: ScraperContentType;
  lastSeenAt: Date;
  firstSeenAt: Date;
  lastChangedAt: Date;
  status: ScraperItemStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScraperItemDocument extends IScraperItem, Document {}

const ScraperItemSchema = new Schema<IScraperItemDocument>(
  {
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'ScraperSource',
      required: true,
      index: true,
    },
    url: { type: String, required: true },
    canonicalUrl: { type: String, required: true },
    externalId: { type: String, required: true, index: true },
    contentHash: { type: String, required: true, index: true },
    title: { type: String, default: 'Untitled Item', trim: true },
    contentType: {
      type: String,
      enum: [
        'page',
        'announcement',
        'programme',
        'faculty',
        'department',
        'course',
        'document',
        'oer',
        'unknown',
      ],
      default: 'unknown',
      index: true,
    },
    lastSeenAt: { type: Date, default: Date.now },
    firstSeenAt: { type: Date, default: Date.now },
    lastChangedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'changed', 'removed', 'ignored'],
      default: 'active',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ScraperItemSchema.index({ sourceId: 1, canonicalUrl: 1 }, { unique: true });

export const ScraperItemModel: Model<IScraperItemDocument> =
  mongoose.models.ScraperItem ||
  mongoose.model<IScraperItemDocument>('ScraperItem', ScraperItemSchema);
