import cron, { ScheduledTask } from 'node-cron';
import { env } from '../../config/env';
import { ScraperSourceModel } from '../models/scraperSource.model';
import { scraperRunService } from '../services/scraperRun.service';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('ScraperScheduler');

export class ScraperScheduler {
  private tasks: ScheduledTask[] = [];
  private isRunning = false;

  /**
   * Converts minutes into a valid standard cron pattern.
   * Examples:
   * 30 mins -> "* / 30 * * * *"
   * 720 mins (12h) -> "0 * / 12 * * *"
   * 360 mins (6h) -> "0 * / 6 * * *"
   */
  public minutesToCron(minutes: number): string {
    if (minutes <= 0) return '*/30 * * * *';
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `0 */${hours} * * *`;
    }
    const days = Math.floor(hours / 24);
    return `0 0 */${days} * *`;
  }

  /**
   * Initializes and starts all periodic background scrapers.
   */
  public start(): void {
    if (!env.SCRAPER_ENABLED) {
      logger.info('Scraper subsystem is disabled via SCRAPER_ENABLED=false. Skipping scheduler setup.');
      return;
    }

    if (this.isRunning) {
      logger.warn('ScraperScheduler is already active.');
      return;
    }

    this.isRunning = true;
    logger.info('Initializing automated IAUE background scraping scheduler...');

    // 1. News Scraper Job
    const newsCron = this.minutesToCron(env.SCRAPER_NEWS_INTERVAL_MINUTES);
    const newsTask = cron.schedule(newsCron, async () => {
      await this.runSourcesByType('news');
    });
    this.tasks.push(newsTask);

    // 2. Portal Scraper Job
    const portalCron = this.minutesToCron(env.SCRAPER_PORTAL_INTERVAL_MINUTES);
    const portalTask = cron.schedule(portalCron, async () => {
      await this.runSourcesByType('portal');
    });
    this.tasks.push(portalTask);

    // 3. Academic Structure & Courses Scraper Job
    const academicCron = this.minutesToCron(env.SCRAPER_ACADEMIC_INTERVAL_MINUTES);
    const academicTask = cron.schedule(academicCron, async () => {
      await this.runSourcesByType('academic');
    });
    this.tasks.push(academicTask);

    // 4. OER Scraper Job
    const oerCron = this.minutesToCron(env.SCRAPER_OER_INTERVAL_MINUTES);
    const oerTask = cron.schedule(oerCron, async () => {
      await this.runSourcesByType('oer');
    });
    this.tasks.push(oerTask);

    // 5. Document / General Website Discovery Job
    const docCron = this.minutesToCron(env.SCRAPER_DOCUMENT_INTERVAL_MINUTES);
    const docTask = cron.schedule(docCron, async () => {
      await this.runSourcesByType('document');
      await this.runSourcesByType('website');
    });
    this.tasks.push(docTask);

    logger.info(`Scheduled 5 periodic crawler jobs: News (${newsCron}), Portal (${portalCron}), Academic (${academicCron}), OER (${oerCron}), Docs/Website (${docCron})`);
  }

  /**
   * Helper to trigger all enabled sources matching a specific sourceType.
   */
  public async runSourcesByType(sourceType: string): Promise<void> {
    try {
      const sources = await ScraperSourceModel.find({
        sourceType,
        enabled: true,
      });

      for (const source of sources) {
        try {
          logger.info(`Triggering scheduled run for source '${source.name}' (${source._id.toString()})`);
          await scraperRunService.executeRun(source._id, 'scheduled');
        } catch (runErr) {
          logger.warn(`Scheduled run skipped or failed for '${source.name}': ${(runErr as Error).message}`);
        }
      }
    } catch (dbErr) {
      logger.error(`Error querying sources for type '${sourceType}': ${(dbErr as Error).message}`);
    }
  }

  /**
   * Stops all running cron tasks cleanly.
   */
  public stop(): void {
    logger.info('Stopping all active scraper cron tasks...');
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.isRunning = false;
    logger.info('ScraperScheduler stopped.');
  }
}

export const scraperScheduler = new ScraperScheduler();
