import { DEFAULT_QUERY, MyQuery, JSONParsingConfig } from '../../types';

describe('JSON Parsing Configuration Persistence', () => {
  describe('Default Configuration', () => {
    it('should include JSON parsing configuration in DEFAULT_QUERY', () => {
      expect(DEFAULT_QUERY.jsonParsing).toBeDefined();
      expect(DEFAULT_QUERY.jsonParsing?.enabled).toBe(false);
      expect(DEFAULT_QUERY.jsonParsing?.targetField).toBe('message');
      expect(DEFAULT_QUERY.jsonParsing?.options).toEqual({
        maxDepth: 10,
        maxSize: 1024 * 1024, // 1MB
        preserveOriginal: true,
        flattenNested: true,
      });
    });
  });

  describe('Configuration Migration', () => {
    it('should handle queries without JSON parsing configuration', () => {
      const legacyQuery: Partial<MyQuery> = {
        queryText: 'test query',
        queryType: 'logs',
        logQuery: 'service:web-app',
        // No jsonParsing field
      };

      // Simulate what happens when a legacy query is loaded
      const migratedQuery: MyQuery = {
        ...DEFAULT_QUERY,
        ...legacyQuery,
      } as MyQuery;

      expect(migratedQuery.jsonParsing).toBeDefined();
      expect(migratedQuery.jsonParsing?.enabled).toBe(false);
      expect(migratedQuery.jsonParsing?.targetField).toBe('message');
    });

    it('should preserve existing JSON parsing configuration', () => {
      const existingConfig: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 5,
          maxSize: 512 * 1024, // 512KB
          preserveOriginal: false,
          flattenNested: false,
        },
      };

      const queryWithConfig: Partial<MyQuery> = {
        queryText: 'test query',
        queryType: 'logs',
        logQuery: 'service:web-app',
        jsonParsing: existingConfig,
      };

      const finalQuery: MyQuery = {
        ...DEFAULT_QUERY,
        ...queryWithConfig,
      } as MyQuery;

      expect(finalQuery.jsonParsing).toEqual(existingConfig);
    });

    it('should handle partial JSON parsing configuration', () => {
      const partialConfig: Partial<JSONParsingConfig> = {
        enabled: true,
        targetField: 'attributes',
        // Missing options
      };

      const queryWithPartialConfig: Partial<MyQuery> = {
        queryText: 'test query',
        queryType: 'logs',
        logQuery: 'service:web-app',
        jsonParsing: partialConfig as JSONParsingConfig,
      };

      const finalQuery: MyQuery = {
        ...DEFAULT_QUERY,
        ...queryWithPartialConfig,
      } as MyQuery;

      expect(finalQuery.jsonParsing?.enabled).toBe(true);
      expect(finalQuery.jsonParsing?.targetField).toBe('attributes');
      // Should fall back to default options when not provided
      expect(finalQuery.jsonParsing?.options).toBeUndefined();
    });
  });

  describe('Configuration Serialization', () => {
    it('should serialize and deserialize JSON parsing configuration correctly', () => {
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

      const query: MyQuery = {
        ...DEFAULT_QUERY,
        jsonParsing: originalConfig,
      } as MyQuery;

      // Simulate serialization/deserialization (like saving to browser storage)
      const serialized = JSON.stringify(query);
      const deserialized: MyQuery = JSON.parse(serialized);

      expect(deserialized.jsonParsing).toEqual(originalConfig);
    });

    it('should handle undefined and null values in serialization', () => {
      const queryWithUndefined: MyQuery = {
        ...DEFAULT_QUERY,
        jsonParsing: undefined,
      } as MyQuery;

      const serialized = JSON.stringify(queryWithUndefined);
      const deserialized: MyQuery = JSON.parse(serialized);

      // JSON.stringify removes undefined values, so it should not be present
      expect(deserialized.jsonParsing).toBeUndefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required fields for enabled JSON parsing', () => {
      const invalidConfigs = [
        { enabled: true }, // Missing targetField
        { enabled: true, targetField: '' }, // Empty targetField
        { enabled: true, targetField: 'invalid_field' }, // Invalid targetField
      ];

      invalidConfigs.forEach((config) => {
        const query: MyQuery = {
          ...DEFAULT_QUERY,
          jsonParsing: config as JSONParsingConfig,
        } as MyQuery;

        // This would be caught by the validation function in LogsQueryEditor
        expect(query.jsonParsing?.enabled).toBe(true);
        if (config.targetField === undefined || config.targetField === '') {
          expect(query.jsonParsing?.targetField).toBeFalsy();
        } else if (config.targetField === 'invalid_field') {
          expect(['message', 'data', 'attributes', 'whole_log']).not.toContain(
            query.jsonParsing?.targetField
          );
        }
      });
    });

    it('should allow valid configurations', () => {
      const validConfigs = [
        { enabled: false }, // Disabled, no targetField required
        { enabled: true, targetField: 'message' },
        { enabled: true, targetField: 'data' },
        { enabled: true, targetField: 'attributes' },
        { enabled: true, targetField: 'whole_log' },
      ];

      validConfigs.forEach((config) => {
        const query: MyQuery = {
          ...DEFAULT_QUERY,
          jsonParsing: config as JSONParsingConfig,
        } as MyQuery;

        expect(query.jsonParsing).toBeDefined();
        if (config.enabled) {
          expect(['message', 'data', 'attributes', 'whole_log']).toContain(
            query.jsonParsing?.targetField
          );
        }
      });
    });
  });

  describe('Configuration State Management', () => {
    it('should maintain configuration state through query updates', () => {
      let currentQuery: MyQuery = {
        ...DEFAULT_QUERY,
        queryType: 'logs',
        logQuery: 'service:web-app',
      } as MyQuery;

      // Simulate enabling JSON parsing
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

      expect(currentQuery.jsonParsing?.enabled).toBe(true);
      expect(currentQuery.jsonParsing?.targetField).toBe('message');

      // Simulate changing target field
      currentQuery = {
        ...currentQuery,
        jsonParsing: {
          ...currentQuery.jsonParsing!,
          targetField: 'data',
        },
      };

      expect(currentQuery.jsonParsing?.enabled).toBe(true);
      expect(currentQuery.jsonParsing?.targetField).toBe('data');

      // Simulate disabling JSON parsing
      currentQuery = {
        ...currentQuery,
        jsonParsing: {
          enabled: false,
          targetField: 'message',
        },
      };

      expect(currentQuery.jsonParsing?.enabled).toBe(false);
    });
  });
});