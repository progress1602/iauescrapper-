import { AnnouncementCategory } from '../../models/announcement.model';
import { ResourceType } from '../../models/resource.model';
import { ScraperContentType } from '../models/scraperItem.model';

export interface ScrapedPage {
  url: string;
  canonicalUrl: string;
  html: string;
  statusCode: number;
  contentType: string;
  depth: number;
  contentHash: string;
}

export interface DiscoveredLink {
  url: string;
  canonicalUrl: string;
  text?: string;
  parentUrl: string;
  depth: number;
  inferredContentType?: ScraperContentType;
}

export interface ParsedAnnouncement {
  title: string;
  content: string;
  summary?: string;
  category: AnnouncementCategory;
  publishedAt?: Date;
  imageUrl?: string;
  sourceUrl: string;
  canonicalUrl: string;
  externalId: string;
  author?: string;
  tags?: string[];
  contentHash: string;
}

export interface ParsedFaculty {
  name: string;
  code?: string;
  dean?: string;
  sourceUrl: string;
  departments: string[];
}

export interface ParsedDepartment {
  name: string;
  facultyName?: string;
  code?: string;
  hod?: string;
  sourceUrl: string;
  programmes?: string[];
}

export interface ParsedProgramme {
  name: string;
  facultyName?: string;
  departmentName?: string;
  degreeType: string;
  code?: string;
  sessionId?: string;
  sourceUrl: string;
}

export interface ParsedCourse {
  code: string;
  title: string;
  units: number | null;
  unitsExplicitlyProvided: boolean;
  level?: number | null;
  semesterId?: string | null;
  description?: string;
  sourceUrl: string;
  departmentName?: string;
  programmeName?: string;
  contentHash: string;
}

export interface ParsedOer {
  title: string;
  description?: string;
  type: ResourceType;
  sourceUrl: string;
  fileUrl?: string;
  author?: string;
  courseCode?: string;
  contentHash: string;
}

export interface ParsedDocument {
  title: string;
  url: string;
  fileExtension: string;
  sourceUrl: string;
  inferredCategory: string;
  fileSize?: number;
}
