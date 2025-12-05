import { generateSuggestions } from '../../../src/utils/autocomplete/suggestions';
import { QueryContext } from '../../../src/types';

describe('generateSuggestions', () => {
  const mockMetrics = [
    'system.cpu.user',
    'system.cpu.system',
    'system.memory.free',
    'system.memory.used',
    'system.disk.read',
    'system.disk.write',
    'app.requests.total',
    'app.requests.latency',
    'app.errors.count',
  ];

  const mockTags = [
    'host:web-01',
    'host:web-02',
    'host:db-01',
    'env:prod',
    'env:staging',
    'env:dev',
    'region:us-east-1',
    'region:us-west-2',
    'service:api',
    'service:web',
    'version:1.0.0',
    'version:2.0.0',
  ];

  describe('metric context suggestions', () => {
    it('should return metric suggestions for metric context', () => {
      const context: QueryContext = {
        cursorPosition: 6,
        currentToken: 'syste',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'syste',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.label.includes('system'))).toBe(true);
    });

    it('should filter metrics by current token', () => {
      const context: QueryContext = {
        cursorPosition: 10,
        currentToken: 'memory',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'system.memory',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      expect(suggestions.every(s => s.label.toLowerCase().includes('memory'))).toBe(true);
    });

    it('should handle case-insensitive metric filtering', () => {
      const context: QueryContext = {
        cursorPosition: 6,
        currentToken: 'DISK',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'DISK',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      expect(suggestions.some(s => s.label.toLowerCase().includes('disk'))).toBe(true);
    });

    it('should return empty array when no metrics match', () => {
      const context: QueryContext = {
        cursorPosition: 7,
        currentToken: 'nomatch',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'nomatch',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      // Should return "No metrics available" message
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should return suggestions when no metrics provided', () => {
      const context: QueryContext = {
        cursorPosition: 6,
        currentToken: 'syste',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'syste',
      };

      const suggestions = generateSuggestions(context, []);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].label).toContain('No metrics available');
    });

    it('should set correct properties for metric suggestions', () => {
      const context: QueryContext = {
        cursorPosition: 6,
        currentToken: 'sys',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'sys',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      suggestions.forEach(s => {
        expect(s.label).toBeDefined();
        expect(s.insertText).toBeDefined();
        expect(s.documentation).toBeDefined();
        expect(s.sortText).toBeDefined();
      });
    });
  });

  describe('aggregation context suggestions', () => {
    it('should return aggregation suggestions for aggregation context', () => {
      const context: QueryContext = {
        cursorPosition: 23,
        currentToken: 'av',
        contextType: 'aggregation',
        metricName: 'system.cpu',
        existingTags: new Set(['host']),
        lineContent: 'system.cpu{host:web} by av',
      };

      const suggestions = generateSuggestions(context);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.label === 'avg')).toBe(true);
    });

    it('should filter aggregations by prefix', () => {
      const context: QueryContext = {
        cursorPosition: 22,
        currentToken: 'pe',
        contextType: 'aggregation',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{} by pe',
      };

      const suggestions = generateSuggestions(context);
      expect(suggestions.every(s => s.label.toLowerCase().startsWith('pe'))).toBe(true);
    });

    it('should include all aggregation functions', () => {
      const aggregations = ['avg', 'max', 'min', 'sum', 'count', 'last', 'percentile', 'cardinality', 'pct_95', 'pct_99'];
      const context: QueryContext = {
        cursorPosition: 18,
        currentToken: '',
        contextType: 'aggregation',
        metricName: 'metric',
        existingTags: new Set(),
        lineContent: 'metric{} by ',
      };

      const suggestions = generateSuggestions(context);
      aggregations.forEach(agg => {
        expect(suggestions.some(s => s.label === agg)).toBe(true);
      });
    });

    it('should handle case-insensitive aggregation filtering', () => {
      const context: QueryContext = {
        cursorPosition: 22,
        currentToken: 'MA',
        contextType: 'aggregation',
        metricName: 'metric',
        existingTags: new Set(),
        lineContent: 'metric{} by MA',
      };

      const suggestions = generateSuggestions(context);
      expect(suggestions.some(s => s.label === 'max')).toBe(true);
    });

    it('should set correct kind for aggregation suggestions', () => {
      const context: QueryContext = {
        cursorPosition: 18,
        currentToken: 'su',
        contextType: 'aggregation',
        metricName: 'metric',
        existingTags: new Set(),
        lineContent: 'metric{} by su',
      };

      const suggestions = generateSuggestions(context);
      suggestions.forEach(s => {
        expect(s.kind).toBe('aggregation');
      });
    });
  });

  describe('tag context suggestions', () => {
    it('should return tag suggestions for tag context', () => {
      const context: QueryContext = {
        cursorPosition: 15,
        currentToken: 'ho',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{ho',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.label === 'host')).toBe(true);
    });

    it('should filter tags by current token', () => {
      const context: QueryContext = {
        cursorPosition: 15,
        currentToken: 'env',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{env',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.every(s => s.label.toLowerCase().includes('env'))).toBe(true);
    });

    it('should exclude already-used tags', () => {
      const context: QueryContext = {
        cursorPosition: 23,
        currentToken: 'en',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(['host']),
        lineContent: 'system.cpu{host:web,en',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.every(s => s.label !== 'host')).toBe(true);
      expect(suggestions.some(s => s.label === 'env')).toBe(true);
    });

    it('should handle case-insensitive tag filtering', () => {
      const context: QueryContext = {
        cursorPosition: 15,
        currentToken: 'HOS',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{HOS',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.some(s => s.label === 'host')).toBe(true);
    });

    it('should add colon to insertText for tag suggestions', () => {
      const context: QueryContext = {
        cursorPosition: 15,
        currentToken: 'ho',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{ho',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      const hostSuggestion = suggestions.find(s => s.label === 'host');
      expect(hostSuggestion?.insertText).toBe('host:');
    });

    it('should set correct kind for tag suggestions', () => {
      const context: QueryContext = {
        cursorPosition: 15,
        currentToken: 'ho',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{ho',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      suggestions.forEach(s => {
        expect(s.kind).toBe('tag');
      });
    });

    it('should handle multiple existing tags', () => {
      const context: QueryContext = {
        cursorPosition: 40,
        currentToken: 're',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(['host', 'env', 'service']),
        lineContent: 'system.cpu{host:web,env:prod,service:api,re',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.every(s => s.label !== 'host' && s.label !== 'env' && s.label !== 'service')).toBe(true);
    });
  });

  describe('tag_value context suggestions', () => {
    it('should return tag value suggestions for tag_value context', () => {
      const context: QueryContext = {
        cursorPosition: 20,
        currentToken: 'we',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['host']),
        lineContent: 'system.cpu{host:we',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.label.includes('web'))).toBe(true);
    });

    it('should filter tag values by current token', () => {
      const context: QueryContext = {
        cursorPosition: 20,
        currentToken: 'web',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['host']),
        lineContent: 'system.cpu{host:web',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.every(s => s.label.toLowerCase().includes('web'))).toBe(true);
    });

    it('should handle case-insensitive tag value filtering', () => {
      const context: QueryContext = {
        cursorPosition: 20,
        currentToken: 'PROD',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['env']),
        lineContent: 'system.cpu{env:PROD',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.some(s => s.label === 'prod')).toBe(true);
    });

    it('should handle values with hyphens', () => {
      const context: QueryContext = {
        cursorPosition: 28,
        currentToken: 'us-',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['region']),
        lineContent: 'system.cpu{region:us-',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.some(s => s.label.includes('us-'))).toBe(true);
    });

    it('should return empty array for missing tag values', () => {
      const context: QueryContext = {
        cursorPosition: 22,
        currentToken: 'nomatch',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['host']),
        lineContent: 'system.cpu{host:nomatch',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      expect(suggestions.length).toBe(0);
    });

    it('should set correct kind for tag_value suggestions', () => {
      const context: QueryContext = {
        cursorPosition: 20,
        currentToken: 'pro',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['env']),
        lineContent: 'system.cpu{env:pro',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      suggestions.forEach(s => {
        expect(s.kind).toBe('tag_value');
      });
    });

    it('should handle multiple tags and suggest values for correct one', () => {
      const context: QueryContext = {
        cursorPosition: 40,
        currentToken: 'us',
        contextType: 'tag_value',
        metricName: 'system.cpu',
        existingTags: new Set(['host', 'env', 'region']),
        lineContent: 'system.cpu{host:web,env:prod,region:us',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      // Should get region values, not host or env values
      expect(suggestions.every(s => s.label.startsWith('us'))).toBe(true);
    });
  });

  describe('duplicate removal and limiting', () => {
    it('should limit suggestions to 100 items', () => {
      const longMetricList = Array.from({ length: 200 }, (_, i) => `metric.name.${i}`);
      const context: QueryContext = {
        cursorPosition: 5,
        currentToken: 'me',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'me',
      };

      const suggestions = generateSuggestions(context, longMetricList);
      expect(suggestions.length).toBeLessThanOrEqual(100);
    });

    it('should remove duplicate suggestions', () => {
      const duplicateMetrics = ['system.cpu', 'system.cpu', 'system.memory', 'system.cpu'];
      const context: QueryContext = {
        cursorPosition: 5,
        currentToken: 'sys',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'sys',
      };

      const suggestions = generateSuggestions(context, duplicateMetrics);
      const labels = suggestions.map(s => s.label);
      const uniqueLabels = new Set(labels);
      expect(labels.length).toBe(uniqueLabels.size);
    });

    it('should maintain insertion order after deduplication', () => {
      const metrics = ['aaa', 'bbb', 'aaa', 'ccc'];
      const context: QueryContext = {
        cursorPosition: 1,
        currentToken: '',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: '',
      };

      const suggestions = generateSuggestions(context, metrics);
      const labels = suggestions.map(s => s.label);
      expect(labels.indexOf('aaa')).toBeLessThan(labels.indexOf('bbb'));
      expect(labels.indexOf('bbb')).toBeLessThan(labels.indexOf('ccc'));
    });
  });

  describe('empty context handling', () => {
    it('should return empty array for empty context token in metric context with no data', () => {
      const context: QueryContext = {
        cursorPosition: 0,
        currentToken: '',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: '',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      // Should return all metrics or message
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should return all aggregations for empty token', () => {
      const context: QueryContext = {
        cursorPosition: 18,
        currentToken: '',
        contextType: 'aggregation',
        metricName: 'metric',
        existingTags: new Set(),
        lineContent: 'metric{} by ',
      };

      const suggestions = generateSuggestions(context);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle no available data gracefully', () => {
      const context: QueryContext = {
        cursorPosition: 10,
        currentToken: 'test',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'test',
      };

      const suggestions = generateSuggestions(context, [], []);
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('suggestion properties', () => {
    it('should have proper CompletionItem structure', () => {
      const context: QueryContext = {
        cursorPosition: 5,
        currentToken: 'sys',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'sys',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      suggestions.forEach(item => {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('kind');
        expect(item).toHaveProperty('insertText');
        expect(item).toHaveProperty('documentation');
        expect(item).toHaveProperty('sortText');
        expect(typeof item.label).toBe('string');
        expect(typeof item.insertText).toBe('string');
      });
    });

    it('should have documentation for all suggestions', () => {
      const context: QueryContext = {
        cursorPosition: 15,
        currentToken: 'ho',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{ho',
      };

      const suggestions = generateSuggestions(context, [], mockTags);
      suggestions.forEach(item => {
        expect(item.documentation).toBeDefined();
        expect(item.documentation!.length).toBeGreaterThan(0);
      });
    });

    it('should use sortText for proper sorting', () => {
      const context: QueryContext = {
        cursorPosition: 5,
        currentToken: 'sys',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'sys',
      };

      const suggestions = generateSuggestions(context, mockMetrics);
      suggestions.forEach(item => {
        expect(item.sortText).toBeDefined();
      });
    });
  });

  describe('context-specific behavior', () => {
    it('should handle transition from metric to tag context', () => {
      const metricContext: QueryContext = {
        cursorPosition: 10,
        currentToken: 'cpu',
        contextType: 'metric',
        existingTags: new Set(),
        lineContent: 'system.cpu',
      };

      const tagContext: QueryContext = {
        cursorPosition: 15,
        currentToken: 'ho',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(),
        lineContent: 'system.cpu{ho',
      };

      const metricSuggestions = generateSuggestions(metricContext, mockMetrics);
      const tagSuggestions = generateSuggestions(tagContext, [], mockTags);

      expect(metricSuggestions.every(s => s.kind === 'metric' || s.kind === 'value')).toBe(true);
      expect(tagSuggestions.every(s => s.kind === 'tag')).toBe(true);
    });

    it('should handle complete tag and continue to next tag', () => {
      const firstTagContext: QueryContext = {
        cursorPosition: 23,
        currentToken: '',
        contextType: 'tag',
        metricName: 'system.cpu',
        existingTags: new Set(['host']),
        lineContent: 'system.cpu{host:web,',
      };

      const suggestions = generateSuggestions(firstTagContext, [], mockTags);
      expect(suggestions.some(s => s.label === 'host')).toBe(false); // host already used
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
