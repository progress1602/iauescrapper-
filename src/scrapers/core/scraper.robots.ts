import { URL } from 'url';
import { ScraperLogger } from './scraper.logger';

const logger = new ScraperLogger('RobotsChecker');

interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

interface CachedRobots {
  rules: RobotsRule[];
  fetchedAt: number;
}

export class RobotsChecker {
  private cache: Map<string, CachedRobots> = new Map();
  private cacheTtlMs = 1000 * 60 * 60 * 24; // 24 hours

  /**
   * Parses robots.txt content into structured rules.
   */
  parseRobotsTxt(content: string): RobotsRule[] {
    const lines = content.split('\n');
    const rules: RobotsRule[] = [];
    let currentRule: RobotsRule | null = null;

    for (let rawLine of lines) {
      const line = rawLine.split('#')[0]!.trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const field = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (field === 'user-agent') {
        currentRule = {
          userAgent: value.toLowerCase(),
          disallow: [],
          allow: [],
        };
        rules.push(currentRule);
      } else if (currentRule) {
        if (field === 'disallow') {
          if (value) currentRule.disallow.push(value);
        } else if (field === 'allow') {
          if (value) currentRule.allow.push(value);
        }
      }
    }

    return rules;
  }

  /**
   * Sets rules directly in cache (useful for mocking or when fetched by ScraperHttpClient).
   */
  setCache(origin: string, content: string): void {
    const rules = this.parseRobotsTxt(content);
    this.cache.set(origin, {
      rules,
      fetchedAt: Date.now(),
    });
    logger.debug(`Cached robots.txt for origin: ${origin}`);
  }

  /**
   * Checks whether a given URL is allowed for the specified userAgent.
   */
  isAllowed(urlString: string, userAgent: string): boolean {
    try {
      const parsed = new URL(urlString);
      const origin = parsed.origin;
      const cached = this.cache.get(origin);

      if (!cached || Date.now() - cached.fetchedAt > this.cacheTtlMs) {
        // If not cached yet, default to allowed, but caller can prefetch
        return true;
      }

      const pathname = parsed.pathname + parsed.search;
      const normalizedAgent = userAgent.toLowerCase();

      // Find matching rules: first specific user agent, then wildcard *
      const matchedRules = cached.rules.filter(
        (r) =>
          r.userAgent === normalizedAgent ||
          normalizedAgent.includes(r.userAgent) ||
          r.userAgent === '*'
      );

      for (const rule of matchedRules) {
        // Check explicit allow first
        for (const allowedPath of rule.allow) {
          if (pathname.startsWith(allowedPath)) {
            return true;
          }
        }
        // Check disallow
        for (const disallowedPath of rule.disallow) {
          if (disallowedPath === '/') {
            // Disallowing root means everything is disallowed
            return false;
          }
          if (disallowedPath && pathname.startsWith(disallowedPath)) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}

export const robotsChecker = new RobotsChecker();
