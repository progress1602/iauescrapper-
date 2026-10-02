import xml2js from 'xml2js';
import { scraperHttpClient } from '../core/scraper.http';
import { normalizeCanonicalUrl } from '../core/scraper.utils';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('SitemapCrawler');

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export class SitemapCrawler {
  /**
   * Fetches and parses an XML sitemap, handling sitemap index files recursively.
   */
  public async discoverFromSitemap(
    sitemapUrl: string,
    maxUrls = 500
  ): Promise<SitemapUrl[]> {
    const results: SitemapUrl[] = [];
    const queue = [sitemapUrl];
    const visitedSitemaps = new Set<string>();

    while (queue.length > 0 && results.length < maxUrls) {
      const current = queue.shift()!;
      if (visitedSitemaps.has(current)) continue;
      visitedSitemaps.add(current);

      try {
        const res = await scraperHttpClient.get(current, { checkRobots: false });
        if (res.statusCode !== 200) continue;

        const parsedXml = await xml2js.parseStringPromise(res.data, {
          explicitArray: false,
          ignoreAttrs: true,
        });

        // Case 1: Sitemap Index (<sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>)
        if (parsedXml.sitemapindex && parsedXml.sitemapindex.sitemap) {
          const sitemaps = Array.isArray(parsedXml.sitemapindex.sitemap)
            ? parsedXml.sitemapindex.sitemap
            : [parsedXml.sitemapindex.sitemap];

          for (const s of sitemaps) {
            if (s.loc) {
              const subUrl = normalizeCanonicalUrl(s.loc);
              if (subUrl && !visitedSitemaps.has(subUrl)) {
                queue.push(subUrl);
              }
            }
          }
        }

        // Case 2: URL Set (<urlset><url><loc>...</loc><lastmod>...</lastmod></url></urlset>)
        if (parsedXml.urlset && parsedXml.urlset.url) {
          const urls = Array.isArray(parsedXml.urlset.url)
            ? parsedXml.urlset.url
            : [parsedXml.urlset.url];

          for (const u of urls) {
            if (u.loc) {
              const canonical = normalizeCanonicalUrl(u.loc);
              if (canonical) {
                results.push({
                  loc: canonical,
                  lastmod: u.lastmod,
                  changefreq: u.changefreq,
                  priority: u.priority,
                });
                if (results.length >= maxUrls) break;
              }
            }
          }
        }
      } catch (err) {
        logger.warn(`Could not parse sitemap ${current}: ${(err as Error).message}`);
      }
    }

    logger.info(`Discovered ${results.length} URLs from sitemap '${sitemapUrl}'`);
    return results;
  }
}

export const sitemapCrawler = new SitemapCrawler();
