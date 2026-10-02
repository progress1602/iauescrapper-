import { Types } from 'mongoose';
import {
  normalizeCanonicalUrl,
  generateHash,
  generateExternalId,
  extractExplicitCreditUnits,
  isValidContent,
  cleanHtmlText,
} from '../src/scrapers/core/scraper.utils';
import { scraperHttpClient } from '../src/scrapers/core/scraper.http';
import { robotsChecker } from '../src/scrapers/core/scraper.robots';
import { iaueNewsParser } from '../src/scrapers/parsers/iaueNewsParser';
import { iauePortalParser } from '../src/scrapers/parsers/iauePortalParser';
import { iaueCourseParser } from '../src/scrapers/parsers/iaueCourseParser';
import { iaueFacultyParser } from '../src/scrapers/parsers/iaueFacultyParser';
import { iaueProgrammeParser } from '../src/scrapers/parsers/iaueProgrammeParser';
import { iaueOerParser } from '../src/scrapers/parsers/iaueOerParser';
import { iaueDocumentParser } from '../src/scrapers/parsers/iaueDocumentParser';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { CourseModel, FacultyModel, DepartmentModel, ProgrammeModel } from '../src/models/academic.model';
import { AnnouncementModel } from '../src/models/announcement.model';
import { ScraperSourceModel } from '../src/scrapers/models/scraperSource.model';
import { ScraperChangeModel } from '../src/scrapers/models/scraperChange.model';
import { ScraperLockModel } from '../src/scrapers/models/scraperLock.model';
import { UserModel } from '../src/models/user.model';
import { generateToken } from '../src/middleware/auth';
import { announcementSyncService } from '../src/scrapers/services/announcementSync.service';
import { courseSyncService } from '../src/scrapers/services/courseSync.service';
import { academicStructureSyncService } from '../src/scrapers/services/academicStructureSync.service';
import { scraperChangeDetectionService } from '../src/scrapers/services/scraperChangeDetection.service';

export async function runScraperTestSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  console.log('\n--- 1. Testing URL Normalization & Sanitization ---');
  {
    const url1 = normalizeCanonicalUrl('https://iaue.edu.ng/news/?utm_source=facebook&utm_medium=cpc#headline');
    assert(
      url1 === 'https://iaue.edu.ng/news',
      'Should strip tracking parameters (utm_*) and fragments (#)'
    );

    const url2 = normalizeCanonicalUrl('/admissions/undergraduate-studies/', 'https://iaue.edu.ng');
    assert(
      url2 === 'https://iaue.edu.ng/admissions/undergraduate-studies',
      'Should resolve relative paths and strip trailing slash'
    );

    const url3 = normalizeCanonicalUrl('javascript:void(0)');
    assert(url3 === null, 'Should reject javascript: pseudoprotocol');

    const url4 = normalizeCanonicalUrl('ftp://iaue.edu.ng/file.pdf');
    assert(url4 === null, 'Should reject non-http/https protocols');

    const url5 = normalizeCanonicalUrl('https://iaue.edu.ng/?page=2&sort=asc');
    assert(
      url5 === 'https://iaue.edu.ng/?page=2&sort=asc',
      'Should preserve genuine query parameters'
    );
  }

  console.log('\n--- 2. Testing SSRF Prevention & Domain Whitelist ---');
  {
    assert(
      scraperHttpClient.isPrivateOrReservedIp('127.0.0.1') === true,
      'Should identify 127.0.0.1 as private/loopback'
    );
    assert(
      scraperHttpClient.isPrivateOrReservedIp('10.0.0.5') === true,
      'Should identify 10.0.0.0/8 as private'
    );
    assert(
      scraperHttpClient.isPrivateOrReservedIp('172.16.5.1') === true,
      'Should identify 172.16.0.0/12 as private'
    );
    assert(
      scraperHttpClient.isPrivateOrReservedIp('192.168.1.100') === true,
      'Should identify 192.168.0.0/16 as private'
    );
    assert(
      scraperHttpClient.isPrivateOrReservedIp('169.254.169.254') === true,
      'Should identify cloud metadata endpoint 169.254.169.254 as reserved'
    );
    assert(
      scraperHttpClient.isPrivateOrReservedIp('::1') === true,
      'Should identify IPv6 ::1 as reserved loopback'
    );
    assert(
      scraperHttpClient.isPrivateOrReservedIp('8.8.8.8') === false,
      'Should identify public IP as non-private'
    );

    // Validate unwhitelisted domains
    const externalCheck = await scraperHttpClient.validateUrlSecurity('https://google.com/test');
    assert(
      externalCheck.valid === false,
      'Should reject domain not on approved IAUE whitelist'
    );

    const malformedCheck = await scraperHttpClient.validateUrlSecurity('file:///etc/passwd');
    assert(
      malformedCheck.valid === false,
      'Should reject file:// local system requests'
    );
  }

  console.log('\n--- 3. Testing Duplicate Detection & Content Hashing ---');
  {
    const url = 'https://iaue.edu.ng/news/resumption-date-2026';
    const id1 = generateExternalId(url);
    const id2 = generateExternalId(url);
    assert(id1 === id2, 'External ID generation must be deterministic');
    assert(id1.length === 64, 'External ID must be a 64-char SHA-256 hash');

    const hash1 = generateHash('Resumption Date Announced\nClasses commence Monday.');
    const hash2 = generateHash('Resumption Date Announced\nClasses commence Monday.');
    const hash3 = generateHash('Resumption Date Announced\nClasses commence Tuesday.');
    assert(hash1 === hash2, 'Identical content produces identical hash');
    assert(hash1 !== hash3, 'Modified content produces different hash');
  }

  console.log('\n--- 4. Testing Strict Credit Unit Extraction (Zero-Guessing) ---');
  {
    // Explicit credit units
    const c1 = extractExplicitCreditUnits('CSC 201: Structured Programming (3 Units)');
    assert(c1.units === 3 && c1.unitsExplicitlyProvided === true, 'Extracts explicit "3 Units"');

    const c2 = extractExplicitCreditUnits('MTH 110 Elementary Mathematics (4 Credit Units)');
    assert(c2.units === 4 && c2.unitsExplicitlyProvided === true, 'Extracts explicit "4 Credit Units"');

    const c3 = extractExplicitCreditUnits('EDU 101 - 2CR');
    assert(c3.units === 2 && c3.unitsExplicitlyProvided === true, 'Extracts explicit "2CR"');

    const c4 = extractExplicitCreditUnits('Course Credit Units: 6');
    assert(c4.units === 6 && c4.unitsExplicitlyProvided === true, 'Extracts explicit "Credit Units: 6"');

    // Unstated credit units -> MUST be null, NEVER guessed!
    const cNull = extractExplicitCreditUnits('GST 111 Communication in English');
    assert(
      cNull.units === null && cNull.unitsExplicitlyProvided === false,
      'Course without explicit units MUST return null units (no guessing)'
    );
  }

  console.log('\n--- 5. Testing News Parser & Categorization ---');
  {
    const sampleHtml = `
      <html>
        <head><title>Senate Approves New Academic Calendar | IAUE</title></head>
        <body>
          <article class="post">
            <h1 class="entry-title">Senate Approves 2026/2027 Academic Calendar</h1>
            <div class="entry-meta">
              <time class="entry-date" datetime="2026-10-01T08:00:00Z">October 1, 2026</time>
              <span class="author">Registrar Office</span>
            </div>
            <div class="entry-content">
              <p>The Senate of Ignatius Ajuru University of Education has approved the revised academic calendar for the 2026/2027 academic session. All matriculation and examination dates have been ratified.</p>
            </div>
          </article>
        </body>
      </html>
    `;

    const parsed = iaueNewsParser.parseArticlePage(sampleHtml, 'https://iaue.edu.ng/news/senate-approves-calendar');
    assert(parsed !== null, 'News article parsed successfully');
    assert(parsed?.title === 'Senate Approves 2026/2027 Academic Calendar', 'Correct title parsed');
    assert(parsed?.category === 'academic', 'Correctly categorized as academic');
    assert(parsed?.author === 'Registrar Office', 'Author parsed');
    assert(parsed?.publishedAt instanceof Date, 'Publication date parsed as Date');

    // Bad/incomplete content rejection
    assert(isValidContent('Click here') === false, 'Rejects "Click here" title');
    assert(isValidContent('') === false, 'Rejects empty title');
  }

  console.log('\n--- 6. Testing Portal Notice Parser & Auth Shield ---');
  {
    const authGatedHtml = `
      <html><body><form action="/login"><input type="password" name="password"><input name="regno"></form></body></html>
    `;
    assert(
      iauePortalParser.requiresAuthentication(authGatedHtml, 'https://portal.iaue.edu.ng/Account/Login') === true,
      'Correctly flags auth-gated login screen'
    );

    const publicBannerHtml = `
      <html><body>
        <div class="alert alert-info">
          Attention: All candidates seeking admission for 2026/2027 must upload O-Level results on JAMB CAPS.
        </div>
      </body></html>
    `;
    const notices = iauePortalParser.parsePublicNotices(publicBannerHtml, 'https://portal.iaue.edu.ng');
    assert(notices.length >= 1, 'Extracted public portal alert banner');
    assert(notices[0]?.category === 'admission', 'Categorized portal notice as admission');
  }

  console.log('\n--- 7. Testing Robots.txt Parser ---');
  {
    const robotsTxt = `
      User-agent: *
      Disallow: /wp-admin/
      Disallow: /private/
      Allow: /news/
    `;
    robotsChecker.setCache('https://iaue.edu.ng', robotsTxt);
    assert(
      robotsChecker.isAllowed('https://iaue.edu.ng/news/page/1', 'IAUE-Student-Hub/1.0') === true,
      'Allowed /news/ path'
    );
    assert(
      robotsChecker.isAllowed('https://iaue.edu.ng/wp-admin/edit.php', 'IAUE-Student-Hub/1.0') === false,
      'Disallowed /wp-admin/ path'
    );
  }

  console.log('\n--- 8. Testing Course Outline Parser & Code Normalization ---');
  {
    assert(iaueCourseParser.normalizeCourseCode('csc 201') === 'CSC 201', 'Normalizes "csc 201" to "CSC 201"');
    assert(iaueCourseParser.normalizeCourseCode('mth  110') === 'MTH 110', 'Normalizes extra spaces');
    assert(iaueCourseParser.inferLevelFromCode('CSC 301') === 300, 'Infers level 300 from 300-series course');

    const tableHtml = `
      <table>
        <tr><th>Course Code</th><th>Title</th><th>Credit Units</th></tr>
        <tr><td>CSC 201</td><td>Data Structures and Algorithms</td><td>3 Units</td></tr>
        <tr><td>CSC 202</td><td>Object Oriented Programming</td><td>3 Units</td></tr>
      </table>
    `;
    const courses = iaueCourseParser.parseCourses(tableHtml, 'https://iaue.edu.ng/faculty/computer-science');
    assert(courses.length === 2, 'Parsed 2 courses from curriculum table');
    assert(courses[0]?.code === 'CSC 201' && courses[0]?.units === 3, 'Course 1 has CSC 201 and 3 units');
    assert(courses[1]?.code === 'CSC 202' && courses[1]?.units === 3, 'Course 2 has CSC 202 and 3 units');
  }

  console.log('\n--- 9. Testing OER & Document Parser ---');
  {
    const oerHtml = `
      <div class="resource-item">
        <h3>CSC 101 Lecture Notes - Introduction to Computers</h3>
        <p>Comprehensive lecture note by Prof. Okon on computing fundamentals.</p>
        <a href="https://iaue.edu.ng/oer/csc101-notes.pdf">Download</a>
      </div>
    `;
    const oers = iaueOerParser.parseOerPage(oerHtml, 'https://iaue.edu.ng/open-educational-resources/');
    assert(oers.length === 1, 'Parsed OER resource card');
    assert(oers[0]?.type === 'lecture_notes', 'Categorized as lecture_notes');
    assert(oers[0]?.courseCode === 'CSC 101', 'Extracted courseCode CSC 101');

    const docHtml = `
      <div>
        <p>Download the official documents below:</p>
        <a href="https://iaue.edu.ng/files/2026-academic-calendar.pdf">2026/2027 Academic Calendar</a>
        <a href="https://iaue.edu.ng/files/approved-fees-schedule.pdf">Approved School Fees Schedule</a>
      </div>
    `;
    const docs = iaueDocumentParser.discoverDocuments(docHtml, 'https://iaue.edu.ng/downloads');
    assert(docs.length === 2, 'Discovered 2 PDF documents');
    assert(docs[0]?.inferredCategory === 'Academic Calendar', 'Inferred Academic Calendar');
    assert(docs[1]?.inferredCategory === 'School Fees Schedule', 'Inferred School Fees Schedule');
  }

  console.log('\n--- 10. Integration: Database Sync, Deduplication & Course Conflict Guard ---');
  {
    await connectDatabase();

    // Setup source
    const source = await ScraperSourceModel.create({
      name: 'Test IAUE News Source',
      baseUrl: 'https://iaue.edu.ng/news/',
      sourceType: 'news',
      enabled: true,
      crawlEnabled: true,
      scrapeIntervalMinutes: 30,
      priority: 1,
      allowedPaths: [],
      blockedPaths: [],
    });

    // 10.1 Announcement Deduplication
    const initialNews = [
      {
        title: 'IAUE Resumption Date Fixed',
        content: 'Official resumption date for returning students is October 15, 2026.',
        summary: 'Official resumption date',
        category: 'academic' as const,
        publishedAt: new Date(),
        sourceUrl: 'https://iaue.edu.ng/news/resumption-date',
        canonicalUrl: 'https://iaue.edu.ng/news/resumption-date',
        externalId: generateExternalId('https://iaue.edu.ng/news/resumption-date'),
        contentHash: generateHash('IAUE Resumption Date Fixed\nOfficial resumption date for returning students is October 15, 2026.'),
      },
    ];

    const stats1 = await announcementSyncService.syncAnnouncements(
      source._id as Types.ObjectId,
      initialNews
    );
    assert(stats1.created === 1, 'First sync creates 1 announcement');

    const stats2 = await announcementSyncService.syncAnnouncements(
      source._id as Types.ObjectId,
      initialNews
    );
    assert(stats2.unchanged === 1 && stats2.created === 0, 'Second sync skips unchanged duplicate');

    // 10.2 Academic Structure Validation
    const facultySync = await academicStructureSyncService.syncFaculties([
      {
        name: 'Faculty of Natural and Applied Sciences',
        dean: 'Prof. Amadi',
        sourceUrl: 'https://iaue.edu.ng/faculty/fnas',
        departments: ['Department of Computer Science'],
      },
    ]);
    assert(facultySync.created >= 1 || facultySync.unchanged >= 1, 'Faculty & Department hierarchy synchronized');

    // 10.3 Course Conflict Guard: Units Change triggers ScraperChange Review
    const courseInitial = [
      {
        code: 'CSC 301',
        title: 'Database Management Systems',
        units: 3,
        unitsExplicitlyProvided: true,
        sourceUrl: 'https://iaue.edu.ng/faculty/fnas/csc301',
        contentHash: generateHash('CSC 301|Database Management Systems|3'),
      },
    ];

    const cStats1 = await courseSyncService.syncCourses(
      source._id as Types.ObjectId,
      courseInitial
    );
    assert(cStats1.created === 1, 'Created CSC 301 with 3 units');

    // Official source now publishes conflicting 2 units
    const courseConflicting = [
      {
        code: 'CSC 301',
        title: 'Database Management Systems',
        units: 2, // Conflicting unit!
        unitsExplicitlyProvided: true,
        sourceUrl: 'https://iaue.edu.ng/faculty/fnas/csc301-updated',
        contentHash: generateHash('CSC 301|Database Management Systems|2'),
      },
    ];

    const cStats2 = await courseSyncService.syncCourses(
      source._id as Types.ObjectId,
      courseConflicting
    );
    assert(cStats2.conflicts === 1, 'Conflicting credit units detected and prevented from auto-overwrite');

    const courseInDb = await CourseModel.findOne({ code: 'CSC 301' });
    assert(courseInDb?.units === 3, 'Course units remained 3 (not overwritten)');
    assert(courseInDb?.unitConflict !== null, 'Course flagged with unitConflict object');

    // Verify pending change record exists
    const change = await ScraperChangeModel.findOne({
      entityType: 'course',
      entityId: courseInDb?._id,
      reviewStatus: 'pending',
    });
    assert(change !== null, 'Created pending ScraperChange record for administrator');

    // Test Admin Approval of change
    const dummyAdmin = await UserModel.findOne({ role: 'admin' });
    const approved = await scraperChangeDetectionService.approveChange(
      change!._id.toString(),
      dummyAdmin!._id as Types.ObjectId
    );
    assert(approved?.reviewStatus === 'approved', 'Admin approved change');

    const updatedCourseInDb = await CourseModel.findOne({ code: 'CSC 301' });
    assert(updatedCourseInDb?.units === 2, 'Course updated to 2 units only after admin approval');

    // 10.4 Distributed Locking
    const lock1 = await ScraperLockModel.create({
      _id: 'test-resource-lock',
      instanceId: 'inst-1',
      expiresAt: new Date(Date.now() + 60000),
    });
    assert(lock1 !== null, 'Acquired lock on test-resource-lock');

    let duplicateLockFailed = false;
    try {
      await ScraperLockModel.create({
        _id: 'test-resource-lock',
        instanceId: 'inst-2',
        expiresAt: new Date(Date.now() + 60000),
      });
    } catch {
      duplicateLockFailed = true;
    }
    assert(duplicateLockFailed === true, 'Concurrent lock acquisition correctly rejected by MongoDB unique _id');
    await ScraperLockModel.deleteOne({ _id: 'test-resource-lock' });

    // 10.5 Auth Token Generation
    const token = generateToken({
      id: dummyAdmin!._id.toString(),
      email: dummyAdmin!.email,
      role: dummyAdmin!.role,
    });
    assert(typeof token === 'string' && token.length > 20, 'Generated valid JWT token');

    await disconnectDatabase();
  }

  console.log(`\n==================================================`);
  console.log(`TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  return { passed, failed };
}
