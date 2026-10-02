import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type ResourceType =
  | 'lecture_notes'
  | 'courseware'
  | 'book'
  | 'journal'
  | 'video'
  | 'dissertation'
  | 'document'
  | 'other_oer';

export type ResourceSourceType =
  | 'official_website'
  | 'official_portal'
  | 'official_document';

export interface IResource {
  universityId: Types.ObjectId;
  courseId?: Types.ObjectId;
  title: string;
  description?: string;
  type: ResourceType;
  sourceUrl: string;
  fileUrl?: string;
  externalUrl?: string;
  sourceType: ResourceSourceType;
  uploadedBy?: Types.ObjectId;
  status: 'active' | 'archived';
  metadata?: {
    fileSize?: number;
    mimeType?: string;
    checksum?: string;
    fileExtension?: string;
    author?: string;
    extractedTextSnippet?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IResourceDocument extends IResource, Document {}

const ResourceSchema = new Schema<IResourceDocument>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: [
        'lecture_notes',
        'courseware',
        'book',
        'journal',
        'video',
        'dissertation',
        'document',
        'other_oer',
      ],
      default: 'other_oer',
      index: true,
    },
    sourceUrl: { type: String, required: true, index: true },
    fileUrl: { type: String },
    externalUrl: { type: String },
    sourceType: {
      type: String,
      enum: ['official_website', 'official_portal', 'official_document'],
      default: 'official_website',
      required: true,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    metadata: {
      fileSize: { type: Number },
      mimeType: { type: String },
      checksum: { type: String },
      fileExtension: { type: String },
      author: { type: String },
      extractedTextSnippet: { type: String },
    },
  },
  { timestamps: true }
);

ResourceSchema.index({ sourceUrl: 1, type: 1 }, { unique: true });

export const ResourceModel: Model<IResourceDocument> =
  mongoose.models.Resource || mongoose.model<IResourceDocument>('Resource', ResourceSchema);
