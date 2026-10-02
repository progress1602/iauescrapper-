export interface UpdateSourceInput {
  enabled?: boolean;
  crawlEnabled?: boolean;
  scrapeIntervalMinutes?: number;
  priority?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
  description?: string;
}

export function validateUpdateSourceInput(body: unknown): {
  valid: boolean;
  errors?: string[];
  data?: UpdateSourceInput;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object.'] };
  }

  const errors: string[] = [];
  const obj = body as Record<string, unknown>;
  const data: UpdateSourceInput = {};

  if (obj.enabled !== undefined) {
    if (typeof obj.enabled !== 'boolean') errors.push('Field "enabled" must be a boolean.');
    else data.enabled = obj.enabled;
  }

  if (obj.crawlEnabled !== undefined) {
    if (typeof obj.crawlEnabled !== 'boolean') errors.push('Field "crawlEnabled" must be a boolean.');
    else data.crawlEnabled = obj.crawlEnabled;
  }

  if (obj.scrapeIntervalMinutes !== undefined) {
    if (typeof obj.scrapeIntervalMinutes !== 'number' || obj.scrapeIntervalMinutes < 1) {
      errors.push('Field "scrapeIntervalMinutes" must be a positive number (minimum 1).');
    } else {
      data.scrapeIntervalMinutes = obj.scrapeIntervalMinutes;
    }
  }

  if (obj.priority !== undefined) {
    if (typeof obj.priority !== 'number' || obj.priority < 1) {
      errors.push('Field "priority" must be a positive integer (minimum 1).');
    } else {
      data.priority = obj.priority;
    }
  }

  if (obj.allowedPaths !== undefined) {
    if (!Array.isArray(obj.allowedPaths) || obj.allowedPaths.some((p) => typeof p !== 'string')) {
      errors.push('Field "allowedPaths" must be an array of strings.');
    } else {
      data.allowedPaths = obj.allowedPaths;
    }
  }

  if (obj.blockedPaths !== undefined) {
    if (!Array.isArray(obj.blockedPaths) || obj.blockedPaths.some((p) => typeof p !== 'string')) {
      errors.push('Field "blockedPaths" must be an array of strings.');
    } else {
      data.blockedPaths = obj.blockedPaths;
    }
  }

  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') errors.push('Field "description" must be a string.');
    else data.description = obj.description;
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data };
}
