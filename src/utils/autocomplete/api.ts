import { CompletionItem } from '../../types';

// Cache configuration
const DEFAULT_CACHE_TTL = 30 * 1000; // 30 seconds in milliseconds
const MAX_CONCURRENT_REQUESTS = 5;

// In-memory cache for suggestions
let cache: Map<string, { data: string[]; timestamp: number }> = new Map();

// Track concurrent requests
let concurrentRequests = 0;

/**
 * Fetch metric names from Datadog using the official API client
 * Results are cached for 30 seconds to reduce API load
 *
 * @param apiKey - Datadog API key
 * @param appKey - Datadog application key
 * @param site - Datadog site (us, eu, etc.)
 * @returns Promise resolving to array of metric names
 */
export async function fetchMetricsFromDatadog(
  apiKey: string,
  appKey: string,
  site: string = 'datadoghq.com'
): Promise<string[]> {
  const cacheKey = `metrics_${site}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL) {
    return cached.data;
  }

  // Enforce concurrent request limit
  if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    return []; // Return empty list if too many concurrent requests
  }

  concurrentRequests++;

  try {
    // Set timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    // Build the request to Datadog metrics API
    const url = `https://api.${site}/api/v1/metrics`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to fetch metrics: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as any;
    const metricNames: string[] = (data.metrics || []).map((m: any) => m.name || m);

    // Cache the results
    cache.set(cacheKey, {
      data: metricNames,
      timestamp: Date.now(),
    });

    return metricNames;
  } catch (error) {
    console.warn('Failed to fetch metrics from Datadog:', error);
    return [];
  } finally {
    concurrentRequests--;
  }
}

/**
 * Fetch tags for a specific metric from Datadog
 * Results are cached for 30 seconds
 *
 * @param metricName - Name of the metric to fetch tags for
 * @param apiKey - Datadog API key
 * @param appKey - Datadog application key
 * @param site - Datadog site (us, eu, etc.)
 * @returns Promise resolving to array of tag strings
 */
export async function fetchTagsForMetric(
  metricName: string,
  apiKey: string,
  appKey: string,
  site: string = 'datadoghq.com'
): Promise<string[]> {
  const cacheKey = `tags_${metricName}_${site}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL) {
    return cached.data;
  }

  // Enforce concurrent request limit
  if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    return []; // Return empty list if too many concurrent requests
  }

  concurrentRequests++;

  try {
    // Set timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    // Build the request to Datadog metrics query endpoint
    // This gets tags available for a metric
    const url = `https://api.${site}/api/v1/metrics/${encodeURIComponent(metricName)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to fetch tags: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as any;

    // Extract tag names from the response
    const tags: string[] = [];
    if (data.tags) {
      // Datadog returns tags as ["key:value", "key:value", ...]
      tags.push(...(data.tags as string[]));
    }

    // Cache the results
    cache.set(cacheKey, {
      data: tags,
      timestamp: Date.now(),
    });

    return tags;
  } catch (error) {
    console.warn('Failed to fetch tags from Datadog:', error);
    return [];
  } finally {
    concurrentRequests--;
  }
}

/**
 * Fetch available tag names from Datadog Logs API via backend resource endpoint
 * Uses the backend /autocomplete/logs/tags endpoint which handles authentication and caching
 */
export async function fetchLogsTagNames(datasource: any): Promise<string[]> {
  const cacheKey = 'logs_tag_names';

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL) {
    return cached.data;
  }

  // Enforce concurrent request limit
  if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    return []; // Return empty list if too many concurrent requests
  }

  concurrentRequests++;

  try {
    // Set timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    // Call backend resource endpoint for logs tag names
    const response = await datasource.getResource('autocomplete/logs/tags', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Backend returns array of tag names
    const tagNames: string[] = Array.isArray(response) ? response : [];

    // Cache the results
    cache.set(cacheKey, {
      data: tagNames,
      timestamp: Date.now(),
    });

    return tagNames;
  } catch (error) {
    console.warn('Failed to fetch logs tag names:', error);
    return [];
  } finally {
    concurrentRequests--;
  }
}

/**
 * Fetch available values for a specific tag from Datadog Logs API via backend resource endpoint
 * Uses the backend /autocomplete/logs/tag-values/{tagName} endpoint which handles authentication and caching
 */
export async function fetchLogsTagValues(tagName: string, datasource: any): Promise<string[]> {
  const cacheKey = `logs_tag_values_${tagName}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL) {
    return cached.data;
  }

  // Enforce concurrent request limit
  if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    return []; // Return empty list if too many concurrent requests
  }

  concurrentRequests++;

  try {
    // Set timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    // Call backend resource endpoint for specific tag values
    const response = await datasource.getResource(`autocomplete/logs/tag-values/${encodeURIComponent(tagName)}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Backend returns array of tag values
    const tagValues: string[] = Array.isArray(response) ? response : [];

    // Cache the results
    cache.set(cacheKey, {
      data: tagValues,
      timestamp: Date.now(),
    });

    return tagValues;
  } catch (error) {
    console.warn(`Failed to fetch logs tag values for ${tagName}:`, error);
    return [];
  } finally {
    concurrentRequests--;
  }
}

/**
 * Generate completion items from raw data strings
 */
export function createCompletionItems(
  items: string[],
  kind: 'metric' | 'aggregation' | 'tag' | 'tag_value' = 'metric'
): CompletionItem[] {
  return items.map((item) => ({
    label: item,
    kind,
    insertText: item,
    documentation: `Datadog ${kind}: ${item}`,
    sortText: item,
  }));
}
