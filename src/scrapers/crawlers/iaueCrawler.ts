import * as cheerio from 'cheerio';
import { URL } from 'url';
import { env } from '../../config/env';
import { ScraperContentType } from '../models/scraperItem.model';
import { DiscoveredLink, ScrapedPage } from '../core/scraper.types';
import { scraperHttpClient } from '../core/scraper.http';
import { generateHash, normalizeCanonicalUrl } from '../core/scraper.utils';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('IaueCrawler');

export interface CrawlerOptions {
  maxDepth?: number;
  maxPages?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
}

export class IaueCrawler {
  /**
   * Infers the likely content type from a URL path.
   */
  public inferContentType(url: string): ScraperContentType {
    const lower = url.toLowerCase();
    if (lower.includes('/news/') || lower.includes('/circular') || lower.includes('/announcement')) {
      return 'announcement';
    }
    if (lower.includes('/faculty') || lower.includes('/faculties')) {
      return 'faculty';
    }
    if (lower.includes('/department')) {
      return 'department';
    }
    if (lower.includes('/course') || lower.includes('/curriculum') || lower.includes('/syllabus')) {
      return 'course';
    }
    if (
      lower.includes('/undergraduate') ||
      lower.includes('/postgraduate') ||
      lower.includes('/program') ||
      lower.includes('/programme')
    ) {
      return 'programme';
    }
    if (lower.includes('/open-educational-resources') || lower.includes('/oer')) {
      return 'oer';
    }
    if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.pptx')) {
      return 'document';
    }
    return 'page';
  }

  /**
   * Discovers and normalizes internal links from an HTML document.
   */
  public extractLinks(
    html: string,
    currentUrl: string,
    currentDepth: number,
    allowedPaths?: string[],
    blockedPaths?: string[]
  ): DiscoveredLink[] {
    const $ = cheerio.load(html);
    const discovered: DiscoveredLink[] = [];
    const seen = new Set<string>();

    $('a[href]').each((_i, el) => {
      const rawHref = $(el).attr('href');
      if (!rawHref) return;

      const canonical = normalizeCanonicalUrl(rawHref, currentUrl);
      if (!canonical || seen.has(canonical)) return;
      seen.add(canonical);

      const parsed = new URL(canonical);
      const path = parsed.pathname;

      // Check blocked paths
      if (blockedPaths && blockedPaths.some((b) => path.startsWith(b))) {
        return;
      }

      // Check allowed paths
      if (allowedPaths && allowedPaths.length > 0) {
        const matchesAllowed = allowedPaths.some((a) => path.startsWith(a));
        if (!matchesAllowed) return;
      }

      const text = $(el).text().trim();
      const inferredContentType = this.inferContentType(canonical);

      discovered.push({
        url: rawHref,
        canonicalUrl: canonical,
        text,
        parentUrl: currentUrl,
        depth: currentDepth + 1,
        inferredContentType,
      });
    });

    return discovered;
  }

  /**
   * Crawls starting from a seed URL with breadth-first search.
   */
  public async crawl(
    seedUrl: string,
    options: CrawlerOptions = {},
    onPageCrawled?: (page: ScrapedPage) => Promise<void>
  ): Promise<{ pages: ScrapedPage[]; errors: Array<{ url: string; message: string }> }> {
    const maxDepth = options.maxDepth ?? env.SCRAPER_MAX_CRAWL_DEPTH;
    const maxPages = options.maxPages ?? env.SCRAPER_MAX_PAGES_PER_RUN;

    const queue: Array<{ url: string; depth: number }> = [{ url: seedUrl, depth: 0 }];
    const visited = new Set<string>();
    const pages: ScrapedPage[] = [];
    const errors: Array<{ url: string; message: string }> = [];

    logger.info(`Starting crawler on seed '${seedUrl}' (maxDepth: ${maxDepth}, maxPages: ${maxPages})`);

    while (queue.length > 0 && pages.length < maxPages) {
      const current = queue.shift()!;
      const canonical = normalizeCanonicalUrl(current.url) || current.url;

      if (visited.has(canonical)) continue;
      visited.add(canonical);

      // Verify domain whitelist before request
      const security = await scraperHttpClient.validateUrlSecurity(canonical);
      if (!security.valid) {
        logger.debug(`Skipping '${canonical}': ${security.reason}`);
        continue;
      }

      try {
        const res = await scraperHttpClient.get(canonical);
        const contentHash = generateHash(res.data);

        const scrapedPage: ScrapedPage = {
          url: canonical,
          canonicalUrl: canonical,
          html: res.data,
          statusCode: res.statusCode,
          contentType: res.contentType,
          depth: current.depth,
          contentHash,
        };

        pages.push(scrapedPage);

        if (onPageCrawled) {
          try {
            await onPageCrawled(scrapedPage);
          } catch (handlerErr) {
            logger.error(`Error in page handler for ${canonical}: ${(handlerErr as Error).message}`);
          }
        }

        // If not at maxDepth, extract further links to enqueue
        if (current.depth < maxDepth) {
          const links = this.extractLinks(
            res.data,
            canonical,
            current.depth,
            options.allowedPaths,
            options.blockedPaths
          );

          for (const link of links) {
            if (!visited.has(link.canonicalUrl)) {
              queue.push({ url: link.canonicalUrl, depth: link.depth });
            }
          }
        }
      } catch (crawlErr) {
        logger.warn(`Failed crawling ${canonical}: ${(crawlErr as Error).message}`);
        errors.push({
          url: canonical,
          message: (crawlErr as Error).message,
        });
      }
    }

    logger.info(`Crawler finished. Visited ${pages.length} pages, encountered ${errors.length} errors.`);
    return { pages, errors };
  }
}

export const iaueCrawler = new IaueCrawler();
