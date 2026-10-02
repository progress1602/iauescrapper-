import { Types } from 'mongoose';
import {
  AnnouncementModel,
  IAnnouncementDocument,
} from '../../models/announcement.model';
import { UniversityModel } from '../../models/academic.model';
import { ScraperItemModel } from '../models/scraperItem.model';
import { ParsedAnnouncement } from '../core/scraper.types';
import { scraperChangeDetectionService } from './scraperChangeDetection.service';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('AnnouncementSyncService');

export interface SyncStats {
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
}

export class AnnouncementSyncService {
  private defaultUniversityId: Types.ObjectId | null = null;

  private async getUniversityId(): Promise<Types.ObjectId> {
    if (this.defaultUniversityId) return this.defaultUniversityId;
    const uni = await UniversityModel.findOne({ acronym: 'IAUE' });
    if (uni) {
      this.defaultUniversityId = uni._id as Types.ObjectId;
      return this.defaultUniversityId;
    }
    const newUni = await UniversityModel.create({
      name: 'Ignatius Ajuru University of Education',
      acronym: 'IAUE',
      website: 'https://iaue.edu.ng',
    });
    this.defaultUniversityId = newUni._id as Types.ObjectId;
    return this.defaultUniversityId;
  }

  /**
   * Synchronizes an array of parsed announcements into MongoDB with deduplication.
   */
  public async syncAnnouncements(
    sourceId: Types.ObjectId,
    announcements: ParsedAnnouncement[]
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      found: announcements.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
    };

    const universityId = await this.getUniversityId();

    for (const item of announcements) {
      if (!item.title || !item.sourceUrl || !item.canonicalUrl) {
        stats.rejected++;
        continue;
      }

      try {
        // 1. Check existing ScraperItem or Announcement by externalId / canonicalUrl
        const existingItem = await ScraperItemModel.findOne({
          sourceId,
          canonicalUrl: item.canonicalUrl,
        });

        const existingAnnouncement = await AnnouncementModel.findOne({
          $or: [{ externalId: item.externalId }, { canonicalUrl: item.canonicalUrl }],
        });

        if (existingAnnouncement && existingItem) {
          // Compare content hash
          if (existingItem.contentHash === item.contentHash) {
            // Unchanged
            existingItem.lastSeenAt = new Date();
            await existingItem.save();
            stats.unchanged++;
            continue;
          }

          // Content Changed - Update existing announcement & item
          const previousHash = existingItem.contentHash;
          existingAnnouncement.title = item.title;
          existingAnnouncement.content = item.content;
          existingAnnouncement.summary = item.summary;
          existingAnnouncement.category = item.category;
          if (item.imageUrl) existingAnnouncement.imageUrl = item.imageUrl;
          existingAnnouncement.scrapedAt = new Date();
          await existingAnnouncement.save();

          existingItem.contentHash = item.contentHash;
          existingItem.lastSeenAt = new Date();
          existingItem.lastChangedAt = new Date();
          existingItem.status = 'changed';
          await existingItem.save();

          // Record change in history
          await scraperChangeDetectionService.recordChange({
            sourceId,
            scraperItemId: existingItem._id as Types.ObjectId,
            entityType: 'announcement',
            entityId: existingAnnouncement._id as Types.ObjectId,
            changeType: 'updated',
            previousHash,
            newHash: item.contentHash,
            changedFields: {
              title: { old: existingItem.title, new: item.title },
            },
            autoApprove: true,
          });

          stats.updated++;
        } else {
          // New Announcement
          const newAnnouncement: IAnnouncementDocument = await AnnouncementModel.create({
            universityId,
            title: item.title,
            content: item.content,
            summary: item.summary,
            category: item.category,
            sourceType: item.sourceUrl.includes('portal')
              ? 'official_portal'
              : 'official_website',
            sourceUrl: item.sourceUrl,
            canonicalUrl: item.canonicalUrl,
            externalId: item.externalId,
            publishedAt: item.publishedAt || new Date(),
            scrapedAt: new Date(),
            imageUrl: item.imageUrl,
            status: 'published',
            sourceAttribution:
              'IAUE Official Public Source (Ignatius Ajuru University of Education)',
          });

          const newItem = await ScraperItemModel.create({
            sourceId,
            url: item.sourceUrl,
            canonicalUrl: item.canonicalUrl,
            externalId: item.externalId,
            contentHash: item.contentHash,
            title: item.title,
            contentType: 'announcement',
            lastSeenAt: new Date(),
            firstSeenAt: new Date(),
            lastChangedAt: new Date(),
            status: 'active',
            metadata: {
              category: item.category,
              publishedAt: item.publishedAt,
            },
          });

          await scraperChangeDetectionService.recordChange({
            sourceId,
            scraperItemId: newItem._id as Types.ObjectId,
            entityType: 'announcement',
            entityId: newAnnouncement._id as Types.ObjectId,
            changeType: 'created',
            newHash: item.contentHash,
            changedFields: {
              title: { old: null, new: item.title },
            },
            autoApprove: true,
          });

          stats.created++;
        }
      } catch (err) {
        logger.error(`Failed to sync announcement '${item.title}': ${(err as Error).message}`);
        stats.rejected++;
      }
    }

    return stats;
  }
}

export const announcementSyncService = new AnnouncementSyncService();
