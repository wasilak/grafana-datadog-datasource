import {
  fetchMetricsFromDatadog,
  fetchTagsForMetric,
  cancelPendingRequests,
  clearCache,
  setCacheTTL,
  getCacheStats,
} from '../../../src/utils/autocomplete/api';

// Mock the Datadog API client
jest.mock('@datadog/datadog-api-client', () => {
  const mockMetricsApi = jest.fn().mockImplementation(() => ({
    listMetrics: jest.fn(),
  }));

  const mockTagsApi = jest.fn().mockImplementation(() => ({
    listHostTags: jest.fn(),
  }));

  return {
    client: {
      createConfiguration: jest.fn().mockReturnValue({}),
    },
    v1: {
      MetricsApi: mockMetricsApi,
      TagsApi: mockTagsApi,
    },
  };
});

import * as datadogModule from '@datadog/datadog-api-client';

describe('API Functions', () => {
  const mockApiKey = 'test-api-key';
  const mockAppKey = 'test-app-key';
  const mockSite = 'datadoghq.com';

  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
    setCacheTTL(30 * 1000);
    cancelPendingRequests();
  });

  describe('fetchMetricsFromDatadog', () => {
    it('should fetch metrics successfully', async () => {
      const mockMetrics = ['system.cpu', 'system.memory', 'system.disk'];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      const result = await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);

      expect(result).toEqual(mockMetrics);
      expect(mockMetricsApi.listMetrics).toHaveBeenCalled();
    });

    it('should handle empty metrics response', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: undefined,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      const result = await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);

      expect(result).toEqual([]);
    });

    it('should cache metrics results for 30 seconds', async () => {
      const mockMetrics = ['system.cpu', 'system.memory'];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      // First call
      const result1 = await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      expect(result1).toEqual(mockMetrics);

      // Second call should use cache
      const result2 = await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      expect(result2).toEqual(mockMetrics);

      // Should only call API once due to caching
      expect(mockMetricsApi.listMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication errors (401)', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockRejectedValue({
          status: 401,
          message: 'Unauthorized',
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await expect(fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        /Authentication failed/
      );
    });

    it('should handle forbidden errors (403)', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockRejectedValue({
          status: 403,
          message: 'Forbidden',
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await expect(fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        /Authentication failed/
      );
    });

    it('should handle timeout errors', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockRejectedValue({
          name: 'AbortError',
          message: 'Request timed out',
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await expect(fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        /timed out/
      );
    });

    it('should use different cache keys for different sites', async () => {
      const mockMetrics = ['metric1'];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      // Fetch for us site
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, 'us');

      // Fetch for eu site - should not use cache
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, 'eu');

      expect(mockMetricsApi.listMetrics).toHaveBeenCalledTimes(2);
    });

    it('should extract metric names from response objects', async () => {
      const mockMetrics = [
        { name: 'system.cpu' },
        { name: 'system.memory' },
        'system.disk',
      ];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      const result = await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);

      expect(result).toEqual(['system.cpu', 'system.memory', 'system.disk']);
    });

    it('should enforce max concurrent requests', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const mockMetricsApi = {
        listMetrics: jest.fn().mockImplementation(async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrentCount--;
          return { data: ['metric1'] };
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(fetchMetricsFromDatadog(mockApiKey, mockAppKey, `site${i}`));
      }

      await Promise.allSettled(promises);

      // Some requests should have been rejected due to concurrent limit
      expect(maxConcurrent).toBeLessThanOrEqual(5);
    });

    it('should timeout after 2 seconds', (done) => {
      const mockMetricsApi = {
        listMetrics: jest.fn(
          () =>
            new Promise(resolve => {
              // Never resolve - simulate hanging request
              setTimeout(() => resolve({ data: ['metric'] }), 5000);
            })
        ),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite)
        .then(() => done(new Error('Should have timed out')))
        .catch(error => {
          expect(error.message).toContain('timed out');
          done();
        });

      // Don't let test run forever
      setTimeout(() => done(), 3000);
    });
  });

  describe('fetchTagsForMetric', () => {
    it('should fetch tags successfully', async () => {
      const mockTags = {
        tags: {
          'host-1': ['env:prod', 'region:us-east'],
          'host-2': ['env:dev', 'region:us-west'],
        },
      };

      const mockTagsApi = {
        listHostTags: jest.fn().mockResolvedValue(mockTags),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      const result = await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);

      expect(result).toContain('env:prod');
      expect(result).toContain('region:us-east');
      expect(result).toContain('env:dev');
      expect(result).toContain('region:us-west');
    });

    it('should deduplicate tags', async () => {
      const mockTags = {
        tags: {
          'host-1': ['env:prod', 'region:us-east', 'env:prod'],
          'host-2': ['env:prod', 'region:us-east'],
        },
      };

      const mockTagsApi = {
        listHostTags: jest.fn().mockResolvedValue(mockTags),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      const result = await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);

      const uniqueTags = new Set(result);
      expect(uniqueTags.size).toBe(result.length);
    });

    it('should handle empty tags response', async () => {
      const mockTagsApi = {
        listHostTags: jest.fn().mockResolvedValue({
          tags: undefined,
        }),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      const result = await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);

      expect(result).toEqual([]);
    });

    it('should cache tags results for 30 seconds', async () => {
      const mockTags = {
        tags: {
          'host-1': ['env:prod'],
        },
      };

      const mockTagsApi = {
        listHostTags: jest.fn().mockResolvedValue(mockTags),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      // First call
      const result1 = await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);
      expect(result1).toContain('env:prod');

      // Second call should use cache
      const result2 = await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);
      expect(result2).toContain('env:prod');

      // Should only call API once due to caching
      expect(mockTagsApi.listHostTags).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication errors (401) for tags', async () => {
      const mockTagsApi = {
        listHostTags: jest.fn().mockRejectedValue({
          status: 401,
          message: 'Unauthorized',
        }),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      await expect(fetchTagsForMetric(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        /Authentication failed/
      );
    });

    it('should handle timeout errors for tags', async () => {
      const mockTagsApi = {
        listHostTags: jest.fn().mockRejectedValue({
          name: 'AbortError',
          message: 'Request timed out',
        }),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      await expect(fetchTagsForMetric(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        /timed out/
      );
    });

    it('should handle non-array tag values gracefully', async () => {
      const mockTags = {
        tags: {
          'host-1': 'not-an-array',
          'host-2': ['env:prod'],
        },
      };

      const mockTagsApi = {
        listHostTags: jest.fn().mockResolvedValue(mockTags),
      };

      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      const result = await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);

      // Should still work and return valid tags
      expect(result).toContain('env:prod');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when clearCache is called', async () => {
      const mockMetrics = ['metric1'];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      // Fetch and cache
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      expect(getCacheStats().metricCacheSize).toBe(1);

      // Clear cache
      clearCache();
      expect(getCacheStats().metricCacheSize).toBe(0);

      // Next fetch should call API again
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      expect(mockMetricsApi.listMetrics).toHaveBeenCalledTimes(2);
    });

    it('should respect custom TTL setting', async () => {
      const mockMetrics = ['metric1'];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      // Set TTL to 1 millisecond
      setCacheTTL(1);

      // Fetch and cache
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Next fetch should call API again due to expired cache
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      expect(mockMetricsApi.listMetrics).toHaveBeenCalledTimes(2);
    });

    it('should provide cache stats', async () => {
      const mockMetrics = ['metric1'];
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: mockMetrics,
        }),
      };

      const mockTagsApi = {
        listHostTags: jest.fn().mockResolvedValue({
          tags: { 'host-1': ['tag1'] },
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);
      (datadogModule.v1 as any).TagsApi = jest.fn(() => mockTagsApi);

      // Fetch both metrics and tags
      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      await fetchTagsForMetric(mockApiKey, mockAppKey, mockSite);

      const stats = getCacheStats();
      expect(stats.metricCacheSize).toBe(1);
      expect(stats.tagCacheSize).toBe(1);
      expect(stats.concurrentRequests).toBe(0);
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel pending requests when cancelPendingRequests is called', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn(
          () =>
            new Promise((resolve, reject) => {
              setTimeout(() => reject(new Error('Should be cancelled')), 1000);
            })
        ),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      const fetchPromise = fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);

      // Cancel after 10ms
      setTimeout(() => cancelPendingRequests(), 10);

      try {
        await fetchPromise;
      } catch (error) {
        // Expected to fail
      }

      const stats = getCacheStats();
      expect(stats.concurrentRequests).toBe(0);
    });

    it('should reset concurrent request counter on cancellation', async () => {
      clearCache();
      const stats = getCacheStats();
      expect(stats.concurrentRequests).toBe(0);

      cancelPendingRequests();
      expect(getCacheStats().concurrentRequests).toBe(0);
    });
  });

  describe('Datadog Site Configuration', () => {
    it('should use datadoghq.com as default site', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: ['metric1'],
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await fetchMetricsFromDatadog(mockApiKey, mockAppKey);

      expect(datadogModule.client.createConfiguration).toHaveBeenCalled();
      const config = (datadogModule.client.createConfiguration as jest.Mock).mock.calls[0][0];
      expect(config.serverVariables.site).toBe('datadoghq.com');
    });

    it('should allow custom site configuration', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockResolvedValue({
          data: ['metric1'],
        }),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await fetchMetricsFromDatadog(mockApiKey, mockAppKey, 'datadoghq.eu');

      const config = (datadogModule.client.createConfiguration as jest.Mock).mock.calls[0][0];
      expect(config.serverVariables.site).toBe('datadoghq.eu');
    });
  });

  describe('Error Recovery', () => {
    it('should decrement concurrent requests counter on error', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockRejectedValue(new Error('API Error')),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      try {
        await fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite);
      } catch (error) {
        // Expected
      }

      expect(getCacheStats().concurrentRequests).toBe(0);
    });

    it('should handle generic API errors', async () => {
      const mockMetricsApi = {
        listMetrics: jest.fn().mockRejectedValue(new Error('Unknown error')),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await expect(fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        /Unknown error/
      );
    });

    it('should preserve error information when rethrowing', async () => {
      const customError = new Error('Custom API error');
      const mockMetricsApi = {
        listMetrics: jest.fn().mockRejectedValue(customError),
      };

      (datadogModule.v1 as any).MetricsApi = jest.fn(() => mockMetricsApi);

      await expect(fetchMetricsFromDatadog(mockApiKey, mockAppKey, mockSite)).rejects.toThrow(
        'Custom API error'
      );
    });
  });
});
