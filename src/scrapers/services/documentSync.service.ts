import { Types } from 'mongoose';
import { ResourceModel } from '../../models/resource.model';
import { UniversityModel } from '../../models/academic.model';
import { ParsedDocument } from '../core/scraper.types';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('DocumentSyncService');

export class DocumentSyncService {
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
   * Synchronizes discovered documents (e.g. academic calendar PDFs, fee schedules).
   */
  public async syncDocuments(
    documents: ParsedDocument[]
  ): Promise<{ created: number; updated: number; unchanged: number }> {
    const universityId = await this.getUniversityId();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const doc of documents) {
      if (!doc.url || !doc.title) continue;

      try {
        const existing = await ResourceModel.findOne({
          sourceUrl: doc.url,
          type: 'document',
        });

        if (!existing) {
          await ResourceModel.create({
            universityId,
            title: doc.title,
            description: `Official IAUE Document (${doc.inferredCategory})`,
            type: 'document',
            sourceUrl: doc.url,
            fileUrl: doc.url,
            sourceType: doc.sourceUrl.includes('portal')
              ? 'official_portal'
              : 'official_website',
            status: 'active',
            metadata: {
              fileExtension: doc.fileExtension,
              fileSize: doc.fileSize,
            },
          });
          created++;
        } else {
          unchanged++;
        }
      } catch (err) {
        logger.error(`Error syncing document '${doc.title}': ${(err as Error).message}`);
      }
    }

    return { created, updated, unchanged };
  }
}

export const documentSyncService = new DocumentSyncService();
