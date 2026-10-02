import * as cheerio from 'cheerio';
import { ParsedCourse } from '../core/scraper.types';
import {
  cleanHtmlText,
  extractExplicitCreditUnits,
  generateHash,
  normalizeCanonicalUrl,
} from '../core/scraper.utils';

export class IaueCourseParser {
  /**
   * Normalizes a course code string into standard format (e.g. "csc 201" -> "CSC 201").
   */
  public normalizeCourseCode(rawCode: string): string {
    const cleaned = rawCode.trim().toUpperCase().replace(/\s+/g, ' ');
    const match = cleaned.match(/^([A-Z]{2,4})\s*(\d{3,4}[A-Z]?)$/);
    if (match && match[1] && match[2]) {
      return `${match[1]} ${match[2]}`;
    }
    return cleaned;
  }

  /**
   * Determines course level from 3-digit course code (e.g. CSC 101 -> 100, CSC 201 -> 200).
   */
  public inferLevelFromCode(code: string): number | null {
    const match = code.match(/\b([1-9])\d{2}\b/);
    if (match && match[1]) {
      return parseInt(match[1], 10) * 100;
    }
    return null;
  }

  /**
   * Parses course outlines or curriculum tables found on department and programme pages.
   */
  public parseCourses(html: string, pageUrl: string): ParsedCourse[] {
    const $ = cheerio.load(html);
    const courses: ParsedCourse[] = [];
    const canonical = normalizeCanonicalUrl(pageUrl) || pageUrl;

    // 1. Table with Course Code | Title | Units | Level | Semester
    $('table tr').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const firstCol = cleanHtmlText($(cells[0]).text());
        const codePattern = /\b([A-Za-z]{2,4}\s*\d{3,4}[A-Za-z]?)\b/;
        const codeMatch = firstCol.match(codePattern);

        if (codeMatch && codeMatch[1]) {
          const rawCode = codeMatch[1];
          const code = this.normalizeCourseCode(rawCode);
          const title = cleanHtmlText($(cells[1]).text());

          // Search subsequent cells for credit units
          let unitExtraction = { units: null as number | null, unitsExplicitlyProvided: false };
          for (let c = 2; c < cells.length; c++) {
            const cellText = cleanHtmlText($(cells[c]).text());
            const extraction = extractExplicitCreditUnits(cellText);
            if (extraction.unitsExplicitlyProvided) {
              unitExtraction = extraction;
              break;
            }
          }

          if (!unitExtraction.unitsExplicitlyProvided) {
            const rowText = cleanHtmlText($(row).text());
            unitExtraction = extractExplicitCreditUnits(rowText);
          }

          // Level
          const level = this.inferLevelFromCode(code);
          const contentHash = generateHash(`${code}|${title}|${unitExtraction.units}`);

          courses.push({
            code,
            title: title || code,
            units: unitExtraction.units,
            unitsExplicitlyProvided: unitExtraction.unitsExplicitlyProvided,
            level,
            sourceUrl: canonical,
            contentHash,
          });
        }
      }
    });

    // 2. Paragraph or list items formatted like "CSC 201: Computer Programming I (3 Units)"
    $('li, p').each((_i, el) => {
      const text = cleanHtmlText($(el).text());
      const regex = /\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[:—–-]\s*([^(]+)(?:\(([^)]+)\))?/i;
      const match = text.match(regex);

      if (match && match[1] && match[2]) {
        const rawCode = match[1];
        const rawTitle = match[2].trim();
        const code = this.normalizeCourseCode(rawCode);

        // Check if course already added from table
        if (courses.some((c) => c.code === code)) return;

        // Check units
        const unitExtraction = extractExplicitCreditUnits(text);
        const level = this.inferLevelFromCode(code);
        const contentHash = generateHash(`${code}|${rawTitle}|${unitExtraction.units}`);

        courses.push({
          code,
          title: rawTitle,
          units: unitExtraction.units,
          unitsExplicitlyProvided: unitExtraction.unitsExplicitlyProvided,
          level,
          sourceUrl: canonical,
          contentHash,
        });
      }
    });

    return courses;
  }
}

export const iaueCourseParser = new IaueCourseParser();
