import { Types } from 'mongoose';
import { CourseModel, UniversityModel } from '../../models/academic.model';
import { ParsedCourse } from '../core/scraper.types';
import { scraperChangeDetectionService } from './scraperChangeDetection.service';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('CourseSyncService');

export class CourseSyncService {
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
   * Synchronizes parsed courses with strict credit unit rules and conflict protection.
   */
  public async syncCourses(
    sourceId: Types.ObjectId,
    courses: ParsedCourse[]
  ): Promise<{ created: number; updated: number; conflicts: number; unchanged: number }> {
    const universityId = await this.getUniversityId();
    let created = 0;
    let updated = 0;
    let conflicts = 0;
    let unchanged = 0;

    for (const item of courses) {
      if (!item.code || !item.sourceUrl) continue;

      try {
        // Find existing course by normalized code
        const existingCourse = await CourseModel.findOne({
          code: item.code,
        });

        if (!existingCourse) {
          // New Course
          await CourseModel.create({
            universityId,
            code: item.code,
            title: item.title,
            units: item.units, // NULL if not explicitly provided!
            unitsExplicitlyProvided: item.unitsExplicitlyProvided,
            level: item.level,
            sourceUrl: item.sourceUrl,
            sourceType: 'official_website',
            sourceLastCheckedAt: new Date(),
            isActive: true,
          });

          await scraperChangeDetectionService.recordChange({
            sourceId,
            entityType: 'course',
            changeType: 'created',
            newHash: item.contentHash,
            changedFields: {
              code: { old: null, new: item.code },
              units: { old: null, new: item.units },
            },
            notes: item.unitsExplicitlyProvided
              ? `Created course with explicitly stated ${item.units} units.`
              : 'Created course without explicitly stated credit units (units left as null).',
            autoApprove: true,
          });

          created++;
        } else {
          // Existing course found. Verify if units or important fields changed.
          existingCourse.sourceLastCheckedAt = new Date();

          // Check if credit units conflict!
          const previousUnits = existingCourse.units;
          const incomingUnits = item.units;

          if (
            item.unitsExplicitlyProvided &&
            previousUnits !== null &&
            incomingUnits !== null &&
            previousUnits !== incomingUnits
          ) {
            // CONFLICT DETECTED: DO NOT BLINDLY OVERWRITE!
            logger.warn(
              `Credit-unit conflict detected on ${item.code}: Existing has ${previousUnits} units, incoming source states ${incomingUnits} units.`
            );

            existingCourse.unitConflict = {
              conflictingUnits: [previousUnits, incomingUnits],
              sources: [existingCourse.sourceUrl, item.sourceUrl],
              detectedAt: new Date(),
            };
            await existingCourse.save();

            // Create pending change record for admin review
            await scraperChangeDetectionService.recordChange({
              sourceId,
              entityType: 'course',
              entityId: existingCourse._id as Types.ObjectId,
              changeType: 'updated',
              previousHash: String(previousUnits),
              newHash: String(incomingUnits),
              changedFields: {
                units: { old: previousUnits, new: incomingUnits },
              },
              notes: `CRITICAL CONFLICT: Official source proposes changing units from ${previousUnits} to ${incomingUnits}. Requires Administrator approval.`,
              autoApprove: false, // Must be approved by admin!
            });

            conflicts++;
          } else if (
            previousUnits === null &&
            item.unitsExplicitlyProvided &&
            incomingUnits !== null
          ) {
            // First time official units are discovered for a course that had null units
            existingCourse.units = incomingUnits;
            existingCourse.unitsExplicitlyProvided = true;
            existingCourse.sourceUrl = item.sourceUrl;
            await existingCourse.save();

            await scraperChangeDetectionService.recordChange({
              sourceId,
              entityType: 'course',
              entityId: existingCourse._id as Types.ObjectId,
              changeType: 'updated',
              newHash: item.contentHash,
              changedFields: {
                units: { old: null, new: incomingUnits },
              },
              notes: `Explicit units discovered: ${incomingUnits} units.`,
              autoApprove: true,
            });

            updated++;
          } else {
            // Unchanged or minor non-sensitive update
            if (existingCourse.title !== item.title && item.title.length > existingCourse.title.length) {
              existingCourse.title = item.title;
              await existingCourse.save();
              updated++;
            } else {
              await existingCourse.save();
              unchanged++;
            }
          }
        }
      } catch (err) {
        logger.error(`Error syncing course '${item.code}': ${(err as Error).message}`);
      }
    }

    return { created, updated, conflicts, unchanged };
  }
}

export const courseSyncService = new CourseSyncService();
