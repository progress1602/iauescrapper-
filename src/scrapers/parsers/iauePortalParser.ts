import * as cheerio from 'cheerio';
import { ParsedAnnouncement } from '../core/scraper.types';
import {
  cleanHtmlText,
  generateExternalId,
  generateHash,
  isValidContent,
  normalizeCanonicalUrl,
} from '../core/scraper.utils';
import { iaueNewsParser } from './iaueNewsParser';
import { ScraperLogger } from '../core/scraper.logger';

const logger = new ScraperLogger('IauePortalParser');

export class IauePortalParser {
  /**
   * Checks whether the given HTML or page URL indicates an authenticated portal zone.
   * If so, returns true to signal that this page must be strictly skipped.
   */
  public requiresAuthentication(html: string, pageUrl: string): boolean {
    const lowerUrl = pageUrl.toLowerCase();
    const authUrlKeywords = [
      '/student/',
      '/staff/',
      '/admin/',
      '/login',
      '/account/login',
      '/dashboard',
      '/portal/login',
      '/profile',
      '/grade',
      '/fees/payment-receipt',
      '/transcript',
      '/portal/auth',
    ];

    for (const kw of authUrlKeywords) {
      if (lowerUrl.includes(kw)) {
        return true;
      }
    }

    const lowerHtml = html.toLowerCase();
    const authFormIndicators = [
      'type="password"',
      'name="password"',
      'name="matricno"',
      'name="regno"',
      'id="password"',
      'placeholder="enter matric number"',
      'placeholder="password"',
      'access denied: authentication required',
    ];

    let matchCount = 0;
    for (const indicator of authFormIndicators) {
      if (lowerHtml.includes(indicator)) {
        matchCount++;
      }
    }

    // If page contains login form or password input, it's an auth-gated or login form page
    return matchCount >= 2;
  }

  /**
   * Extracts publicly accessible portal notices, banners, alerts, and instructions.
   */
  public parsePublicNotices(html: string, pageUrl: string): ParsedAnnouncement[] {
    if (this.requiresAuthentication(html, pageUrl)) {
      logger.info(`Skipped URL '${pageUrl}' because it requires student/staff authentication.`);
      return [];
    }

    const $ = cheerio.load(html);
    const notices: ParsedAnnouncement[] = [];

    // 1. Alert banners / tickers / marquees
    $('.marquee, .alert, .notice, .bulletin, .announcement, [role="alert"]').each(
      (_i, el) => {
        const text = cleanHtmlText($(el).text());
        if (!text || text.length < 15) return;

        const title = text.length > 80 ? text.slice(0, 77) + '...' : text;
        const canonicalUrl = normalizeCanonicalUrl(pageUrl) || pageUrl;
        const category = iaueNewsParser.categorizeContent(title, text);
        const contentHash = generateHash(`${title}\n${text}`);
        const externalId = generateExternalId(`${canonicalUrl}#notice-${_i}`);

        notices.push({
          title,
          content: text,
          summary: text.slice(0, 200),
          category,
          sourceUrl: pageUrl,
          canonicalUrl,
          externalId,
          publishedAt: new Date(),
          contentHash,
        });
      }
    );

    // 2. Portal news cards / public bulletins
    $('.card, .news-box, .notice-item, .panel').each((_i, el) => {
      const card = $(el);
      const titleEl = card.find('h3, h4, h5, .title, strong').first();
      const title = cleanHtmlText(titleEl.text());
      const body = cleanHtmlText(card.text());

      if (!isValidContent(title, body) || body.length < 20) return;

      const link = card.find('a[href]').first().attr('href');
      const itemUrl = link ? normalizeCanonicalUrl(link, pageUrl) || pageUrl : pageUrl;
      const canonicalUrl = normalizeCanonicalUrl(itemUrl) || itemUrl;
      const category = iaueNewsParser.categorizeContent(title, body);
      const contentHash = generateHash(`${title}\n${body}`);
      const externalId = generateExternalId(canonicalUrl);

      notices.push({
        title,
        content: body,
        summary: body.slice(0, 200),
        category,
        sourceUrl: itemUrl,
        canonicalUrl,
        externalId,
        publishedAt: new Date(),
        contentHash,
      });
    });

    return notices;
  }
}

export const iauePortalParser = new IauePortalParser();
