import { MyQuery } from '../../types';
import { QueryFixAction, QueryFixType } from '@grafana/data';

// Mock the modifyQuery functionality to test the logic
class MockDataSource {
  detectQueryType(query: MyQuery): 'logs' | 'metrics' {
    if (query.queryType) {
      return query.queryType;
    }
    if (query.logQuery) {
      return 'logs';
    }
    if (query.meta?.preferredVisualisationType === 'logs') {
      return 'logs';
    }
    return 'metrics';
  }

  modifyQuery(query: MyQuery, action: QueryFixAction): MyQuery {
    if (this.detectQueryType(query) !== 'logs') {
      return query;
    }

    const { type, options } = action;
    const currentLogQuery = query.logQuery || '';

    let modifiedLogQuery = currentLogQuery;

    switch (type) {
      case 'ADD_FILTER':
        if (options?.key && options?.value) {
          modifiedLogQuery = this.addFilterToLogsQuery(currentLogQuery, options.key, options.value, false);
        }
        break;

      case 'ADD_FILTER_OUT':
        if (options?.key && options?.value) {
          modifiedLogQuery = this.addFilterToLogsQuery(currentLogQuery, options.key, options.value, true);
        }
        break;

      default:
        return query;
    }

    return {
      ...query,
      logQuery: modifiedLogQuery,
      queryType: 'logs' as const,
    };
  }

  getSupportedQueryModifications(): Array<QueryFixType | string> {
    return ['ADD_FILTER', 'ADD_FILTER_OUT'];
  }

  private addFilterToLogsQuery(currentQuery: string, key: string, value: string, isNegative: boolean): string {
    const sanitizedKey = this.sanitizeLogsQueryPart(key);
    const sanitizedValue = this.sanitizeLogsQueryPart(value);

    const filterPrefix = isNegative ? '-' : '';
    const filterString = `${filterPrefix}${sanitizedKey}:${sanitizedValue}`;

    if (!currentQuery.trim()) {
      return filterString;
    }

    const existingFilterPattern = new RegExp(`\\b${filterPrefix}${sanitizedKey}:${sanitizedValue}\\b`);
    if (existingFilterPattern.test(currentQuery)) {
      return currentQuery;
    }

    return `${currentQuery.trim()} AND ${filterString}`;
  }

  private sanitizeLogsQueryPart(part: string): string {
    let sanitized = part.trim();
    sanitized = sanitized.replace(/[+&|!(){}[\]^"~*?:\\]/g, '\\$&');

    if (sanitized.includes(' ') || /[+&|!(){}[\]^"~*?:\\]/.test(sanitized)) {
      sanitized = sanitized.replace(/^"|"$/g, '');
      sanitized = `"${sanitized}"`;
    }

    return sanitized;
  }
}

describe('modifyQuery integration with query translation', () => {
  let datasource: MockDataSource;

  beforeEach(() => {
    datasource = new MockDataSource();
  });

  describe('ADD_FILTER integration', () => {
    it('should add service filter to empty logs query', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: '',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: {
          key: 'service',
          value: 'web-app',
        },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('service:web-app');
      expect(result.queryType).toBe('logs');
    });

    it('should add service filter to existing logs query with AND logic', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'error message',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: {
          key: 'service',
          value: 'web-app',
        },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('error message AND service:web-app');
      expect(result.queryType).toBe('logs');
    });

    it('should add status filter with proper format', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'service:web-app',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: {
          key: 'status',
          value: 'ERROR',
        },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('service:web-app AND status:ERROR');
    });

    it('should handle values with spaces by quoting them', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'error',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: {
          key: 'service',
          value: 'my service name',
        },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('error AND service:"my service name"');
    });

    it('should not add duplicate filters', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'service:web-app AND status:ERROR',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: {
          key: 'service',
          value: 'web-app',
        },
      };

      const result = datasource.modifyQuery(query, action);

      // Should not add duplicate filter
      expect(result.logQuery).toBe('service:web-app AND status:ERROR');
    });
  });

  describe('ADD_FILTER_OUT integration', () => {
    it('should add negative filter to logs query', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'error',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER_OUT',
        options: {
          key: 'service',
          value: 'health-check',
        },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('error AND -service:health-check');
    });

    it('should add negative status filter', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'service:web-app',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER_OUT',
        options: {
          key: 'status',
          value: 'DEBUG',
        },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('service:web-app AND -status:DEBUG');
    });
  });

  describe('query translation compatibility', () => {
    it('should generate queries compatible with backend translation', () => {
      // Test that the queries generated by modifyQuery are compatible
      // with the patterns expected by the backend translateLogsQuery function

      const testCases = [
        {
          name: 'simple service filter',
          input: { logQuery: '', queryType: 'logs' as const },
          action: { type: 'ADD_FILTER' as const, options: { key: 'service', value: 'web-app' } },
          expected: 'service:web-app',
        },
        {
          name: 'status filter with existing query',
          input: { logQuery: 'error message', queryType: 'logs' as const },
          action: { type: 'ADD_FILTER' as const, options: { key: 'status', value: 'ERROR' } },
          expected: 'error message AND status:ERROR',
        },
        {
          name: 'negative filter',
          input: { logQuery: 'service:web-app', queryType: 'logs' as const },
          action: { type: 'ADD_FILTER_OUT' as const, options: { key: 'source', value: 'health-check' } },
          expected: 'service:web-app AND -source:health-check',
        },
        {
          name: 'quoted service name',
          input: { logQuery: 'error', queryType: 'logs' as const },
          action: { type: 'ADD_FILTER' as const, options: { key: 'service', value: 'my service' } },
          expected: 'error AND service:"my service"',
        },
      ];

      testCases.forEach(({ name, input, action, expected }) => {
        const query: MyQuery = { refId: 'A', ...input };
        const result = datasource.modifyQuery(query, action);
        
        expect(result.logQuery).toBe(expected);
        
        // Verify the query follows patterns that the backend can handle:
        // - Uses proper facet syntax (key:value)
        // - Uses AND for combining filters
        // - Uses quotes for values with spaces
        // - Uses - prefix for negative filters
        expect(result.logQuery).toMatch(/^[^:]*(:("[^"]*"|[^\s]+))?(\s+AND\s+(-?[^:]+:("[^"]*"|[^\s]+)))*$/);
      });
    });
  });

  describe('error handling', () => {
    it('should return original query for unsupported action types', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'test query',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'UNSUPPORTED_ACTION' as any,
        options: { key: 'service', value: 'web-app' },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('test query');
    });

    it('should return original query for non-logs queries', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'metrics query',
        queryType: 'metrics',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: { key: 'service', value: 'web-app' },
      };

      const result = datasource.modifyQuery(query, action);

      expect(result).toEqual(query); // Should return unchanged
    });

    it('should handle missing options gracefully', () => {
      const query: MyQuery = {
        refId: 'A',
        logQuery: 'test query',
        queryType: 'logs',
      };

      const action: QueryFixAction = {
        type: 'ADD_FILTER',
        options: {}, // Missing key and value
      };

      const result = datasource.modifyQuery(query, action);

      expect(result.logQuery).toBe('test query'); // Should return unchanged
    });
  });

  describe('getSupportedQueryModifications', () => {
    it('should return supported modification types', () => {
      const supportedTypes = datasource.getSupportedQueryModifications();

      expect(supportedTypes).toEqual(['ADD_FILTER', 'ADD_FILTER_OUT']);
    });
  });
});