import crypto from 'crypto';
import { Types } from 'mongoose';
import { ScraperSourceModel } from '../models/scraperSource.model';
import {
  ScraperRunModel,
  IScraperRunDocument,
  IScraperError,
} from '../models/scraperRun.model';
import { ScraperLockModel } from '../models/scraperLock.model';
import { iaueCrawler } from '../crawlers/iaueCrawler';
import { iaueNewsParser } from '../parsers/iaueNewsParser';
import { iauePortalParser } from '../parsers/iauePortalParser';
import { iaueFacultyParser } from '../parsers/iaueFacultyParser';
import { iaueProgrammeParser } from '../parsers/iaueProgrammeParser';
import { iaueCourseParser } from '../parsers/iaueCourseParser';
import { iaueOerParser } from '../parsers/iaueOerParser';
import { iaueDocumentParser } from '../parsers/iaueDocumentParser';
import { announcementSyncService } from './announcementSync.service';
import { academicStructureSyncService } from './academicStructureSync.service';
import { courseSyncService } from './courseSync.service';
import { oerSyncService } from './oerSync.service';
import { documentSyncService } from './documentSync.service';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('ScraperRunService');
const INSTANCE_ID = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

export class ScraperRunService {
  /**
   * Attempts to acquire an atomic distributed lock for a specific source.
   */
  private async acquireLock(lockKey: string, ttlSeconds = 600): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    try {
      await ScraperLockModel.create({
        _id: lockKey,
        instanceId: INSTANCE_ID,
        acquiredAt: new Date(),
        expiresAt,
      });
      return true;
    } catch {
      // Check if existing lock is expired
      const existing = await ScraperLockModel.findById(lockKey);
      if (existing && existing.expiresAt < new Date()) {
        try {
          await ScraperLockModel.findByIdAndUpdate(lockKey, {
            instanceId: INSTANCE_ID,
            acquiredAt: new Date(),
            expiresAt,
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Releases an acquired distributed lock.
   */
  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await ScraperLockModel.deleteOne({ _id: lockKey, instanceId: INSTANCE_ID });
    } catch (err) {
      logger.error(`Failed to release lock '${lockKey}': ${(err as Error).message}`);
    }
  }

  /**
   * Executes a full scraping and synchronization run for a given ScraperSource.
   */
  public async executeRun(
    sourceId: string | Types.ObjectId,
    triggerType: 'scheduled' | 'manual' = 'scheduled'
  ): Promise<IScraperRunDocument> {
    const source = await ScraperSourceModel.findById(sourceId);
    if (!source) {
      throw new Error(`ScraperSource with id '${sourceId}' not found.`);
    }

    if (!source.enabled) {
      throw new Error(`Source '${source.name}' is currently disabled.`);
    }

    const lockKey = `source:${source._id.toString()}`;
    const acquired = await this.acquireLock(lockKey);
    if (!acquired) {
      logger.warn(`Source '${source.name}' is already being scraped by another instance. Skipping.`);
      throw new Error(`Job lock already held for source '${source.name}'. Another instance is active.`);
    }

    const runStartTime = Date.now();
    const run = new ScraperRunModel({
      sourceId: source._id,
      status: 'running',
      startedAt: new Date(),
      triggerType,
    });
    await run.save();

    source.lastRunAt = new Date();
    await source.save();

    let totalItemsFound = 0;
    let totalItemsCreated = 0;
    let totalItemsUpdated = 0;
    let totalItemsUnchanged = 0;
    let totalItemsRejected = 0;
    const runErrors: IScraperError[] = [];

    try {
      // Execute Crawler
      const crawlResult = await iaueCrawler.crawl(
        source.baseUrl,
        {
          allowedPaths: source.allowedPaths,
          blockedPaths: source.blockedPaths,
        },
        async (page) => {
          // Process page in streaming fashion
          try {
            // Document discovery on every page
            const docs = iaueDocumentParser.discoverDocuments(page.html, page.url);
            if (docs.length > 0) {
              const docStats = await documentSyncService.syncDocuments(docs);
              totalItemsFound += docs.length;
              totalItemsCreated += docStats.created;
              totalItemsUpdated += docStats.updated;
              totalItemsUnchanged += docStats.unchanged;
            }

            if (source.sourceType === 'news') {
              // Parse news listing or article
              const article = iaueNewsParser.parseArticlePage(page.html, page.url);
              const listings = iaueNewsParser.parseListingPage(page.html, page.url);
              const allNews = article ? [article, ...listings] : listings;

              if (allNews.length > 0) {
                const stats = await announcementSyncService.syncAnnouncements(
                  source._id as Types.ObjectId,
                  allNews
                );
                totalItemsFound += stats.found;
                totalItemsCreated += stats.created;
                totalItemsUpdated += stats.updated;
                totalItemsUnchanged += stats.unchanged;
                totalItemsRejected += stats.rejected;
              }
            } else if (source.sourceType === 'portal') {
              const notices = iauePortalParser.parsePublicNotices(page.html, page.url);
              if (notices.length > 0) {
                const stats = await announcementSyncService.syncAnnouncements(
                  source._id as Types.ObjectId,
                  notices
                );
                totalItemsFound += stats.found;
                totalItemsCreated += stats.created;
                totalItemsUpdated += stats.updated;
                totalItemsUnchanged += stats.unchanged;
                totalItemsRejected += stats.rejected;
              }
            } else if (source.sourceType === 'academic') {
              // Faculties
              const faculties = iaueFacultyParser.parseFacultiesPage(page.html, page.url);
              if (faculties.length > 0) {
                const fStats = await academicStructureSyncService.syncFaculties(faculties);
                totalItemsFound += faculties.length;
                totalItemsCreated += fStats.created;
                totalItemsUpdated += fStats.updated;
                totalItemsUnchanged += fStats.unchanged;
              }

              // Programmes
              const programmes = iaueProgrammeParser.parseProgrammesPage(page.html, page.url);
              if (programmes.length > 0) {
                const pStats = await academicStructureSyncService.syncProgrammes(programmes);
                totalItemsFound += programmes.length;
                totalItemsCreated += pStats.created;
                totalItemsUpdated += pStats.updated;
                totalItemsUnchanged += pStats.unchanged;
              }

              // Courses
              const courses = iaueCourseParser.parseCourses(page.html, page.url);
              if (courses.length > 0) {
                const cStats = await courseSyncService.syncCourses(
                  source._id as Types.ObjectId,
                  courses
                );
                totalItemsFound += courses.length;
                totalItemsCreated += cStats.created;
                totalItemsUpdated += cStats.updated;
                totalItemsUnchanged += cStats.unchanged;
              }
            } else if (source.sourceType === 'oer') {
              const oers = iaueOerParser.parseOerPage(page.html, page.url);
              if (oers.length > 0) {
                const oStats = await oerSyncService.syncOerResources(oers);
                totalItemsFound += oers.length;
                totalItemsCreated += oStats.created;
                totalItemsUpdated += oStats.updated;
                totalItemsUnchanged += oStats.unchanged;
              }
            }
          } catch (pageProcessingErr) {
            logger.warn(`Error processing scraped content from ${page.url}: ${(pageProcessingErr as Error).message}`);
            runErrors.push({
              url: page.url,
              message: (pageProcessingErr as Error).message,
              timestamp: new Date(),
            });
          }
        }
      );

      for (const err of crawlResult.errors) {
        runErrors.push({
          url: err.url,
          message: err.message,
          timestamp: new Date(),
        });
      }

      run.pagesVisited = crawlResult.pages.length;
      run.itemsFound = totalItemsFound;
      run.itemsCreated = totalItemsCreated;
      run.itemsUpdated = totalItemsUpdated;
      run.itemsUnchanged = totalItemsUnchanged;
      run.itemsRejected = totalItemsRejected;
      run.runErrors = runErrors;
      run.durationMs = Date.now() - runStartTime;
      run.completedAt = new Date();

      if (runErrors.length > 0 && crawlResult.pages.length > 0) {
        run.status = 'partial';
      } else if (runErrors.length > 0 && crawlResult.pages.length === 0) {
        run.status = 'failed';
      } else {
        run.status = 'completed';
      }

      await run.save();

      // Update source
      if (run.status === 'failed') {
        source.lastFailureAt = new Date();
        source.lastError = runErrors[0]?.message || 'Unknown scrape failure';
      } else {
        source.lastSuccessAt = new Date();
        source.lastError = undefined;
      }
      await source.save();

      logger.info(
        `Scraper run finished for '${source.name}' in ${run.durationMs}ms [Status: ${run.status}]`,
        { created: totalItemsCreated, updated: totalItemsUpdated, errors: runErrors.length }
      );

      return run;
    } catch (criticalErr) {
      run.status = 'failed';
      run.completedAt = new Date();
      run.durationMs = Date.now() - runStartTime;
      runErrors.push({
        message: (criticalErr as Error).message,
        timestamp: new Date(),
      });
      run.runErrors = runErrors;
      await run.save();

      source.lastFailureAt = new Date();
      source.lastError = (criticalErr as Error).message;
      await source.save();

      throw criticalErr;
    } finally {
      await this.releaseLock(lockKey);
    }
  }
}

export const scraperRunService = new ScraperRunService();
