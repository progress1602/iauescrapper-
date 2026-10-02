import * as cheerio from 'cheerio';
import { ParsedProgramme } from '../core/scraper.types';
import { cleanHtmlText, normalizeCanonicalUrl } from '../core/scraper.utils';

export class IaueProgrammeParser {
  /**
   * Detects degree type from programme title string.
   */
  public extractDegreeType(title: string): string {
    const upper = title.toUpperCase();
    if (upper.includes('PH.D') || upper.includes('DOCTOR OF PHILOSOPHY')) return 'Ph.D';
    if (upper.includes('M.SC') || upper.includes('MASTER OF SCIENCE')) return 'M.Sc';
    if (upper.includes('M.ED') || upper.includes('MASTER OF EDUCATION')) return 'M.Ed';
    if (upper.includes('PGDE') || upper.includes('POSTGRADUATE DIPLOMA')) return 'PGDE';
    if (upper.includes('B.SC.ED') || upper.includes('B.SC (ED)')) return 'B.Sc (Ed)';
    if (upper.includes('B.ED') || upper.includes('BACHELOR OF EDUCATION')) return 'B.Ed';
    if (upper.includes('B.SC') || upper.includes('BACHELOR OF SCIENCE')) return 'B.Sc';
    if (upper.includes('B.A.ED') || upper.includes('B.A (ED)')) return 'B.A (Ed)';
    if (upper.includes('B.A') || upper.includes('BACHELOR OF ARTS')) return 'B.A';
    return 'Undergraduate';
  }

  /**
   * Extracts academic session (e.g. 2025/2026 or 2026/2027) if present on the page.
   */
  public extractAcademicSession(html: string): string | undefined {
    const match = html.match(/\b(20\d{2}\/20\d{2})\b/);
    return match ? match[1] : undefined;
  }

  /**
   * Parses undergraduate & postgraduate programme listing pages.
   */
  public parseProgrammesPage(html: string, pageUrl: string): ParsedProgramme[] {
    const $ = cheerio.load(html);
    const programmes: ParsedProgramme[] = [];
    const sessionId = this.extractAcademicSession(html);
    const canonical = normalizeCanonicalUrl(pageUrl) || pageUrl;

    // 1. Table rows: Faculty | Department | Programme | Degree
    $('table tbody tr').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        let facultyName: string | undefined;
        let departmentName: string | undefined;
        let programmeName = '';

        if (cells.length >= 3) {
          facultyName = cleanHtmlText($(cells[0]).text());
          departmentName = cleanHtmlText($(cells[1]).text());
          programmeName = cleanHtmlText($(cells[2]).text());
        } else {
          departmentName = cleanHtmlText($(cells[0]).text());
          programmeName = cleanHtmlText($(cells[1]).text());
        }

        if (programmeName && programmeName.length > 3) {
          const degreeType = this.extractDegreeType(programmeName);
          programmes.push({
            name: programmeName,
            facultyName,
            departmentName,
            degreeType,
            sessionId,
            sourceUrl: canonical,
          });
        }
      }
    });

    // 2. Ordered / Unordered lists with degree titles
    $('ol li, ul li').each((_i, el) => {
      const text = cleanHtmlText($(el).text());
      const isDegree =
        text.includes('B.Sc') ||
        text.includes('B.Ed') ||
        text.includes('B.A') ||
        text.includes('M.Sc') ||
        text.includes('M.Ed') ||
        text.includes('Ph.D') ||
        text.includes('PGDE');

      if (isDegree && text.length < 150) {
        // Look up headings for faculty / department context
        const parentSection = $(el).closest('section, div, .elementor-widget');
        const prevHeading = parentSection.find('h2, h3, h4').first().text();
        const headingClean = cleanHtmlText(prevHeading);

        const degreeType = this.extractDegreeType(text);
        programmes.push({
          name: text,
          facultyName: headingClean.toLowerCase().includes('faculty') ? headingClean : undefined,
          departmentName: headingClean.toLowerCase().includes('department') ? headingClean : undefined,
          degreeType,
          sessionId,
          sourceUrl: canonical,
        });
      }
    });

    return programmes;
  }
}

export const iaueProgrammeParser = new IaueProgrammeParser();
