import { iaueNewsParser } from '../parsers/iaueNewsParser';
import { iauePortalParser } from '../parsers/iauePortalParser';
import { iaueFacultyParser } from '../parsers/iaueFacultyParser';
import { iaueDepartmentParser } from '../parsers/iaueDepartmentParser';
import { iaueProgrammeParser } from '../parsers/iaueProgrammeParser';
import { iaueCourseParser } from '../parsers/iaueCourseParser';
import { iaueOerParser } from '../parsers/iaueOerParser';
import { iaueDocumentParser } from '../parsers/iaueDocumentParser';
import { iaueCrawler } from '../crawlers/iaueCrawler';
import { sitemapCrawler } from '../crawlers/sitemapCrawler';

export const scraperRegistry = {
  parsers: {
    news: iaueNewsParser,
    portal: iauePortalParser,
    faculty: iaueFacultyParser,
    department: iaueDepartmentParser,
    programme: iaueProgrammeParser,
    course: iaueCourseParser,
    oer: iaueOerParser,
    document: iaueDocumentParser,
  },
  crawlers: {
    iaueCrawler,
    sitemapCrawler,
  },
};
