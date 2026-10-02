import * as cheerio from 'cheerio';
import { AnnouncementCategory } from '../../models/announcement.model';
import { ParsedAnnouncement } from '../core/scraper.types';
import {
  cleanHtmlText,
  generateExternalId,
  generateHash,
  isValidContent,
  normalizeCanonicalUrl,
} from '../core/scraper.utils';

export class IaueNewsParser {
  /**
   * Automatically classifies news/announcements based on keywords.
   */
  public categorizeContent(title: string, content: string): AnnouncementCategory {
    const combined = `${title} ${content}`.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // High-priority Academic checks
    if (
      lowerTitle.includes('calendar') ||
      combined.includes('academic calendar') ||
      combined.includes('resumption date') ||
      combined.includes('senate approves') ||
      combined.includes('senate decision') ||
      combined.includes('semester examination')
    ) {
      return 'academic';
    }

    if (
      combined.includes('admission') ||
      combined.includes('post-utme') ||
      combined.includes('jamb') ||
      combined.includes('screening') ||
      combined.includes('clearance') ||
      combined.includes('cut-off')
    ) {
      return 'admission';
    }
    if (
      combined.includes('exam') ||
      combined.includes('examination') ||
      combined.includes('timetable') ||
      combined.includes('cbt test')
    ) {
      return 'examination';
    }
    if (
      combined.includes('registration') ||
      combined.includes('matriculation') ||
      combined.includes('freshers orientation')
    ) {
      return 'registration';
    }
    if (
      combined.includes('school fees') ||
      combined.includes('tuition') ||
      combined.includes('payment') ||
      combined.includes('remita') ||
      combined.includes('acceptance fee')
    ) {
      return 'fees';
    }
    if (
      combined.includes('scholarship') ||
      combined.includes('bursary') ||
      combined.includes('grant')
    ) {
      return 'scholarship';
    }
    if (
      combined.includes('result') ||
      combined.includes('grade') ||
      combined.includes('transcript')
    ) {
      return 'result';
    }
    if (
      combined.includes('calendar') ||
      combined.includes('resumption') ||
      combined.includes('senate') ||
      combined.includes('lecture') ||
      combined.includes('academic session') ||
      combined.includes('semester')
    ) {
      return 'academic';
    }
    if (
      combined.includes('convocation') ||
      combined.includes('inauguration') ||
      combined.includes('conference') ||
      combined.includes('workshop') ||
      combined.includes('ceremony') ||
      combined.includes('event')
    ) {
      return 'event';
    }

    return 'general';
  }

  /**
   * Parses single article detail pages or items embedded in listing pages.
   */
  public parseArticlePage(html: string, pageUrl: string): ParsedAnnouncement | null {
    const $ = cheerio.load(html);
    const canonical = normalizeCanonicalUrl(pageUrl) || pageUrl;

    // Resilient Title extraction with fallbacks
    let title =
      $('h1.entry-title').first().text() ||
      $('h1.post-title').first().text() ||
      $('article h1').first().text() ||
      $('header h1').first().text() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().split('|')[0] ||
      '';

    title = cleanHtmlText(title);

    // Resilient Content extraction with fallbacks
    let content = '';
    const contentSelectors = [
      '.entry-content',
      '.post-content',
      'article .content',
      '.elementor-widget-theme-post-content',
      '.td-post-content',
      'article',
    ];

    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        // Remove scripts, styles, navigations inside content
        el.find('script, style, nav, .sharedaddy, .wp-block-navigation').remove();
        content = cleanHtmlText(el.text());
        if (content.length > 50) break;
      }
    }

    if (!isValidContent(title, content)) {
      return null;
    }

    // Publication Date extraction
    let publishedAt: Date | undefined;
    const dateStr =
      $('time.entry-date').attr('datetime') ||
      $('time').attr('datetime') ||
      $('meta[property="article:published_time"]').attr('content') ||
      $('.post-date').text() ||
      $('.entry-date').text();

    if (dateStr) {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate;
      }
    }

    // Featured Image extraction
    const imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('img.wp-post-image').attr('src') ||
      $('article img').first().attr('src');

    // Author
    const author =
      cleanHtmlText($('.author').first().text()) ||
      cleanHtmlText($('.entry-author').first().text()) ||
      $('meta[name="author"]').attr('content');

    // Categories / Tags
    const tags: string[] = [];
    $('.category a, .post-categories a, .tags a, .entry-tags a').each((_i, el) => {
      const text = cleanHtmlText($(el).text());
      if (text && !tags.includes(text)) {
        tags.push(text);
      }
    });

    const category = this.categorizeContent(title, content);
    const summary = content.length > 250 ? content.slice(0, 247) + '...' : content;
    const contentHash = generateHash(`${title}\n${content}`);
    const externalId = generateExternalId(canonical);

    return {
      title,
      content,
      summary,
      category,
      publishedAt,
      imageUrl,
      sourceUrl: pageUrl,
      canonicalUrl: canonical,
      externalId,
      author,
      tags,
      contentHash,
    };
  }

  /**
   * Extracts articles from a news archive / listing page.
   */
  public parseListingPage(html: string, pageUrl: string): ParsedAnnouncement[] {
    const $ = cheerio.load(html);
    const results: ParsedAnnouncement[] = [];

    // Articles or cards
    $('article, .post, .post-item, .blog-entry, .td_module_wrap').each((_i, el) => {
      const node = $(el);
      const linkEl = node.find('a[href]').first();
      const rawLink = linkEl.attr('href') || '';
      const canonicalUrl = normalizeCanonicalUrl(rawLink, pageUrl);
      if (!canonicalUrl) return;

      const title = cleanHtmlText(
        node.find('h1, h2, h3, .entry-title, .post-title').first().text()
      );
      if (!title || title.length < 5) return;

      const snippet = cleanHtmlText(
        node.find('.entry-content, .post-excerpt, p').first().text()
      );

      const dateStr =
        node.find('time').attr('datetime') || node.find('.post-date, .entry-date').text();
      let publishedAt: Date | undefined;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) publishedAt = d;
      }

      const imageUrl = node.find('img').first().attr('src');
      const content = snippet || title;
      const category = this.categorizeContent(title, content);
      const contentHash = generateHash(`${title}\n${content}`);
      const externalId = generateExternalId(canonicalUrl);

      results.push({
        title,
        content,
        summary: snippet,
        category,
        publishedAt,
        imageUrl,
        sourceUrl: rawLink,
        canonicalUrl,
        externalId,
        contentHash,
      });
    });

    return results;
  }
}

export const iaueNewsParser = new IaueNewsParser();
