# IAUE Student Hub Backend & Data Synchronization Subsystem

Production-ready backend subsystem for the IAUE Student Hub built with Node.js, Express, TypeScript, Mongoose, and Cheerio. Features automated scraping of official public Ignatius Ajuru University of Education (IAUE) portals and websites, robust deduplication, content hashing, academic structure versioning, zero-guess credit-unit conflict protection, distributed job locking for multi-instance deployments on Render, and an administrative review API.

---

## 🏛️ Official IAUE Sources Monitored

All sources are monitored strictly under the whitelist:
- **Main Website**: `https://iaue.edu.ng/`
- **News & Announcements**: `https://iaue.edu.ng/news/`
- **Admissions**: `https://iaue.edu.ng/admissions/`
- **Undergraduate Studies**: `https://iaue.edu.ng/admissions/undergraduate-studies/`
- **Postgraduate Studies**: `https://iaue.edu.ng/postgraduate/`
- **Faculties & Departments**: `https://iaue.edu.ng/faculty/`
- **Open Educational Resources (OER)**: `https://iaue.edu.ng/open-educational-resources/`
- **Site Map & Link Discovery**: `https://iaue.edu.ng/site-map/`
- **School of Basic Studies**: `https://iaue.edu.ng/school-of-basic-studies/`
- **College of Continuing Education**: `https://iaue.edu.ng/college-of-continuing-education/`
- **Graduate School of Business**: `https://iaue.edu.ng/academics/graduate-school-of-business-and-maritime/`
- **Ndele Satellite Campus**: `https://iaue.edu.ng/ndele-campus/`
- **St. John's Diobu Satellite Campus**: `https://iaue.edu.ng/st-johns-diobu-campus/`
- **Application Portal**: `https://portal.iaue.edu.ng/`
- **Enterprise Portal**: `https://enterpriseschoolsportal.iaue.edu.ng/`

---

## 🛡️ Security, SSRF & Anti-Scraping Safeguards

1. **Domain Whitelist**: Only `iaue.edu.ng`, `portal.iaue.edu.ng`, `enterpriseschoolsportal.iaue.edu.ng` are permitted.
2. **SSRF Guard**: Pre-flight DNS resolution inspects resolved IPs to strictly block loopback (`127.0.0.0/8`, `::1`), RFC-1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata IP (`169.254.169.254`).
3. **Robots.txt Compliance**: Automatically reads, parses, and caches `robots.txt` rules per origin.
4. **Rate Limiting & Concurrency**: Controlled request throttles (`SCRAPER_DELAY_MS=1500`), max concurrency (`SCRAPER_MAX_CONCURRENCY=2`), exponential backoff retries on 408, 429, 500, 502, 503, 504.
5. **No Private/Authenticated Scraping**: Skips student/staff login portals. Never prompts for credentials or bypasses CAPTCHA.

---

## 🎓 Academic Integrity Rules

- **Zero-Guessing Credit Units**: Course credit units are **never guessed or inferred**. If not explicitly declared in official text, `units` is set to `null`.
- **Conflict Review Queue**: If an official source publishes a conflicting unit count for an existing course (e.g. from 3 units to 2 units), the scraper **does not overwrite**. It flags the course with `unitConflict` and creates a pending `ScraperChange` record for administrator review.
- **Attribution**: Every announcement and resource retains its canonical `sourceUrl` and IAUE attribution disclaimer.

---

## 🚀 Quick Start Commands (PowerShell)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Run Test Suite (Unit & End-to-End API Integration)
```powershell
npm test
```

### 3. Run in Development Mode (Live Watch)
```powershell
npm run dev
```

### 4. Build Production Bundle
```powershell
npm run build
```

### 5. Start Production Server
```powershell
npm start
```

---

## 📚 Interactive API Documentation & Playgrounds

- **Swagger UI**: [http://localhost:5000/playground](http://localhost:5000/playground)
- **Scalar Reference**: [http://localhost:5000/scalar](http://localhost:5000/scalar)
- **Raw OpenAPI 3.0 JSON**: [http://localhost:5000/openapi.json](http://localhost:5000/openapi.json)
- **Scraper Health Endpoint**: [http://localhost:5000/api/v1/admin/scrapers/health](http://localhost:5000/api/v1/admin/scrapers/health)
