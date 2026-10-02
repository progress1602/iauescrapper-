import dns from 'dns';
import { promisify } from 'util';
import { URL } from 'url';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { env } from '../../config/env';
import { APPROVED_DOMAINS } from '../config/iaueSources';
import { robotsChecker } from './scraper.robots';
import { ScraperLogger } from './scraper.logger';

const dnsLookup = promisify(dns.lookup);
const logger = new ScraperLogger('ScraperHttpClient');

export interface HttpResponseData {
  url: string;
  statusCode: number;
  data: string;
  contentType: string;
  contentLength: number;
  headers: Record<string, string>;
}

export class ScraperHttpClient {
  private client: AxiosInstance;
  private lastRequestTime = 0;
  private activeRequests = 0;

  constructor() {
    this.client = axios.create({
      timeout: env.SCRAPER_REQUEST_TIMEOUT_MS,
      maxContentLength: 10 * 1024 * 1024, // 10 MB limit
      maxBodyLength: 10 * 1024 * 1024,
      headers: {
        'User-Agent': env.SCRAPER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: () => true, // Don't throw automatically on HTTP status codes
    });
  }

  /**
   * Strictly verifies if an IP is private/internal/loopback/cloud-metadata.
   */
  public isPrivateOrReservedIp(ip: string): boolean {
    if (!ip) return true;

    // IPv6 Loopback / Link-Local / Unique Local
    if (
      ip === '::1' ||
      ip === '::' ||
      ip.toLowerCase().startsWith('fe80:') ||
      ip.toLowerCase().startsWith('fc00:') ||
      ip.toLowerCase().startsWith('fd00:')
    ) {
      return true;
    }

    // IPv4 Checks
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return false; // not an IPv4 format
    }

    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (RFC 1918 Private)
    if (a === 10) return true;
    // 172.16.0.0/12 (RFC 1918 Private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (RFC 1918 Private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (Link Local / Cloud Metadata endpoint like 169.254.169.254)
    if (a === 169 && b === 254) return true;

    return false;
  }

  /**
   * Validates target URL against Whitelist & SSRF safeguards.
   */
  public async validateUrlSecurity(urlString: string): Promise<{ valid: boolean; reason?: string }> {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      return { valid: false, reason: 'Malformed or invalid URL' };
    }

    // Only HTTP and HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        reason: `Unsupported protocol ${parsed.protocol}. Only http: and https: are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check against approved domains
    const isWhitelisted = APPROVED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isWhitelisted) {
      return {
        valid: false,
        reason: `Domain '${hostname}' is not on the IAUE approved domain whitelist.`,
      };
    }

    // SSRF Check: Resolve DNS and verify IP
    try {
      const lookupResult = await dnsLookup(hostname);
      if (this.isPrivateOrReservedIp(lookupResult.address)) {
        return {
          valid: false,
          reason: `Resolved IP '${lookupResult.address}' is within a private, loopback, or cloud-metadata network. SSRF prevented.`,
        };
      }
    } catch (dnsErr) {
      return {
        valid: false,
        reason: `DNS resolution failed for host ${hostname}: ${(dnsErr as Error).message}`,
      };
    }

    return { valid: true };
  }

  /**
   * Rate limiting throttle and concurrency guard.
   */
  private async acquireThrottle(): Promise<void> {
    while (this.activeRequests >= env.SCRAPER_MAX_CONCURRENCY) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < env.SCRAPER_DELAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, env.SCRAPER_DELAY_MS - elapsed));
    }
    this.activeRequests++;
    this.lastRequestTime = Date.now();
  }

  private releaseThrottle(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
  }

  /**
   * Ensures robots.txt has been fetched and cached for the target origin.
   */
  public async ensureRobotsLoaded(origin: string): Promise<void> {
    try {
      const robotsUrl = `${origin}/robots.txt`;
      const validation = await this.validateUrlSecurity(robotsUrl);
      if (!validation.valid) return;

      const res = await this.client.get(robotsUrl, { timeout: 5000 });
      if (res.status === 200 && typeof res.data === 'string') {
        robotsChecker.setCache(origin, res.data);
      }
    } catch (err) {
      logger.debug(`Could not fetch robots.txt for ${origin}: ${(err as Error).message}`);
    }
  }

  /**
   * Performs a safe, rate-limited, retried HTTP GET request.
   */
  public async get(
    urlString: string,
    options: { checkRobots?: boolean } = { checkRobots: true }
  ): Promise<HttpResponseData> {
    const securityCheck = await this.validateUrlSecurity(urlString);
    if (!securityCheck.valid) {
      throw new Error(`Security validation failed for '${urlString}': ${securityCheck.reason}`);
    }

    if (options.checkRobots) {
      const parsed = new URL(urlString);
      await this.ensureRobotsLoaded(parsed.origin);
      if (!robotsChecker.isAllowed(urlString, env.SCRAPER_USER_AGENT)) {
        throw new Error(`Crawl disallowed by robots.txt: ${urlString}`);
      }
    }

    let attempts = 0;
    const maxRetries = env.SCRAPER_MAX_RETRIES;
    let lastError: Error | null = null;

    while (attempts <= maxRetries) {
      attempts++;
      await this.acquireThrottle();

      try {
        const response: AxiosResponse = await this.client.get(urlString, {
          responseType: 'text',
          transformResponse: [(data) => data], // Preserve raw text / HTML
        });

        this.releaseThrottle();

        const status = response.status;

        // Check if retryable server error
        const isRetryable =
          status === 408 ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (isRetryable && attempts <= maxRetries) {
          const backoff = Math.pow(2, attempts) * 1000;
          logger.warn(`Retryable HTTP ${status} for ${urlString}. Retrying in ${backoff}ms (attempt ${attempts}/${maxRetries})...`);
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }

        const contentType = (response.headers['content-type'] as string) || '';
        const contentLength = parseInt((response.headers['content-length'] as string) || '0', 10);

        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(response.headers)) {
          if (typeof v === 'string') {
            headers[k] = v;
          }
        }

        return {
          url: urlString,
          statusCode: response.status,
          data: typeof response.data === 'string' ? response.data : String(response.data),
          contentType,
          contentLength,
          headers,
        };
      } catch (err) {
        this.releaseThrottle();
        lastError = err as Error;

        if (attempts <= maxRetries) {
          const backoff = Math.pow(2, attempts) * 1000;
          logger.warn(`Network error on ${urlString}: ${lastError.message}. Retrying in ${backoff}ms...`);
          await new Promise((res) => setTimeout(res, backoff));
        } else {
          break;
        }
      }
    }

    throw new Error(`Failed to fetch ${urlString} after ${attempts} attempts: ${lastError?.message}`);
  }
}

export const scraperHttpClient = new ScraperHttpClient();
