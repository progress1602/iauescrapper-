import * as cheerio from 'cheerio';
import { ParsedDepartment } from '../core/scraper.types';
import { cleanHtmlText, normalizeCanonicalUrl } from '../core/scraper.utils';

export class IaueDepartmentParser {
  /**
   * Parses department pages or faculty department listing sub-sections.
   */
  public parseDepartmentPage(html: string, pageUrl: string, fallbackFaculty?: string): ParsedDepartment | null {
    const $ = cheerio.load(html);

    // Find Department heading
    let deptName = '';
    $('h1, h2, h3').each((_i, el) => {
      const text = cleanHtmlText($(el).text());
      if (
        text.toLowerCase().includes('department of') ||
        text.toLowerCase().startsWith('dept of') ||
        text.toLowerCase().includes('computer science') ||
        text.toLowerCase().includes('biological science') ||
        text.toLowerCase().includes('educational foundation')
      ) {
        if (!deptName) deptName = text;
      }
    });

    if (!deptName) {
      deptName = cleanHtmlText($('title').text().split('|')[0] || '');
    }

    if (!deptName || deptName.length < 5) {
      return null;
    }

    // Extract HOD
    let hod: string | undefined;
    const pageText = $('body').text();
    const hodMatch = pageText.match(/(?:head of department|h\.o\.d|hod)\s*[:=-]\s*([^\n\r,.]+)/i);
    if (hodMatch && hodMatch[1]) {
      hod = cleanHtmlText(hodMatch[1]);
    }

    // Extract Faculty name if mentioned on the page
    let facultyName = fallbackFaculty;
    if (!facultyName) {
      const facultyMatch = pageText.match(/faculty\s+of\s+[A-Za-z\s&]+/i);
      if (facultyMatch && facultyMatch[0]) {
        facultyName = cleanHtmlText(facultyMatch[0]);
      }
    }

    // Extract listed programmes
    const programmes: string[] = [];
    $('li, p').each((_i, el) => {
      const text = cleanHtmlText($(el).text());
      if (
        (text.includes('B.Sc') ||
          text.includes('B.Ed') ||
          text.includes('B.A') ||
          text.includes('M.Sc') ||
          text.includes('Ph.D') ||
          text.includes('PGDE')) &&
        text.length < 120
      ) {
        if (!programmes.includes(text)) {
          programmes.push(text);
        }
      }
    });

    return {
      name: deptName,
      facultyName,
      hod,
      sourceUrl: normalizeCanonicalUrl(pageUrl) || pageUrl,
      programmes,
    };
  }
}

export const iaueDepartmentParser = new IaueDepartmentParser();
