import { client, v1 } from '@datadog/datadog-api-client';
import { CompletionCache } from '../../types';

// Cache configuration
const DEFAULT_CACHE_TTL = 30 * 1000; // 30 seconds in milliseconds
const API_TIMEOUT = 2000; // 2 seconds for suggestion requests
const MAX_CONCURRENT_REQUESTS = 5;

// In-memory cache for suggestions
let cache: CompletionCache = {
  metricSuggestions: new Map(),
  tagSuggestions: new Map(),
  TTL: DEFAULT_CACHE_TTL,
};

// Track concurrent requests to enforce limits
let concurrentRequests = 0;
let abortControllers: Map<string, AbortController> = new Map();

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
  const cached = cache.metricSuggestions.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cache.TTL) {
    return cached.data.map(item => item.label);
  }

  // Enforce concurrent request limit
  if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    throw new Error('Too many concurrent suggestion requests');
  }

  concurrentRequests++;

  try {
    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllers.set(cacheKey, abortController);

    // Set timeout
    const timeoutId = setTimeout(() => abortController.abort(), API_TIMEOUT);

    // Configure the official client
    const configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: apiKey,
        appKeyAuth: appKey,
      },
      serverVariables: {
        site: site,
      },
      httpConfig: {
        signal: abortController.signal,
      },
    });

    const metricsApi = new v1.MetricsApi(configuration);

    // Fetch metrics
    const response = await metricsApi.listMetrics();

    clearTimeout(timeoutId);

    // Extract metric names from response
    const metricNames = (response.data || []).map(metric => {
      if (typeof metric === 'string') {
        return metric;
      }
      return (metric as any).name || '';
    });

    // Convert to CompletionItems for caching
    const completionItems = metricNames.map(name => ({
      label: name,
      kind: 'metric' as const,
      insertText: name,
      documentation: `Datadog metric: ${name}`,
      sortText: name,
    }));

    // Cache the results
    cache.metricSuggestions.set(cacheKey, {
      data: completionItems,
      timestamp: Date.now(),
    });

    return metricNames;
  } catch (error) {
    // Handle errors gracefully
    if ((error as any).name === 'AbortError') {
      throw new Error('Metric suggestion request timed out (>2s)');
    }

    if ((error as any).status === 401 || (error as any).status === 403) {
      throw new Error('Authentication failed - check your Datadog API and App keys');
    }

    throw error;
  } finally {
    concurrentRequests--;
    abortControllers.delete(cacheKey);
  }
}

/**
 * Fetch tag names and values for a specific metric from Datadog
 * Results are cached for 30 seconds
 *
 * @param apiKey - Datadog API key
 * @param appKey - Datadog application key
 * @param site - Datadog site (us, eu, etc.)
 * @returns Promise resolving to array of tag strings ("key:value" format)
 */
export async function fetchTagsForMetric(
  apiKey: string,
  appKey: string,
  site: string = 'datadoghq.com'
): Promise<string[]> {
  const cacheKey = `tags_${site}`;

  // Check cache first
  const cached = cache.tagSuggestions.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cache.TTL) {
    return cached.data;
  }

  // Enforce concurrent request limit
  if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    throw new Error('Too many concurrent suggestion requests');
  }

  concurrentRequests++;

  try {
    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllers.set(cacheKey, abortController);

    // Set timeout
    const timeoutId = setTimeout(() => abortController.abort(), API_TIMEOUT);

    // Configure the official client
    const configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: apiKey,
        appKeyAuth: appKey,
      },
      serverVariables: {
        site: site,
      },
      httpConfig: {
        signal: abortController.signal,
      },
    });

    const tagsApi = new v1.TagsApi(configuration);

    // Fetch host tags (Datadog's primary tag source)
    const response = await tagsApi.listHostTags();

    clearTimeout(timeoutId);

    // Extract tag names from response
    const tagStrings: string[] = [];

    if (response.tags) {
      for (const [hostname, tags] of Object.entries(response.tags)) {
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            tagStrings.push(tag);
          }
        }
      }
    }

    // Deduplicate
    const uniqueTags = Array.from(new Set(tagStrings));

    // Cache the results
    cache.tagSuggestions.set(cacheKey, {
      data: uniqueTags,
      timestamp: Date.now(),
    });

    return uniqueTags;
  } catch (error) {
    // Handle errors gracefully
    if ((error as any).name === 'AbortError') {
      throw new Error('Tag suggestion request timed out (>2s)');
    }

    if ((error as any).status === 401 || (error as any).status === 403) {
      throw new Error('Authentication failed - check your Datadog API and App keys');
    }

    throw error;
  } finally {
    concurrentRequests--;
    abortControllers.delete(cacheKey);
  }
}

/**
 * Cancel all pending API requests
 * Useful for cleanup on component unmount
 */
export function cancelPendingRequests(): void {
  for (const controller of abortControllers.values()) {
    controller.abort();
  }
  abortControllers.clear();
  concurrentRequests = 0;
}

/**
 * Clear the suggestion cache
 * Can be called when user changes datasource or updates credentials
 */
export function clearCache(): void {
  cache.metricSuggestions.clear();
  cache.tagSuggestions.clear();
}

/**
 * Set cache TTL (for testing or customization)
 * Default is 30 seconds
 */
export function setCacheTTL(ttlMs: number): void {
  cache.TTL = ttlMs;
}

/**
 * Get current cache stats (mainly for debugging)
 */
export function getCacheStats(): {
  metricCacheSize: number;
  tagCacheSize: number;
  concurrentRequests: number;
} {
  return {
    metricCacheSize: cache.metricSuggestions.size,
    tagCacheSize: cache.tagSuggestions.size,
    concurrentRequests,
  };
}
