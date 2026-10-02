import * as cheerio from 'cheerio';
import { ParsedFaculty } from '../core/scraper.types';
import { cleanHtmlText, normalizeCanonicalUrl } from '../core/scraper.utils';

export class IaueFacultyParser {
  /**
   * Parses the faculties listing page (https://iaue.edu.ng/faculty/)
   * Extracts faculties and listed departments.
   */
  public parseFacultiesPage(html: string, pageUrl: string): ParsedFaculty[] {
    const $ = cheerio.load(html);
    const faculties: ParsedFaculty[] = [];

    $('h2, h3, h4').each((_i, el) => {
      const headingText = cleanHtmlText($(el).text());
      if (!headingText.toLowerCase().includes('faculty of')) {
        return;
      }

      const facultyName = headingText;
      let dean: string | undefined;
      const departments: string[] = [];

      // Look at parent / sibling container
      const container = $(el).closest('.elementor-widget-wrap, .faculty-item, .card, div');
      const textBlock = container.text();

      // Check for Dean info
      const deanMatch = textBlock.match(/dean\s*[:=-]\s*([^\n\r,.]+)/i);
      if (deanMatch && deanMatch[1]) {
        dean = cleanHtmlText(deanMatch[1]);
      }

      // Check for departments listed in lists
      container.find('li, p').each((_j, item) => {
        const itemText = cleanHtmlText($(item).text());
        if (
          itemText.toLowerCase().includes('department of') ||
          itemText.toLowerCase().startsWith('dept. of')
        ) {
          if (!departments.includes(itemText)) {
            departments.push(itemText);
          }
        }
      });

      const facultyLink = container.find('a[href]').first().attr('href');
      const sourceUrl = facultyLink
        ? normalizeCanonicalUrl(facultyLink, pageUrl) || pageUrl
        : pageUrl;

      faculties.push({
        name: facultyName,
        dean,
        sourceUrl,
        departments,
      });
    });

    return faculties;
  }
}

export const iaueFacultyParser = new IaueFacultyParser();
