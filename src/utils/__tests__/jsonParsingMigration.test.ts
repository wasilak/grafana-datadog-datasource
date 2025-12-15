import {
  migrateJsonParsingConfiguration,
  validateJsonParsingConfiguration,
  serializeJsonParsingConfiguration,
  isJsonParsingConfigurationEqual,
} from '../jsonParsingMigration';
import { MyQuery, JSONParsingConfig, DEFAULT_QUERY } from '../../types';

describe('JSON Parsing Migration Utilities', () => {
  describe('migrateJsonParsingConfiguration', () => {
    it('should add default JSON parsing configuration to legacy queries', () => {
      const legacyQuery: Partial<MyQuery> = {
        queryText: 'test query',
        queryType: 'logs',
        logQuery: 'service:web-app',
      };

      const migrated = migrateJsonParsingConfiguration(legacyQuery);

      expect(migrated.jsonParsing).toBeDefined();
      expect(migrated.jsonParsing?.enabled).toBe(false);
      expect(migrated.jsonParsing?.targetField).toBe('message');
      expect(migrated.jsonParsing?.options).toEqual(DEFAULT_QUERY.jsonParsing?.options);
    });

    it('should preserve existing complete JSON parsing configuration', () => {
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

      const queryWithConfig: Partial<MyQuery> = {
        queryText: 'test query',
        jsonParsing: existingConfig,
      };

      const migrated = migrateJsonParsingConfiguration(queryWithConfig);

      expect(migrated.jsonParsing).toEqual(existingConfig);
    });

    it('should fill in missing JSON parsing options with defaults', () => {
      const partialConfig: Partial<JSONParsingConfig> = {
        enabled: true,
        targetField: 'attributes',
        // Missing options
      };

      const queryWithPartialConfig: Partial<MyQuery> = {
        queryText: 'test query',
        jsonParsing: partialConfig as JSONParsingConfig,
      };

      const migrated = migrateJsonParsingConfiguration(queryWithPartialConfig);

      expect(migrated.jsonParsing?.enabled).toBe(true);
      expect(migrated.jsonParsing?.targetField).toBe('attributes');
      expect(migrated.jsonParsing?.options).toEqual(DEFAULT_QUERY.jsonParsing?.options);
    });

    it('should merge partial options with defaults', () => {
      const partialConfig: JSONParsingConfig = {
        enabled: true,
        targetField: 'whole_log',
        options: {
          maxDepth: 15,
          // Missing other options
        } as any,
      };

      const queryWithPartialConfig: Partial<MyQuery> = {
        queryText: 'test query',
        jsonParsing: partialConfig,
      };

      const migrated = migrateJsonParsingConfiguration(queryWithPartialConfig);

      expect(migrated.jsonParsing?.options?.maxDepth).toBe(15);
      expect(migrated.jsonParsing?.options?.maxSize).toBe(DEFAULT_QUERY.jsonParsing?.options?.maxSize);
      expect(migrated.jsonParsing?.options?.preserveOriginal).toBe(DEFAULT_QUERY.jsonParsing?.options?.preserveOriginal);
      expect(migrated.jsonParsing?.options?.flattenNested).toBe(DEFAULT_QUERY.jsonParsing?.options?.flattenNested);
    });
  });

  describe('validateJsonParsingConfiguration', () => {
    it('should validate undefined configuration as valid', () => {
      const result = validateJsonParsingConfiguration(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate disabled configuration as valid', () => {
      const config: JSONParsingConfig = {
        enabled: false,
        targetField: 'message',
      };

      const result = validateJsonParsingConfiguration(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require target field when enabled', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: '',
      };

      const result = validateJsonParsingConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field selection is required when JSON parsing is enabled');
    });

    it('should validate target field options', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: 'invalid_field' as any,
      };

      const result = validateJsonParsingConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid field selection');
    });

    it('should validate options constraints', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: 'message',
        options: {
          maxDepth: 0, // Invalid
          maxSize: 100, // Too small
        },
      };

      const result = validateJsonParsingConfiguration(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum depth must be at least 1');
      expect(result.errors).toContain('Maximum size must be at least 1KB (1024 bytes)');
    });

    it('should provide performance warnings', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: 'whole_log',
        options: {
          maxDepth: 25, // Very deep
          maxSize: 20 * 1024 * 1024, // Very large
        },
      };

      const result = validateJsonParsingConfiguration(config);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Very deep nesting (>20 levels) may impact performance');
      expect(result.warnings).toContain('Large size limits (>10MB) may impact performance');
      expect(result.warnings).toContain('Whole log parsing may impact performance with large log volumes');
    });
  });

  describe('serializeJsonParsingConfiguration', () => {
    it('should return undefined for undefined input', () => {
      const result = serializeJsonParsingConfiguration(undefined);
      expect(result).toBeUndefined();
    });

    it('should serialize complete configuration', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 10,
          maxSize: 1024 * 1024,
          preserveOriginal: true,
          flattenNested: false,
        },
      };

      const result = serializeJsonParsingConfiguration(config);
      expect(result).toEqual(config);
    });

    it('should remove empty options object', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: 'message',
        options: {},
      };

      const result = serializeJsonParsingConfiguration(config);
      expect(result?.options).toBeUndefined();
    });

    it('should only include defined option properties', () => {
      const config: JSONParsingConfig = {
        enabled: true,
        targetField: 'attributes',
        options: {
          maxDepth: 5,
          // Other properties undefined
        } as any,
      };

      const result = serializeJsonParsingConfiguration(config);
      expect(result?.options?.maxDepth).toBe(5);
      expect(result?.options?.maxSize).toBeUndefined();
      expect(result?.options?.preserveOriginal).toBeUndefined();
      expect(result?.options?.flattenNested).toBeUndefined();
    });
  });

  describe('isJsonParsingConfigurationEqual', () => {
    it('should return true for both undefined configurations', () => {
      const result = isJsonParsingConfigurationEqual(undefined, undefined);
      expect(result).toBe(true);
    });

    it('should return false when one configuration is undefined', () => {
      const config: JSONParsingConfig = {
        enabled: false,
        targetField: 'message',
      };

      expect(isJsonParsingConfigurationEqual(config, undefined)).toBe(false);
      expect(isJsonParsingConfigurationEqual(undefined, config)).toBe(false);
    });

    it('should return true for identical configurations', () => {
      const config1: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 10,
          maxSize: 1024 * 1024,
          preserveOriginal: true,
          flattenNested: false,
        },
      };

      const config2: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 10,
          maxSize: 1024 * 1024,
          preserveOriginal: true,
          flattenNested: false,
        },
      };

      const result = isJsonParsingConfigurationEqual(config1, config2);
      expect(result).toBe(true);
    });

    it('should return false for different basic properties', () => {
      const config1: JSONParsingConfig = {
        enabled: true,
        targetField: 'message',
      };

      const config2: JSONParsingConfig = {
        enabled: false,
        targetField: 'message',
      };

      const result = isJsonParsingConfigurationEqual(config1, config2);
      expect(result).toBe(false);
    });

    it('should return false for different options', () => {
      const config1: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 10,
          preserveOriginal: true,
        },
      };

      const config2: JSONParsingConfig = {
        enabled: true,
        targetField: 'data',
        options: {
          maxDepth: 5,
          preserveOriginal: true,
        },
      };

      const result = isJsonParsingConfigurationEqual(config1, config2);
      expect(result).toBe(false);
    });

    it('should handle configurations with and without options', () => {
      const config1: JSONParsingConfig = {
        enabled: true,
        targetField: 'message',
      };

      const config2: JSONParsingConfig = {
        enabled: true,
        targetField: 'message',
        options: {
          maxDepth: 10,
        },
      };

      const result = isJsonParsingConfigurationEqual(config1, config2);
      expect(result).toBe(false);
    });
  });
});