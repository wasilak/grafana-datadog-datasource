import { MyQuery, JSONParsingConfig, DEFAULT_QUERY } from '../../types';
import { migrateJsonParsingConfiguration } from '../jsonParsingMigration';

describe('Configuration Persistence Integration', () => {

  describe('Query Migration and Persistence', () => {
    it('should migrate legacy queries without JSON parsing configuration', () => {
      const legacyQuery: Partial<MyQuery> = {
        refId: 'A',
        queryText: 'test query',
        queryType: 'logs',
        logQuery: 'service:web-app',
        // No jsonParsing field - simulates old saved query
      };

      const migratedQuery = migrateJsonParsingConfiguration(legacyQuery);

      expect(migratedQuery.jsonParsing).toBeDefined();
      expect(migratedQuery.jsonParsing?.enabled).toBe(false);
      expect(migratedQuery.jsonParsing?.targetField).toBe('message');
      expect(migratedQuery.jsonParsing?.options).toEqual(DEFAULT_QUERY.jsonParsing?.options);
    });

    it('should preserve existing JSON parsing configuration during migration', () => {
      const existingConfig: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 5,
          maxSize: 512 * 1024,
          preserveOriginal: false,
          flattenNested: false,
        },
      };

      const queryWithConfig: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'service:web-app status:error',
        jsonParsing: existingConfig,
      } as MyQuery;

      const migratedQuery = migrateJsonParsingConfiguration(queryWithConfig);

      expect(migratedQuery.jsonParsing).toEqual(existingConfig);
    });

    it('should handle partial JSON parsing configuration during migration', () => {
      const partialConfig: Partial<JSONParsingConfig> = {
        enabled: true,
        targetField: 'attributes',
        // Missing options - should be filled with defaults
      };

      const queryWithPartialConfig: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'service:api-gateway',
        jsonParsing: partialConfig as JSONParsingConfig,
      } as MyQuery;

      const migratedQuery = migrateJsonParsingConfiguration(queryWithPartialConfig);

      expect(migratedQuery.jsonParsing?.enabled).toBe(true);
      expect(migratedQuery.jsonParsing?.targetField).toBe('attributes');
      expect(migratedQuery.jsonParsing?.options).toEqual(DEFAULT_QUERY.jsonParsing?.options);
    });
  });

  describe('Browser Session Persistence Simulation', () => {
    it('should maintain configuration through serialization/deserialization cycle', () => {
      const originalConfig: JSONParsingConfig = {
        enabled: true,
        targetField: 'whole_log',
        options: {
          maxDepth: 15,
          maxSize: 2 * 1024 * 1024, // 2MB
          preserveOriginal: true,
          flattenNested: false,
        },
      };

      const originalQuery: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'env:production level:error',
        jsonParsing: originalConfig,
      } as MyQuery;

      // Simulate saving to browser storage (JSON serialization)
      const serialized = JSON.stringify(originalQuery);
      
      // Simulate loading from browser storage (JSON deserialization)
      const deserializedQuery: MyQuery = JSON.parse(serialized);
      
      // Simulate datasource processing the loaded query
      const processedQuery = migrateJsonParsingConfiguration(deserializedQuery);

      expect(processedQuery.jsonParsing).toEqual(originalConfig);
      expect(processedQuery.logQuery).toBe('env:production level:error');
      expect(processedQuery.queryType).toBe('logs');
    });

    it('should handle undefined JSON parsing configuration in stored queries', () => {
      const queryWithoutJsonParsing: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'service:database',
        jsonParsing: undefined,
      } as MyQuery;

      // Simulate serialization/deserialization
      const serialized = JSON.stringify(queryWithoutJsonParsing);
      const deserializedQuery: MyQuery = JSON.parse(serialized);
      
      // Process through migration
      const processedQuery = migrateJsonParsingConfiguration(deserializedQuery);

      expect(processedQuery.jsonParsing).toBeDefined();
      expect(processedQuery.jsonParsing?.enabled).toBe(false);
      expect(processedQuery.jsonParsing?.targetField).toBe('message');
    });

    it('should preserve configuration across multiple query modifications', () => {
      let currentQuery: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'service:web-app',
      } as MyQuery;

      // Step 1: Enable JSON parsing
      currentQuery = {
        ...currentQuery,
        jsonParsing: {
          enabled: true,
          targetField: 'message',
          options: {
            preserveOriginal: true,
            flattenNested: true,
            maxDepth: 10,
            maxSize: 1024 * 1024,
          },
        },
      };

      // Step 2: Change target field
      currentQuery = {
        ...currentQuery,
        jsonParsing: {
          ...currentQuery.jsonParsing!,
          targetField: 'data',
        },
      };

      // Step 3: Modify query text
      currentQuery = {
        ...currentQuery,
        logQuery: 'service:web-app status:error',
      };

      // Step 4: Process through migration (simulates datasource processing)
      const processedQuery = migrateJsonParsingConfiguration(currentQuery);

      expect(processedQuery.jsonParsing?.enabled).toBe(true);
      expect(processedQuery.jsonParsing?.targetField).toBe('data');
      expect(processedQuery.logQuery).toBe('service:web-app status:error');
      expect(processedQuery.jsonParsing?.options?.preserveOriginal).toBe(true);
    });
  });

  describe('Configuration State Consistency', () => {
    it('should maintain consistent state when toggling JSON parsing on and off', () => {
      let query: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'service:api',
      } as MyQuery;

      // Enable JSON parsing
      query = {
        ...query,
        jsonParsing: {
          enabled: true,
          targetField: 'attributes',
          options: {
            maxDepth: 8,
            maxSize: 512 * 1024,
            preserveOriginal: false,
            flattenNested: true,
          },
        },
      };

      const enabledState = { ...query };

      // Disable JSON parsing
      query = {
        ...query,
        jsonParsing: {
          enabled: false,
          targetField: 'message',
        },
      };

      // Re-enable with previous configuration
      query = {
        ...query,
        jsonParsing: enabledState.jsonParsing,
      };

      const finalQuery = migrateJsonParsingConfiguration(query);

      expect(finalQuery.jsonParsing?.enabled).toBe(true);
      expect(finalQuery.jsonParsing?.targetField).toBe('attributes');
      expect(finalQuery.jsonParsing?.options?.maxDepth).toBe(8);
    });

    it('should handle configuration updates without losing other query properties', () => {
      const baseQuery: MyQuery = {
        ...DEFAULT_QUERY,
        refId: 'A',
        queryType: 'logs',
        logQuery: 'service:frontend level:warn',
        indexes: ['main', 'errors'],
        legendMode: 'custom',
        legendTemplate: '{{service}}',
      } as MyQuery;

      // Add JSON parsing configuration
      const queryWithJsonParsing: MyQuery = {
        ...baseQuery,
        jsonParsing: {
          enabled: true,
          targetField: 'whole_log',
          options: {
            maxDepth: 12,
            maxSize: 1024 * 1024,
            preserveOriginal: true,
            flattenNested: false,
          },
        },
      };

      const processedQuery = migrateJsonParsingConfiguration(queryWithJsonParsing);

      // Verify JSON parsing configuration is preserved
      expect(processedQuery.jsonParsing?.enabled).toBe(true);
      expect(processedQuery.jsonParsing?.targetField).toBe('whole_log');

      // Verify other query properties are preserved
      expect(processedQuery.logQuery).toBe('service:frontend level:warn');
      expect(processedQuery.indexes).toEqual(['main', 'errors']);
      expect(processedQuery.legendMode).toBe('custom');
      expect(processedQuery.legendTemplate).toBe('{{service}}');
      expect(processedQuery.queryType).toBe('logs');
    });
  });
});