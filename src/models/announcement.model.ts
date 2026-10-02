import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type AnnouncementCategory =
  | 'general'
  | 'academic'
  | 'admission'
  | 'examination'
  | 'registration'
  | 'fees'
  | 'scholarship'
  | 'result'
  | 'event'
  | 'other';

export type AnnouncementSourceType =
  | 'official_website'
  | 'official_portal'
  | 'official_document';

export interface IAnnouncement {
  universityId?: Types.ObjectId;
  title: string;
  content: string;
  summary?: string;
  category: AnnouncementCategory;
  sourceType: AnnouncementSourceType;
  sourceUrl: string;
  canonicalUrl: string;
  externalId: string;
  publishedAt: Date;
  scrapedAt: Date;
  imageUrl?: string;
  status: 'published' | 'draft' | 'archived';
  sourceAttribution: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnnouncementDocument extends IAnnouncement, Document {}

const AnnouncementSchema = new Schema<IAnnouncementDocument>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', index: true },
    title: { type: String, required: true, trim: true, index: true },
    content: { type: String, required: true },
    summary: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        'general',
        'academic',
        'admission',
        'examination',
        'registration',
        'fees',
        'scholarship',
        'result',
        'event',
        'other',
      ],
      default: 'general',
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['official_website', 'official_portal', 'official_document'],
      default: 'official_website',
      required: true,
    },
    sourceUrl: { type: String, required: true, index: true },
    canonicalUrl: { type: String, required: true },
    externalId: { type: String, required: true, unique: true, index: true },
    publishedAt: { type: Date, default: Date.now, index: true },
    scrapedAt: { type: Date, default: Date.now },
    imageUrl: { type: String },
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'published',
      index: true,
    },
    sourceAttribution: {
      type: String,
      default: 'IAUE Official Public Source (Ignatius Ajuru University of Education)',
    },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ title: 'text', content: 'text', summary: 'text' });

export const AnnouncementModel: Model<IAnnouncementDocument> =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncementDocument>('Announcement', AnnouncementSchema);
