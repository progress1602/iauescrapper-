import { ScraperSourceType } from '../models/scraperSource.model';

export interface IIAUEInitialSourceConfig {
  name: string;
  baseUrl: string;
  sourceType: ScraperSourceType;
  enabled: boolean;
  crawlEnabled: boolean;
  scrapeIntervalMinutes: number;
  priority: number;
  allowedPaths: string[];
  blockedPaths: string[];
  description: string;
}

/**
 * Strict whitelist of approved domains allowed to be crawled or fetched.
 * Non-whitelisted domains cannot be fetched by the scraping engine.
 */
export const APPROVED_DOMAINS: readonly string[] = Object.freeze([
  'iaue.edu.ng',
  'portal.iaue.edu.ng',
  'enterpriseschoolsportal.iaue.edu.ng',
]);

/**
 * Initial official IAUE sources as specified by requirements.
 */
export const INITIAL_IAUE_SOURCES: IIAUEInitialSourceConfig[] = [
  {
    name: 'IAUE News & Announcements',
    baseUrl: 'https://iaue.edu.ng/news/',
    sourceType: 'news',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 30,
    priority: 1,
    allowedPaths: ['/news', '/news/page/'],
    blockedPaths: ['/wp-admin', '/wp-login.php'],
    description: 'Official university news announcements, circulars, and updates.',
  },
  {
    name: 'IAUE Admissions & Programmes',
    baseUrl: 'https://iaue.edu.ng/admissions/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 2,
    allowedPaths: ['/admissions', '/admissions/undergraduate-studies/'],
    blockedPaths: [],
    description: 'Admissions circulars, undergraduate programmes, and admission guidelines.',
  },
  {
    name: 'IAUE Undergraduate Studies',
    baseUrl: 'https://iaue.edu.ng/admissions/undergraduate-studies/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 2,
    allowedPaths: ['/admissions/undergraduate-studies'],
    blockedPaths: [],
    description: 'Undergraduate academic programmes, department requirements, and curriculum listings.',
  },
  {
    name: 'IAUE Postgraduate Studies',
    baseUrl: 'https://iaue.edu.ng/postgraduate/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 3,
    allowedPaths: ['/postgraduate'],
    blockedPaths: [],
    description: 'Postgraduate degree programmes, diplomas, Masters, and Ph.D. directories.',
  },
  {
    name: 'IAUE Faculties & Departments',
    baseUrl: 'https://iaue.edu.ng/faculty/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 2,
    allowedPaths: ['/faculty'],
    blockedPaths: [],
    description: 'University faculties, academic departments, leadership, and courses.',
  },
  {
    name: 'IAUE Open Educational Resources',
    baseUrl: 'https://iaue.edu.ng/open-educational-resources/',
    sourceType: 'oer',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 360,
    priority: 4,
    allowedPaths: ['/open-educational-resources'],
    blockedPaths: [],
    description: 'Institutional repository for lecture notes, books, journals, courseware, and dissertations.',
  },
  {
    name: 'IAUE Site Map & Discovery',
    baseUrl: 'https://iaue.edu.ng/site-map/',
    sourceType: 'website',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 5,
    allowedPaths: ['/site-map'],
    blockedPaths: [],
    description: 'Comprehensive directory of university web pages for link discovery.',
  },
  {
    name: 'IAUE School of Basic Studies',
    baseUrl: 'https://iaue.edu.ng/school-of-basic-studies/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 4,
    allowedPaths: ['/school-of-basic-studies'],
    blockedPaths: [],
    description: 'Preliminary studies, pre-degree, and basic study programme updates.',
  },
  {
    name: 'IAUE College of Continuing Education',
    baseUrl: 'https://iaue.edu.ng/college-of-continuing-education/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 4,
    allowedPaths: ['/college-of-continuing-education'],
    blockedPaths: [],
    description: 'Part-time, evening, and continuing education programmes.',
  },
  {
    name: 'IAUE Graduate School of Business',
    baseUrl: 'https://iaue.edu.ng/academics/graduate-school-of-business-and-maritime/',
    sourceType: 'academic',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 4,
    allowedPaths: ['/academics/graduate-school-of-business-and-maritime'],
    blockedPaths: [],
    description: 'Executive MBA, business, and maritime academic offerings.',
  },
  {
    name: 'IAUE Ndele Campus',
    baseUrl: 'https://iaue.edu.ng/ndele-campus/',
    sourceType: 'website',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 5,
    allowedPaths: ['/ndele-campus'],
    blockedPaths: [],
    description: 'Satellite campus notices and department branches at Ndele.',
  },
  {
    name: 'IAUE St Johns Diobu Campus',
    baseUrl: 'https://iaue.edu.ng/st-johns-diobu-campus/',
    sourceType: 'website',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 5,
    allowedPaths: ['/st-johns-diobu-campus'],
    blockedPaths: [],
    description: 'Satellite campus notices and department branches at Diobu.',
  },
  {
    name: 'IAUE Application Portal Notices',
    baseUrl: 'https://portal.iaue.edu.ng/',
    sourceType: 'portal',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 30,
    priority: 1,
    allowedPaths: ['/'],
    blockedPaths: ['/Student', '/Staff', '/Admin', '/Account/Login', '/Dashboard'],
    description: 'Public banner announcements, cut-off marks, and public application instructions.',
  },
  {
    name: 'IAUE Enterprise Schools Portal Notices',
    baseUrl: 'https://enterpriseschoolsportal.iaue.edu.ng/',
    sourceType: 'portal',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 30,
    priority: 1,
    allowedPaths: ['/'],
    blockedPaths: ['/student', '/staff', '/login', '/dashboard'],
    description: 'Public payment bulletins, registration dates, and general institutional public notices.',
  },
  {
    name: 'IAUE Main Website Root',
    baseUrl: 'https://iaue.edu.ng/',
    sourceType: 'website',
    enabled: true,
    crawlEnabled: true,
    scrapeIntervalMinutes: 720,
    priority: 5,
    allowedPaths: ['/'],
    blockedPaths: ['/wp-admin', '/wp-login.php'],
    description: 'University main homepage and root discovery page.',
  },
];
