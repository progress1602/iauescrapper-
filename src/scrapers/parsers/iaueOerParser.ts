import * as cheerio from 'cheerio';
import { ResourceType } from '../../models/resource.model';
import { ParsedOer } from '../core/scraper.types';
import {
  cleanHtmlText,
  generateHash,
  isValidContent,
  normalizeCanonicalUrl,
} from '../core/scraper.utils';

export class IaueOerParser {
  /**
   * Categorizes OER materials based on titles or tags.
   */
  public categorizeResourceType(title: string, rawType?: string): ResourceType {
    const combined = `${title} ${rawType || ''}`.toLowerCase();

    if (combined.includes('lecture note') || combined.includes('notes') || combined.includes('handout')) {
      return 'lecture_notes';
    }
    if (combined.includes('courseware') || combined.includes('module') || combined.includes('curriculum')) {
      return 'courseware';
    }
    if (combined.includes('book') || combined.includes('textbook') || combined.includes('monograph')) {
      return 'book';
    }
    if (combined.includes('journal') || combined.includes('article') || combined.includes('paper')) {
      return 'journal';
    }
    if (combined.includes('video') || combined.includes('recording') || combined.includes('mp4')) {
      return 'video';
    }
    if (combined.includes('dissertation') || combined.includes('thesis') || combined.includes('project')) {
      return 'dissertation';
    }
    if (combined.includes('.pdf') || combined.includes('document')) {
      return 'document';
    }

    return 'other_oer';
  }

  /**
   * Parses the Open Educational Resources page (https://iaue.edu.ng/open-educational-resources/)
   */
  public parseOerPage(html: string, pageUrl: string): ParsedOer[] {
    const $ = cheerio.load(html);
    const resources: ParsedOer[] = [];
    const canonical = normalizeCanonicalUrl(pageUrl) || pageUrl;

    // Look for resource cards, table rows, or download items
    $('.resource-item, .elementor-widget-wrap, tr, .card, article').each((_i, el) => {
      const node = $(el);
      const linkEl = node.find('a[href]').first();
      const href = linkEl.attr('href');
      if (!href) return;

      const title =
        cleanHtmlText(node.find('h3, h4, h5, .title, strong').first().text()) ||
        cleanHtmlText(linkEl.text());

      if (!isValidContent(title) || title.length < 5) return;

      const description = cleanHtmlText(node.find('p, .description, .summary').first().text());
      const type = this.categorizeResourceType(title, node.text());

      // Attempt to extract Course Code if mentioned (e.g. "EDU 101 Lecture Notes")
      const courseMatch = title.match(/\b([A-Za-z]{2,4}\s*\d{3,4})\b/);
      const courseCode = courseMatch && courseMatch[1] ? courseMatch[1].toUpperCase() : undefined;

      const fileUrl = normalizeCanonicalUrl(href, pageUrl) || href;
      const contentHash = generateHash(`${title}|${fileUrl}|${type}`);

      resources.push({
        title,
        description,
        type,
        sourceUrl: canonical,
        fileUrl,
        courseCode,
        contentHash,
      });
    });

    return resources;
  }
}

export const iaueOerParser = new IaueOerParser();
