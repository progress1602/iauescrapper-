import mongoose, { Document, Schema, Model } from 'mongoose';

export type ScraperSourceType =
  | 'website'
  | 'news'
  | 'portal'
  | 'academic'
  | 'oer'
  | 'document';

export interface IScraperSource {
  name: string;
  baseUrl: string;
  sourceType: ScraperSourceType;
  enabled: boolean;
  crawlEnabled: boolean;
  scrapeIntervalMinutes: number;
  lastRunAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
  priority: number;
  allowedPaths: string[];
  blockedPaths: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScraperSourceDocument extends IScraperSource, Document {}

const ScraperSourceSchema = new Schema<IScraperSourceDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    baseUrl: { type: String, required: true, trim: true },
    sourceType: {
      type: String,
      enum: ['website', 'news', 'portal', 'academic', 'oer', 'document'],
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: true, index: true },
    crawlEnabled: { type: Boolean, default: true },
    scrapeIntervalMinutes: { type: Number, default: 60, min: 1 },
    lastRunAt: { type: Date },
    lastSuccessAt: { type: Date },
    lastFailureAt: { type: Date },
    lastError: { type: String },
    priority: { type: Number, default: 1, min: 1 },
    allowedPaths: { type: [String], default: [] },
    blockedPaths: { type: [String], default: [] },
    description: { type: String },
  },
  { timestamps: true }
);

export const ScraperSourceModel: Model<IScraperSourceDocument> =
  mongoose.models.ScraperSource ||
  mongoose.model<IScraperSourceDocument>('ScraperSource', ScraperSourceSchema);
