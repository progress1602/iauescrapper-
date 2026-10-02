import mongoose, { Schema, Model, Types, HydratedDocument } from 'mongoose';

export type ScraperRunStatus = 'running' | 'completed' | 'failed' | 'partial';

export interface IScraperError {
  url?: string;
  message: string;
  statusCode?: number;
  timestamp: Date;
}

export interface IScraperRun {
  sourceId: Types.ObjectId;
  status: ScraperRunStatus;
  startedAt: Date;
  completedAt?: Date;
  pagesVisited: number;
  pagesSkipped: number;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsRejected: number;
  runErrors: IScraperError[];
  durationMs: number;
  triggerType: 'scheduled' | 'manual';
  createdAt: Date;
}

export type IScraperRunDocument = HydratedDocument<IScraperRun>;

const ScraperRunSchema = new Schema<IScraperRun>(
  {
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: 'ScraperSource',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'partial'],
      default: 'running',
      index: true,
    },
    startedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date },
    pagesVisited: { type: Number, default: 0 },
    pagesSkipped: { type: Number, default: 0 },
    itemsFound: { type: Number, default: 0 },
    itemsCreated: { type: Number, default: 0 },
    itemsUpdated: { type: Number, default: 0 },
    itemsUnchanged: { type: Number, default: 0 },
    itemsRejected: { type: Number, default: 0 },
    runErrors: [
      {
        url: { type: String },
        message: { type: String, required: true },
        statusCode: { type: Number },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    durationMs: { type: Number, default: 0 },
    triggerType: { type: String, enum: ['scheduled', 'manual'], default: 'scheduled' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Alias 'errors' to 'runErrors' for API responses
ScraperRunSchema.virtual('errors').get(function (this: IScraperRun) {
  return this.runErrors;
});

ScraperRunSchema.index({ sourceId: 1, startedAt: -1 });

export const ScraperRunModel: Model<IScraperRun> =
  mongoose.models.ScraperRun ||
  mongoose.model<IScraperRun>('ScraperRun', ScraperRunSchema);
