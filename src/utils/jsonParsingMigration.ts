import { MyQuery, JSONParsingConfig, DEFAULT_QUERY } from '../types';

/**
 * Migrates legacy queries to include JSON parsing configuration
 * Ensures backward compatibility with existing saved queries
 */
export function migrateJsonParsingConfiguration(query: Partial<MyQuery>): MyQuery {
  // Start with default query to ensure all required fields are present
  const migratedQuery: MyQuery = {
    ...DEFAULT_QUERY,
    ...query,
  } as MyQuery;

  // If jsonParsing is completely missing, use the default
  if (!migratedQuery.jsonParsing) {
    migratedQuery.jsonParsing = DEFAULT_QUERY.jsonParsing!;
    return migratedQuery;
  }

  // If jsonParsing exists but is incomplete, merge with defaults
  const defaultJsonParsing = DEFAULT_QUERY.jsonParsing!;
  migratedQuery.jsonParsing = {
    enabled: migratedQuery.jsonParsing.enabled ?? defaultJsonParsing.enabled,
    targetField: migratedQuery.jsonParsing.targetField ?? defaultJsonParsing.targetField,
    options: migratedQuery.jsonParsing.options 
      ? {
          maxDepth: migratedQuery.jsonParsing.options.maxDepth ?? defaultJsonParsing.options?.maxDepth,
          maxSize: migratedQuery.jsonParsing.options.maxSize ?? defaultJsonParsing.options?.maxSize,
          preserveOriginal: migratedQuery.jsonParsing.options.preserveOriginal ?? defaultJsonParsing.options?.preserveOriginal,
          flattenNested: migratedQuery.jsonParsing.options.flattenNested ?? defaultJsonParsing.options?.flattenNested,
        }
      : defaultJsonParsing.options,
  };

  return migratedQuery;
}

/**
 * Validates JSON parsing configuration
 * Returns validation result with error messages
 */
export function validateJsonParsingConfiguration(config?: JSONParsingConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config) {
    return { isValid: true, errors, warnings };
  }

  // If JSON parsing is disabled, configuration is valid
  if (!config.enabled) {
    return { isValid: true, errors, warnings };
  }

  // Check if target field is selected - only 'message' is now supported for user configuration
  // Attributes and tags are always parsed automatically
  if (!config.targetField) {
    errors.push('Field selection is required when JSON parsing is enabled');
  } else {
    // Only 'message' field parsing is configurable - attributes and tags are always parsed
    const validFields = ['message'];
    if (!validFields.includes(config.targetField)) {
      errors.push(`Invalid field selection. Only 'message' field parsing is configurable. Attributes and tags are always parsed automatically.`);
    }
  }

  // Validate options if present
  if (config.options) {
    if (config.options.maxDepth !== undefined && config.options.maxDepth < 1) {
      errors.push('Maximum depth must be at least 1');
    }

    if (config.options.maxSize !== undefined && config.options.maxSize < 1024) {
      errors.push('Maximum size must be at least 1KB (1024 bytes)');
    }

    // Performance warnings
    if (config.options.maxDepth !== undefined && config.options.maxDepth > 20) {
      warnings.push('Very deep nesting (>20 levels) may impact performance');
    }

    if (config.options.maxSize !== undefined && config.options.maxSize > 10 * 1024 * 1024) {
      warnings.push('Large size limits (>10MB) may impact performance');
    }
  }

  // No field-specific warnings needed since only 'message' field is supported

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Creates a safe copy of JSON parsing configuration for serialization
 * Removes any undefined values that could cause issues
 */
export function serializeJsonParsingConfiguration(config?: JSONParsingConfig): JSONParsingConfig | undefined {
  if (!config) {
    return undefined;
  }

  const serialized: JSONParsingConfig = {
    enabled: config.enabled,
    targetField: config.targetField,
  };

  if (config.options) {
    serialized.options = {};
    
    if (config.options.maxDepth !== undefined) {
      serialized.options.maxDepth = config.options.maxDepth;
    }
    
    if (config.options.maxSize !== undefined) {
      serialized.options.maxSize = config.options.maxSize;
    }
    
    if (config.options.preserveOriginal !== undefined) {
      serialized.options.preserveOriginal = config.options.preserveOriginal;
    }
    
    if (config.options.flattenNested !== undefined) {
      serialized.options.flattenNested = config.options.flattenNested;
    }

    // Remove options object if it's empty
    if (Object.keys(serialized.options).length === 0) {
      delete serialized.options;
    }
  }

  return serialized;
}

/**
 * Checks if two JSON parsing configurations are equivalent
 * Useful for detecting configuration changes
 */
export function isJsonParsingConfigurationEqual(
  config1?: JSONParsingConfig,
  config2?: JSONParsingConfig
): boolean {
  // Both undefined/null
  if (!config1 && !config2) {
    return true;
  }

  // One is undefined/null, the other is not
  if (!config1 || !config2) {
    return false;
  }

  // Compare basic properties
  if (config1.enabled !== config2.enabled || config1.targetField !== config2.targetField) {
    return false;
  }

  // Compare options
  const options1 = config1.options;
  const options2 = config2.options;

  // Both options undefined/null
  if (!options1 && !options2) {
    return true;
  }

  // One options is undefined/null, the other is not
  if (!options1 || !options2) {
    return false;
  }

  // Compare all option properties
  return (
    options1.maxDepth === options2.maxDepth &&
    options1.maxSize === options2.maxSize &&
    options1.preserveOriginal === options2.preserveOriginal &&
    options1.flattenNested === options2.flattenNested
  );
}