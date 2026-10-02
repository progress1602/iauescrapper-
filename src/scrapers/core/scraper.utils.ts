import crypto from 'crypto';
import { URL } from 'url';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  '_ga',
  'mc_cid',
  'mc_eid',
]);

/**
 * Normalizes a URL to a consistent canonical form:
 * - Resolves relative URLs against base
 * - Strips fragments (#...)
 * - Removes tracking params (utm_*, fbclid, etc.)
 * - Sorts remaining legitimate query params
 * - Normalizes trailing slashes (preserves single root slash, strips trailing slashes elsewhere)
 * - Returns null if invalid or unsupported protocol
 */
export function normalizeCanonicalUrl(rawUrl: string, baseUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('#')
  ) {
    return null;
  }

  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    parsed.hash = ''; // Strip fragments

    // Strip tracking parameters
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_val, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    // Sort remaining query params for determinism
    parsed.searchParams.sort();

    // Normalize trailing slash
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Generates SHA-256 hash of a string or buffer.
 */
export function generateHash(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Creates a deterministic externalId from a canonical URL.
 */
export function generateExternalId(canonicalUrl: string): string {
  return generateHash(canonicalUrl);
}

/**
 * Strips HTML tags and normalizes extra whitespace.
 */
export function cleanHtmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates if an extracted item has sufficient substance to be valid academic content.
 */
export function isValidContent(title: string, content?: string): boolean {
  if (!title || title.trim().length < 3) return false;
  const lowerTitle = title.trim().toLowerCase();
  if (
    lowerTitle === 'click here' ||
    lowerTitle === 'read more' ||
    lowerTitle === 'untitled' ||
    lowerTitle === 'javascript:void(0)' ||
    lowerTitle === 'home' ||
    lowerTitle === 'menu'
  ) {
    return false;
  }
  if (content !== undefined && content.trim().length === 0) {
    return false;
  }
  return true;
}

/**
 * Strictly extracts credit units ONLY when explicitly provided in text.
 * Never guesses or infers!
 *
 * Matches examples:
 * - "CSC 201 - 3 Units"
 * - "(3 Credit Units)"
 * - "3 Credit Units"
 * - "3 Units"
 * - "2CR"
 * - "Credit Units: 6"
 */
export function extractExplicitCreditUnits(text: string): {
  units: number | null;
  unitsExplicitlyProvided: boolean;
} {
  if (!text) {
    return { units: null, unitsExplicitlyProvided: false };
  }

  // Regex patterns targeting explicit declarations
  const patterns = [
    /(?:credit\s*units?|units?|cr)\s*[:=-]\s*([1-9]|1[0-2])\b/i,
    /\b([1-9]|1[0-2])\s*(?:cr|credit\s*units?|units?|credits?)\b/i,
    /\(([1-9]|1[0-2])\s*(?:cr|units?|credit\s*units?)\)/i,
    /\[([1-9]|1[0-2])\s*(?:cr|units?|credit\s*units?|)\]/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const units = parseInt(match[1], 10);
      if (!isNaN(units) && units >= 0 && units <= 12) {
        return { units, unitsExplicitlyProvided: true };
      }
    }
  }

  return { units: null, unitsExplicitlyProvided: false };
}
