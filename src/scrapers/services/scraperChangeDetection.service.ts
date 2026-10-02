import { Types } from 'mongoose';
import {
  ScraperChangeModel,
  EntityType,
  ChangeType,
  IScraperChangeDocument,
  IFieldChange,
} from '../models/scraperChange.model';
import { CourseModel } from '../../models/academic.model';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('ScraperChangeDetectionService');

export class ScraperChangeDetectionService {
  /**
   * Records a detected change or conflict for an entity.
   */
  public async recordChange(params: {
    sourceId: Types.ObjectId;
    scraperItemId?: Types.ObjectId;
    entityType: EntityType;
    entityId?: Types.ObjectId;
    changeType: ChangeType;
    previousHash?: string;
    newHash: string;
    changedFields: Record<string, IFieldChange>;
    notes?: string;
    autoApprove?: boolean;
  }): Promise<IScraperChangeDocument> {
    const change = new ScraperChangeModel({
      sourceId: params.sourceId,
      scraperItemId: params.scraperItemId,
      entityType: params.entityType,
      entityId: params.entityId,
      changeType: params.changeType,
      previousHash: params.previousHash,
      newHash: params.newHash,
      changedFields: params.changedFields,
      detectedAt: new Date(),
      reviewStatus: params.autoApprove ? 'approved' : 'pending',
      notes: params.notes,
    });

    await change.save();
    logger.info(
      `Recorded ${params.changeType} change for ${params.entityType} [Status: ${change.reviewStatus}]`,
      { entityId: params.entityId?.toString(), fields: Object.keys(params.changedFields) }
    );

    return change;
  }

  /**
   * Approves a pending change and applies the modification to the underlying model.
   */
  public async approveChange(
    changeId: string,
    adminUserId: Types.ObjectId
  ): Promise<IScraperChangeDocument | null> {
    const change = await ScraperChangeModel.findById(changeId);
    if (!change) {
      throw new Error(`Change record with id '${changeId}' not found.`);
    }

    if (change.reviewStatus !== 'pending') {
      return change;
    }

    // Apply change according to entity type
    if (change.entityType === 'course' && change.entityId) {
      const course = await CourseModel.findById(change.entityId);
      if (course) {
        const updatePayload: Record<string, unknown> = {};
        for (const [field, delta] of Object.entries(change.changedFields)) {
          updatePayload[field] = delta.new;
        }
        if (updatePayload.units !== undefined) {
          updatePayload.unitsExplicitlyProvided = true;
          updatePayload.unitConflict = null; // Clear conflict on approval
        }
        await CourseModel.findByIdAndUpdate(change.entityId, updatePayload);
      }
    }

    change.reviewStatus = 'approved';
    change.reviewedBy = adminUserId;
    change.reviewedAt = new Date();
    await change.save();

    logger.info(`Change ${changeId} approved by admin ${adminUserId.toString()}`);
    return change;
  }

  /**
   * Ignores a pending change without applying modifications.
   */
  public async ignoreChange(
    changeId: string,
    adminUserId: Types.ObjectId
  ): Promise<IScraperChangeDocument | null> {
    const change = await ScraperChangeModel.findById(changeId);
    if (!change) {
      throw new Error(`Change record with id '${changeId}' not found.`);
    }

    change.reviewStatus = 'ignored';
    change.reviewedBy = adminUserId;
    change.reviewedAt = new Date();
    await change.save();

    logger.info(`Change ${changeId} marked as ignored by admin ${adminUserId.toString()}`);
    return change;
  }
}

export const scraperChangeDetectionService = new ScraperChangeDetectionService();
