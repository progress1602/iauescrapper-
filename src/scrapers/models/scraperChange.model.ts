import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type ChangeType = 'created' | 'updated' | 'removed';
export type ReviewStatus = 'pending' | 'approved' | 'ignored';
export type EntityType =
  | 'course'
  | 'programme'
  | 'department'
  | 'faculty'
  | 'announcement'
  | 'resource';

export interface IFieldChange {
  old: unknown;
  new: unknown;
}

export interface IScraperChange {
  sourceId: Types.ObjectId;
  scraperItemId?: Types.ObjectId;
  entityType: EntityType;
  entityId?: Types.ObjectId;
  changeType: ChangeType;
  previousHash?: string;
  newHash: string;
  changedFields: Record<string, IFieldChange>;
  detectedAt: Date;
  reviewStatus: ReviewStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface IScraperChangeDocument extends IScraperChange, Document {}

const ScraperChangeSchema = new Schema<IScraperChangeDocument>(
  {
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'ScraperSource',
      required: true,
      index: true,
    },
    scraperItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ScraperItem',
      index: true,
    },
    entityType: {
      type: String,
      enum: ['course', 'programme', 'department', 'faculty', 'announcement', 'resource'],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, index: true },
    changeType: {
      type: String,
      enum: ['created', 'updated', 'removed'],
      required: true,
      index: true,
    },
    previousHash: { type: String },
    newHash: { type: String, required: true },
    changedFields: { type: Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, default: Date.now, index: true },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'ignored'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ScraperChangeSchema.index({ reviewStatus: 1, entityType: 1, detectedAt: -1 });

export const ScraperChangeModel: Model<IScraperChangeDocument> =
  mongoose.models.ScraperChange ||
  mongoose.model<IScraperChangeDocument>('ScraperChange', ScraperChangeSchema);
