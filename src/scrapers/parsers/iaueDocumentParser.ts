import * as cheerio from 'cheerio';
import { ParsedDocument } from '../core/scraper.types';
import { cleanHtmlText, normalizeCanonicalUrl } from '../core/scraper.utils';

export class IaueDocumentParser {
  private documentExtensions = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']);

  /**
   * Scans an HTML page for downloadable academic documents (PDFs, docx, etc.).
   */
  public discoverDocuments(html: string, pageUrl: string): ParsedDocument[] {
    const $ = cheerio.load(html);
    const documents: ParsedDocument[] = [];
    const seenUrls = new Set<string>();

    $('a[href]').each((_i, el) => {
      const rawHref = $(el).attr('href');
      if (!rawHref) return;

      const normalized = normalizeCanonicalUrl(rawHref, pageUrl);
      if (!normalized) return;

      const lowerUrl = normalized.toLowerCase();

      // Find file extension
      let matchedExt: string | null = null;
      for (const ext of this.documentExtensions) {
        if (lowerUrl.endsWith(ext) || lowerUrl.includes(`${ext}?`)) {
          matchedExt = ext;
          break;
        }
      }

      if (!matchedExt || seenUrls.has(normalized)) return;
      seenUrls.add(normalized);

      const linkText = cleanHtmlText($(el).text());
      const title =
        linkText && linkText.length > 3
          ? linkText
          : normalized.split('/').pop()?.replace(matchedExt, '').replace(/[-_]/g, ' ') ||
            'Official IAUE Document';

      // Infer category
      let inferredCategory = 'General Circular';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('calendar')) inferredCategory = 'Academic Calendar';
      else if (lowerTitle.includes('timetable') || lowerTitle.includes('exam'))
        inferredCategory = 'Examination Schedule';
      else if (lowerTitle.includes('fees') || lowerTitle.includes('payment'))
        inferredCategory = 'School Fees Schedule';
      else if (lowerTitle.includes('admission') || lowerTitle.includes('merit'))
        inferredCategory = 'Admission List';
      else if (lowerTitle.includes('matriculation')) inferredCategory = 'Matriculation Order';
      else if (lowerTitle.includes('course') || lowerTitle.includes('curriculum'))
        inferredCategory = 'Curriculum & Courses';

      documents.push({
        title,
        url: normalized,
        fileExtension: matchedExt,
        sourceUrl: pageUrl,
        inferredCategory,
      });
    });

    return documents;
  }
}

export const iaueDocumentParser = new IaueDocumentParser();
