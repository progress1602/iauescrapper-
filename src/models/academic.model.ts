import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// --- University ---
export interface IUniversity {
  name: string;
  acronym: string;
  website: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface IUniversityDocument extends IUniversity, Document {}

const UniversitySchema = new Schema<IUniversityDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    acronym: { type: String, required: true, trim: true, default: 'IAUE' },
    website: { type: String, required: true, trim: true, default: 'https://iaue.edu.ng' },
    logoUrl: { type: String },
  },
  { timestamps: true }
);

export const UniversityModel: Model<IUniversityDocument> =
  mongoose.models.University ||
  mongoose.model<IUniversityDocument>('University', UniversitySchema);

// --- Faculty ---
export interface IFaculty {
  universityId: Types.ObjectId;
  name: string;
  code?: string;
  dean?: string;
  sourceUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface IFacultyDocument extends IFaculty, Document {}

const FacultySchema = new Schema<IFacultyDocument>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    dean: { type: String, trim: true },
    sourceUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
FacultySchema.index({ universityId: 1, name: 1 }, { unique: true });

export const FacultyModel: Model<IFacultyDocument> =
  mongoose.models.Faculty || mongoose.model<IFacultyDocument>('Faculty', FacultySchema);

// --- Department ---
export interface IDepartment {
  universityId: Types.ObjectId;
  facultyId: Types.ObjectId;
  name: string;
  code?: string;
  hod?: string;
  sourceUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface IDepartmentDocument extends IDepartment, Document {}

const DepartmentSchema = new Schema<IDepartmentDocument>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    hod: { type: String, trim: true },
    sourceUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
DepartmentSchema.index({ facultyId: 1, name: 1 }, { unique: true });

export const DepartmentModel: Model<IDepartmentDocument> =
  mongoose.models.Department ||
  mongoose.model<IDepartmentDocument>('Department', DepartmentSchema);

// --- Programme ---
export interface IProgramme {
  universityId: Types.ObjectId;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  name: string;
  code?: string;
  degreeType: string; // e.g. B.Sc, B.Ed, M.Sc, Ph.D, PGDE
  sessionId?: string; // Academic session, e.g. 2025/2026
  sourceUrl: string;
  sourceDocument?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface IProgrammeDocument extends IProgramme, Document {}

const ProgrammeSchema = new Schema<IProgrammeDocument>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, trim: true, uppercase: true },
    degreeType: { type: String, default: 'Undergraduate', trim: true },
    sessionId: { type: String, trim: true, index: true },
    sourceUrl: { type: String, required: true },
    sourceDocument: { type: String },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
ProgrammeSchema.index({ departmentId: 1, name: 1, sessionId: 1 }, { unique: true });

export const ProgrammeModel: Model<IProgrammeDocument> =
  mongoose.models.Programme ||
  mongoose.model<IProgrammeDocument>('Programme', ProgrammeSchema);

// --- Course ---
export interface ICourse {
  universityId: Types.ObjectId;
  facultyId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  programmeId?: Types.ObjectId;
  code: string; // e.g. CSC 201
  title: string;
  description?: string;
  units: number | null; // NULL if not officially stated!
  unitsExplicitlyProvided: boolean;
  level?: number | null; // e.g. 100, 200, 300, 400
  semesterId?: string | null; // e.g. 1, 2, "First", "Second"
  sessionId?: string | null;
  sourceUrl: string;
  sourceType: string;
  sourceDocument?: string;
  sourceLastCheckedAt: Date;
  unitConflict?: {
    conflictingUnits: number[];
    sources: string[];
    detectedAt: Date;
  } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface ICourseDocument extends ICourse, Document {}

const CourseSchema = new Schema<ICourseDocument>(
  {
    universityId: { type: Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    programmeId: { type: Schema.Types.ObjectId, ref: 'Programme', index: true },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    units: { type: Number, default: null },
    unitsExplicitlyProvided: { type: Boolean, default: false },
    level: { type: Number, default: null, index: true },
    semesterId: { type: String, default: null },
    sessionId: { type: String, default: null, index: true },
    sourceUrl: { type: String, required: true },
    sourceType: { type: String, default: 'official_website' },
    sourceDocument: { type: String },
    sourceLastCheckedAt: { type: Date, default: Date.now },
    unitConflict: {
      conflictingUnits: [{ type: Number }],
      sources: [{ type: String }],
      detectedAt: { type: Date },
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CourseSchema.index({ code: 1, departmentId: 1, sessionId: 1 }, { unique: true });

export const CourseModel: Model<ICourseDocument> =
  mongoose.models.Course || mongoose.model<ICourseDocument>('Course', CourseSchema);
