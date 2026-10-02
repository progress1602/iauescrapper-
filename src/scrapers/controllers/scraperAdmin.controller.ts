import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ScraperSourceModel } from '../models/scraperSource.model';
import { ScraperRunModel } from '../models/scraperRun.model';
import { ScraperChangeModel } from '../models/scraperChange.model';
import { ScraperItemModel } from '../models/scraperItem.model';
import { scraperRunService } from '../services/scraperRun.service';
import { scraperChangeDetectionService } from '../services/scraperChangeDetection.service';
import { validateUpdateSourceInput } from '../validators/scraper.validators';
import { sendSuccess, sendError } from '../../utils/response';
import { env } from '../../config/env';

function extractId(val: unknown): string | null {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return null;
}

export class ScraperAdminController {
  /**
   * GET /api/v1/admin/scrapers
   * Lists all configured IAUE scraping sources.
   */
  public async getSources(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sources = await ScraperSourceModel.find().sort({ priority: 1, name: 1 });
      sendSuccess(res, 'Scraper sources retrieved successfully', sources);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_SOURCES_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/scrapers/:id
   * Retrieves single source details.
   */
  public async getSourceById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid source ID parameter', 400, 'INVALID_ID');
        return;
      }

      const source = await ScraperSourceModel.findById(id);
      if (!source) {
        sendError(res, 'Scraper source not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, 'Scraper source retrieved successfully', source);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_SOURCE_FAILED');
    }
  }

  /**
   * PATCH /api/v1/admin/scrapers/:id
   * Updates source settings (enable/disable, intervals, paths).
   */
  public async updateSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid source ID parameter', 400, 'INVALID_ID');
        return;
      }

      const validation = validateUpdateSourceInput(req.body);
      if (!validation.valid || !validation.data) {
        sendError(res, 'Validation error', 400, 'VALIDATION_ERROR', validation.errors);
        return;
      }

      const updated = await ScraperSourceModel.findByIdAndUpdate(id, validation.data, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        sendError(res, 'Scraper source not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, `Scraper source '${updated.name}' updated successfully`, updated);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'UPDATE_SOURCE_FAILED');
    }
  }

  /**
   * POST /api/v1/admin/scrapers/:id/run
   * Triggers a manual scrape run for a given source.
   */
  public async runSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid source ID parameter', 400, 'INVALID_ID');
        return;
      }

      const source = await ScraperSourceModel.findById(id);
      if (!source) {
        sendError(res, 'Scraper source not found', 404, 'NOT_FOUND');
        return;
      }

      const run = await scraperRunService.executeRun(source._id, 'manual');
      sendSuccess(res, `Manual scraper run completed for '${source.name}'`, run);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'SCRAPER_RUN_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/scraper-runs
   * Lists past scraper runs with filtering and pagination.
   */
  public async getRuns(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      const sourceId = extractId(req.query.sourceId);
      if (sourceId && Types.ObjectId.isValid(sourceId)) {
        filter.sourceId = sourceId;
      }

      const [runs, total] = await Promise.all([
        ScraperRunModel.find(filter)
          .sort({ startedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('sourceId', 'name baseUrl sourceType'),
        ScraperRunModel.countDocuments(filter),
      ]);

      sendSuccess(res, 'Scraper runs retrieved successfully', runs, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_RUNS_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/scraper-runs/:id
   * Retrieves single run details and errors.
   */
  public async getRunById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid run ID parameter', 400, 'INVALID_ID');
        return;
      }

      const run = await ScraperRunModel.findById(id).populate(
        'sourceId',
        'name baseUrl sourceType'
      );
      if (!run) {
        sendError(res, 'Scraper run record not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, 'Scraper run retrieved successfully', run);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_RUN_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/scraper-changes
   * Lists detected changes, pending reviews, and conflicts.
   */
  public async getChanges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (req.query.reviewStatus) {
        filter.reviewStatus = req.query.reviewStatus;
      }
      if (req.query.entityType) {
        filter.entityType = req.query.entityType;
      }

      const [changes, total] = await Promise.all([
        ScraperChangeModel.find(filter)
          .sort({ detectedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('sourceId', 'name baseUrl')
          .populate('reviewedBy', 'name email'),
        ScraperChangeModel.countDocuments(filter),
      ]);

      sendSuccess(res, 'Scraper changes retrieved successfully', changes, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_CHANGES_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/scraper-changes/:id
   * Retrieves single change detail.
   */
  public async getChangeById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid change ID parameter', 400, 'INVALID_ID');
        return;
      }

      const change = await ScraperChangeModel.findById(id)
        .populate('sourceId', 'name baseUrl')
        .populate('reviewedBy', 'name email');

      if (!change) {
        sendError(res, 'Scraper change record not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, 'Scraper change record retrieved successfully', change);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_CHANGE_FAILED');
    }
  }

  /**
   * POST /api/v1/admin/scraper-changes/:id/approve
   * Approves a pending change and applies modifications.
   */
  public async approveChange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid change ID parameter', 400, 'INVALID_ID');
        return;
      }

      const adminId = req.user!._id as Types.ObjectId;
      const approved = await scraperChangeDetectionService.approveChange(id, adminId);
      sendSuccess(res, 'Scraper change approved and applied successfully', approved);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'APPROVE_CHANGE_FAILED');
    }
  }

  /**
   * POST /api/v1/admin/scraper-changes/:id/ignore
   * Marks a pending change as ignored without applying modifications.
   */
  public async ignoreChange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = extractId(req.params.id);
      if (!id || !Types.ObjectId.isValid(id)) {
        sendError(res, 'Invalid change ID parameter', 400, 'INVALID_ID');
        return;
      }

      const adminId = req.user!._id as Types.ObjectId;
      const ignored = await scraperChangeDetectionService.ignoreChange(id, adminId);
      sendSuccess(res, 'Scraper change ignored successfully', ignored);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'IGNORE_CHANGE_FAILED');
    }
  }

  /**
   * GET /api/v1/admin/scrapers/health
   * Returns aggregated diagnostic health, enabled/disabled counts, last runs, error counts.
   */
  public async getHealth(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const [
        sources,
        runningJobs,
        pendingChanges,
        totalItems,
        lastSuccessRun,
        lastFailedRun,
      ] = await Promise.all([
        ScraperSourceModel.find().lean(),
        ScraperRunModel.countDocuments({ status: 'running' }),
        ScraperChangeModel.countDocuments({ reviewStatus: 'pending' }),
        ScraperItemModel.countDocuments({ status: 'active' }),
        ScraperRunModel.findOne({ status: 'completed' }).sort({ completedAt: -1 }).lean(),
        ScraperRunModel.findOne({ status: 'failed' }).sort({ completedAt: -1 }).lean(),
      ]);

      const enabledSources = sources.filter((s) => s.enabled);
      const disabledSources = sources.filter((s) => !s.enabled);
      const totalErrors = sources.filter((s) => !!s.lastError).length;

      let healthStatus = 'healthy';
      if (!env.SCRAPER_ENABLED) {
        healthStatus = 'disabled';
      } else if (
        totalErrors > 0 ||
        (lastFailedRun &&
          (!lastSuccessRun || lastFailedRun.startedAt > lastSuccessRun.startedAt))
      ) {
        healthStatus = 'degraded';
      }

      const responseData = {
        status: healthStatus,
        subsystemEnabled: env.SCRAPER_ENABLED,
        enabledSourcesCount: enabledSources.length,
        disabledSourcesCount: disabledSources.length,
        runningJobs,
        pendingChanges,
        totalItemsImported: totalItems,
        totalSourcesWithErrors: totalErrors,
        lastSuccessfulRun: lastSuccessRun
          ? {
              runId: lastSuccessRun._id,
              completedAt: lastSuccessRun.completedAt,
              durationMs: lastSuccessRun.durationMs,
              itemsCreated: lastSuccessRun.itemsCreated,
            }
          : null,
        lastFailedRun: lastFailedRun
          ? {
              runId: lastFailedRun._id,
              failedAt: lastFailedRun.completedAt || lastFailedRun.startedAt,
              errors: lastFailedRun.runErrors,
            }
          : null,
        sources: sources.map((s) => ({
          id: s._id,
          name: s.name,
          sourceType: s.sourceType,
          enabled: s.enabled,
          lastRunAt: s.lastRunAt,
          lastSuccessAt: s.lastSuccessAt,
          lastFailureAt: s.lastFailureAt,
          lastError: s.lastError,
        })),
      };

      sendSuccess(res, 'Scraper health retrieved', responseData);
    } catch (err) {
      sendError(res, (err as Error).message, 500, 'FETCH_HEALTH_FAILED');
    }
  }
}

export const scraperAdminController = new ScraperAdminController();
