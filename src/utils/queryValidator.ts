import { ValidationResult, ValidationError } from '../types';
import { parseQuery } from './autocomplete/parser';

/**
 * Validates a Datadog query for syntax and semantic correctness
 * Provides actionable error messages to help users fix issues
 *
 * Validation rules:
 * 1. Query must not be empty
 * 2. Metric name must be specified (before '{' or 'by')
 * 3. Metric name must contain valid characters (alphanumeric, dots, underscores)
 * 4. If tags are used, they must have format key:value
 * 5. If aggregation is used after 'by', must be valid aggregation function
 * 6. Braces and quotes must be balanced
 *
 * @param queryText - The Datadog query to validate
 * @returns ValidationResult with isValid flag and errors array
 */
export function validateQuery(queryText: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!queryText || !queryText.trim()) {
    return {
      isValid: false,
      errors: [
        {
          message: 'Query cannot be empty',
          fix: 'Start typing a metric name (e.g., system.cpu)',
        },
      ],
    };
  }

  // Check for balanced braces
  const openBraces = (queryText.match(/{/g) || []).length;
  const closeBraces = (queryText.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push({
      message: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
      fix: 'Add or remove braces to match pairs',
    });
  }

  // Parse the query to understand structure
  const context = parseQuery(queryText, queryText.length);

  // Validate metric name
  if (!context.metricName) {
    errors.push({
      message: 'Metric name is required',
      fix: 'Add a metric name at the beginning (e.g., system.cpu)',
    });
  } else if (!isValidMetricName(context.metricName)) {
    errors.push({
      message: `Invalid metric name: "${context.metricName}"`,
      fix: 'Use only alphanumeric characters, dots, and underscores',
    });
  }

  // Validate tags format if present
  if (queryText.includes('{') && queryText.includes('}')) {
    const tagErrors = validateTagSection(queryText);
    errors.push(...tagErrors);
  }

  // Validate aggregation if present
  if (queryText.includes(' by ')) {
    const aggErrors = validateAggregationSection(queryText);
    errors.push(...aggErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a metric name is valid
 * Valid: alphanumeric, dots, underscores
 * Invalid: special characters, spaces
 */
function isValidMetricName(metricName: string): boolean {
  // Allow alphanumeric, dots, underscores, colons (for namespacing)
  const metricRegex = /^[a-zA-Z0-9_.:-]+$/;
  return metricRegex.test(metricName);
}

/**
 * Validate the tag section (between { and })
 * Each tag must be in format key:value or key:*
 */
function validateTagSection(queryText: string): ValidationError[] {
  const errors: ValidationError[] = [];

  const openBrace = queryText.indexOf('{');
  const closeBrace = queryText.indexOf('}');

  if (openBrace === -1 || closeBrace === -1 || openBrace > closeBrace) {
    return errors;
  }

  const tagSection = queryText.substring(openBrace + 1, closeBrace).trim();

  if (!tagSection) {
    // Empty braces are allowed (no tags specified)
    return errors;
  }

  // Split by comma
  const tags = tagSection.split(',').map(t => t.trim());

  for (const tag of tags) {
    if (!tag) {
      continue; // Skip empty entries from trailing commas
    }

    // Check if this is a wildcard '*' which is valid as a standalone tag
    if (tag === '*') {
      continue; // Wildcard is valid, no further validation needed
    }

    const colonIndex = tag.indexOf(':');

    if (colonIndex === -1) {
      // No colon found - incomplete tag (unless it's a special case)
      errors.push({
        message: `Incomplete tag: "${tag}" (missing value)`,
        fix: `Complete it as "${tag}:value"`,
      });
    } else if (colonIndex === 0) {
      // Colon at start - missing key
      errors.push({
        message: `Invalid tag: "${tag}" (missing key)`,
        fix: 'Add a tag key before the colon',
      });
    } else {
      const key = tag.substring(0, colonIndex).trim();
      const value = tag.substring(colonIndex + 1).trim();

      if (!value) {
        errors.push({
          message: `Tag "${key}" has no value`,
          fix: `Specify a value: "${key}:value" or "${key}:*"`,
        });
      } else if (!isValidTagKey(key)) {
        errors.push({
          message: `Invalid tag key: "${key}"`,
          fix: 'Use alphanumeric characters, underscores, and hyphens',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate the aggregation section (after "by")
 */
function validateAggregationSection(queryText: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const validAggregations = [
    'avg',
    'max',
    'min',
    'sum',
    'count',
    'last',
    'percentile',
    'cardinality',
    'pct_95',
    'pct_99',
  ];

  const byMatch = queryText.match(/\s+by\s+(.+?)(?:\s|$)/);

  if (!byMatch || !byMatch[1]) {
    errors.push({
      message: 'Aggregation expected after "by"',
      fix: 'Add an aggregation function (e.g., "by avg")',
    });
    return errors;
  }

  const agg = byMatch[1].toLowerCase().trim();

  if (!validAggregations.includes(agg)) {
    errors.push({
      message: `Unknown aggregation: "${agg}"`,
      fix: `Use one of: ${validAggregations.join(', ')}`,
    });
  }

  return errors;
}

/**
 * Check if a tag key is valid
 * Valid: alphanumeric, underscores, hyphens
 */
function isValidTagKey(tagKey: string): boolean {
  const keyRegex = /^[a-zA-Z0-9_-]+$/;
  return keyRegex.test(tagKey);
}

/**
 * Get a human-friendly summary of validation errors
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return 'Query is valid';
  }

  if (result.errors.length === 1) {
    return result.errors[0].message;
  }

  return `${result.errors.length} errors found`;
}
