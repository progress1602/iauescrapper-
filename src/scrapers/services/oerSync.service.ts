import { Types } from 'mongoose';
import { ResourceModel } from '../../models/resource.model';
import { CourseModel, UniversityModel } from '../../models/academic.model';
import { ParsedOer } from '../core/scraper.types';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('OerSyncService');

export class OerSyncService {
  private defaultUniversityId: Types.ObjectId | null = null;

  private async getUniversityId(): Promise<Types.ObjectId> {
    if (this.defaultUniversityId) return this.defaultUniversityId;
    let uni = await UniversityModel.findOne({ acronym: 'IAUE' });
    if (!uni) {
      uni = await UniversityModel.create({
        name: 'Ignatius Ajuru University of Education',
        acronym: 'IAUE',
        website: 'https://iaue.edu.ng',
      });
    }
    this.defaultUniversityId = uni._id as Types.ObjectId;
    return this.defaultUniversityId;
  }

  /**
   * Synchronizes discovered OER and lecture materials into the Resource collection.
   */
  public async syncOerResources(
    resources: ParsedOer[]
  ): Promise<{ created: number; updated: number; unchanged: number }> {
    const universityId = await this.getUniversityId();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const item of resources) {
      if (!item.title || !item.sourceUrl) continue;

      try {
        // Link to course if matching code found
        let courseId: Types.ObjectId | undefined;
        if (item.courseCode) {
          const course = await CourseModel.findOne({ code: item.courseCode });
          if (course) {
            courseId = course._id as Types.ObjectId;
          }
        }

        const existing = await ResourceModel.findOne({
          sourceUrl: item.fileUrl || item.sourceUrl,
          type: item.type,
        });

        if (!existing) {
          await ResourceModel.create({
            universityId,
            courseId,
            title: item.title,
            description: item.description,
            type: item.type,
            sourceUrl: item.sourceUrl,
            fileUrl: item.fileUrl,
            sourceType: 'official_website',
            status: 'active',
            metadata: {
              author: item.author,
            },
          });
          created++;
        } else {
          let modified = false;
          if (courseId && !existing.courseId) {
            existing.courseId = courseId;
            modified = true;
          }
          if (item.description && !existing.description) {
            existing.description = item.description;
            modified = true;
          }

          if (modified) {
            await existing.save();
            updated++;
          } else {
            unchanged++;
          }
        }
      } catch (err) {
        logger.error(`Error syncing OER item '${item.title}': ${(err as Error).message}`);
      }
    }

    return { created, updated, unchanged };
  }
}

export const oerSyncService = new OerSyncService();
