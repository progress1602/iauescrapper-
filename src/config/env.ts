import dotenv from 'dotenv';
dotenv.config();

function getEnvNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (!val) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: getEnvNumber('PORT', 5000),
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'iaue_student_hub_secure_jwt_secret_token_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@iauestudenthub.ng',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!',

  // Scraper Subsystem
  SCRAPER_ENABLED: getEnvBoolean('SCRAPER_ENABLED', true),
  SCRAPER_NEWS_INTERVAL_MINUTES: getEnvNumber('SCRAPER_NEWS_INTERVAL_MINUTES', 30),
  SCRAPER_PORTAL_INTERVAL_MINUTES: getEnvNumber('SCRAPER_PORTAL_INTERVAL_MINUTES', 30),
  SCRAPER_ACADEMIC_INTERVAL_MINUTES: getEnvNumber('SCRAPER_ACADEMIC_INTERVAL_MINUTES', 720),
  SCRAPER_OER_INTERVAL_MINUTES: getEnvNumber('SCRAPER_OER_INTERVAL_MINUTES', 360),
  SCRAPER_DOCUMENT_INTERVAL_MINUTES: getEnvNumber('SCRAPER_DOCUMENT_INTERVAL_MINUTES', 360),
  SCRAPER_MAX_CONCURRENCY: getEnvNumber('SCRAPER_MAX_CONCURRENCY', 2),
  SCRAPER_REQUEST_TIMEOUT_MS: getEnvNumber('SCRAPER_REQUEST_TIMEOUT_MS', 15000),
  SCRAPER_MAX_RETRIES: getEnvNumber('SCRAPER_MAX_RETRIES', 3),
  SCRAPER_DELAY_MS: getEnvNumber('SCRAPER_DELAY_MS', 1500),
  SCRAPER_MAX_PAGES_PER_RUN: getEnvNumber('SCRAPER_MAX_PAGES_PER_RUN', 200),
  SCRAPER_MAX_CRAWL_DEPTH: getEnvNumber('SCRAPER_MAX_CRAWL_DEPTH', 3),
  SCRAPER_USER_AGENT:
    process.env.SCRAPER_USER_AGENT || 'IAUE-Student-Hub/1.0 (+https://iauestudenthub.ng)',
};
