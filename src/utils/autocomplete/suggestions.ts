import { CompletionItem, QueryContext, SuggestionGroup } from '../../types';

// Static list of Datadog aggregation functions
const AGGREGATIONS = [
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

/**
 * Generates autocomplete suggestions based on query context and available data
 *
 * @param context - Parsed query context with cursor position info
 * @param metrics - Array of available metric names from Datadog API
 * @param tagsForMetric - Array of available tags/tag values for the current metric
 * @returns Array of CompletionItem suggestions (max 100 items)
 */
export function generateSuggestions(
  context: QueryContext,
  metrics: string[] = [],
  tagsForMetric: string[] = []
): CompletionItem[] {
  let suggestions: CompletionItem[] = [];

  switch (context.contextType) {
    case 'metric':
      suggestions = generateMetricSuggestions(context, metrics);
      break;
    case 'aggregation':
      suggestions = generateAggregationSuggestions(context);
      break;
    case 'aggregator':
      suggestions = generateAggregatorSuggestions(context);
      break;
    case 'tag':
      suggestions = generateTagSuggestions(context, tagsForMetric);
      break;
    case 'tag_value':
      suggestions = generateTagValueSuggestions(context, tagsForMetric);
      break;
    case 'grouping_tag':
      suggestions = generateGroupingTagSuggestions(context, tagsForMetric);
      break;
    default:
      suggestions = [];
  }

  // Remove duplicates and limit to 100 items
  return deduplicateAndLimit(suggestions, 100);
}

/**
 * Generates metric name suggestions
 * Note: For now returns empty as full metric listing requires backend support
 */
function generateMetricSuggestions(context: QueryContext, metrics: string[]): CompletionItem[] {
  const currentToken = context.currentToken.toLowerCase();

  if (metrics.length === 0) {
    // If no metrics provided, return helpful message
    return [
      {
        label: 'No metrics available',
        kind: 'metric',
        insertText: '',
        documentation: 'Metric suggestions require backend support',
        sortText: 'z_nomatch',
      },
    ];
  }

  return metrics
    .filter(metric => metric.toLowerCase().includes(currentToken))
    .slice(0, 100)
    .map(metric => ({
      label: metric,
      kind: 'metric',
      insertText: metric,
      documentation: `Datadog metric: ${metric}`,
      sortText: metric,
    }));
}

/**
 * Available aggregator functions in Datadog
 */
const AGGREGATORS = [
  'avg',
  'sum',
  'min',
  'max',
];

/**
 * Generates aggregation function suggestions
 */
function generateAggregationSuggestions(context: QueryContext): CompletionItem[] {
  const currentToken = context.currentToken.toLowerCase();

  return AGGREGATIONS.filter(agg => agg.toLowerCase().startsWith(currentToken)).map(agg => ({
    label: agg,
    kind: 'aggregation',
    insertText: agg,
    documentation: `Datadog aggregation function: ${agg}`,
    sortText: agg,
  }));
}

/**
 * Generates aggregator suggestions (for the prefix part like "avg:", "sum:", etc.)
 */
function generateAggregatorSuggestions(context: QueryContext): CompletionItem[] {
  const currentToken = context.currentToken.toLowerCase();

  return AGGREGATORS.filter(agg => agg.toLowerCase().startsWith(currentToken)).map(agg => {
    // For aggregator context, always return just the aggregator name without colon
    // The colon handling is taken care of in the token replacement logic
    return {
      label: agg,
      kind: 'aggregator',
      insertText: agg, // Don't add colon here - that's handled by the replacement logic
      documentation: `Datadog aggregator: ${agg}`,
      sortText: agg,
    };
  });
}

/**
 * Generates tag key suggestions
 * Filters out already-used tags and the current token
 */
function generateTagSuggestions(context: QueryContext, tagsForMetric: string[]): CompletionItem[] {
  const currentToken = context.currentToken.toLowerCase();

  // Extract tag keys (part before ':') from available tags
  const tagKeys = extractTagKeys(tagsForMetric);

  return tagKeys
    .filter(tag => {
      // Filter by current token match
      if (!tag.toLowerCase().includes(currentToken)) {
        return false;
      }
      // Exclude already-used tags
      if (context.existingTags.has(tag)) {
        return false;
      }
      return true;
    })
    .slice(0, 100)
    .map(tag => ({
      label: tag,
      kind: 'tag',
      insertText: `${tag}:`,
      documentation: `Tag key: ${tag}`,
      sortText: tag,
    }));
}

/**
 * Generates tag value suggestions
 * Filters tag values for the current tag being edited
 */
function generateTagValueSuggestions(context: QueryContext, tagsForMetric: string[]): CompletionItem[] {
  const currentToken = context.currentToken.toLowerCase();

  // Extract the current tag key being edited
  const currentTagKey = extractCurrentTagKey(context.lineContent, context.cursorPosition);
  if (!currentTagKey) {
    return [];
  }

  // Find values for this tag
  const tagValues = extractTagValues(tagsForMetric, currentTagKey);

  return tagValues
    .filter(value => value.toLowerCase().includes(currentToken))
    .slice(0, 100)
    .map(value => ({
      label: value,
      kind: 'tag_value',
      insertText: value,
      documentation: `Value for tag ${currentTagKey}: ${value}`,
      sortText: value,
    }));
}

/**
 * Generates grouping tag suggestions (for "by {}" clause)
 * Suggests tag keys that can be used for grouping
 */
function generateGroupingTagSuggestions(context: QueryContext, tagsForMetric: string[]): CompletionItem[] {
  const currentToken = context.currentToken.toLowerCase();

  // Extract tag keys from available tags
  const tagKeys = extractTagKeys(tagsForMetric);

  // Extract already-used grouping tags from the "by {}" clause
  const existingGroupingTags = extractExistingGroupingTags(context.lineContent, context.cursorPosition);

  return tagKeys
    .filter(tag => {
      // Filter by current token match
      if (!tag.toLowerCase().includes(currentToken)) {
        return false;
      }
      // Exclude already-used grouping tags
      if (existingGroupingTags.has(tag)) {
        return false;
      }
      return true;
    })
    .slice(0, 100)
    .map(tag => ({
      label: tag,
      kind: 'grouping_tag',  // Use unique kind for grouping tags
      insertText: tag,
      documentation: `Group by tag: ${tag}`,
      sortText: tag,
    }));
}

/**
 * Extract unique tag keys from a list of tag entries
 * Expected format: "tag_key:tag_value" or just "tag_key"
 */
function extractTagKeys(tags: string[]): string[] {
  const keys = new Set<string>();

  for (const tag of tags) {
    const colonIndex = tag.indexOf(':');
    if (colonIndex !== -1) {
      keys.add(tag.substring(0, colonIndex).trim());
    } else {
      keys.add(tag.trim());
    }
  }

  return Array.from(keys);
}

/**
 * Extract values for a specific tag key
 */
function extractTagValues(tags: string[], tagKey: string): string[] {
  const values: string[] = [];

  for (const tag of tags) {
    const colonIndex = tag.indexOf(':');
    if (colonIndex !== -1) {
      const key = tag.substring(0, colonIndex).trim();
      const value = tag.substring(colonIndex + 1).trim();
      if (key === tagKey) {
        values.push(value);
      }
    }
  }

  return values;
}

/**
 * Extract the current tag key being edited (e.g., "host" in "host:web-")
 */
function extractCurrentTagKey(lineContent: string, cursorPosition: number): string | null {
  // Find the opening brace
  const openBrace = lineContent.lastIndexOf('{', cursorPosition);
  if (openBrace === -1) {
    return null;
  }

  // Find content from opening brace to cursor
  const tagSection = lineContent.substring(openBrace + 1, cursorPosition);

  // Find the last complete or incomplete tag
  // Look for the last comma to find the start of current tag
  const lastComma = tagSection.lastIndexOf(',');
  const currentTagStart = lastComma === -1 ? 0 : lastComma + 1;
  const currentTagStr = tagSection.substring(currentTagStart).trim();

  // Extract key (part before ':')
  const colonIndex = currentTagStr.indexOf(':');
  if (colonIndex !== -1) {
    return currentTagStr.substring(0, colonIndex).trim();
  }

  // If no colon found, the whole token is the key so far
  return currentTagStr || null;
}

/**
 * Extract existing grouping tags from the "by {}" clause
 */
function extractExistingGroupingTags(lineContent: string, cursorPosition: number): Set<string> {
  const tags = new Set<string>();

  // Find "by {" pattern
  const byMatch = lineContent.match(/\s+by\s+\{([^}]*)\}/);
  if (!byMatch) {
    return tags;
  }

  const groupingSection = byMatch[1].trim();
  if (!groupingSection) {
    return tags;
  }

  // Split by comma and extract tag names
  const tagNames = groupingSection.split(',').map(t => t.trim());
  for (const tagName of tagNames) {
    if (tagName) {
      tags.add(tagName);
    }
  }

  return tags;
}

/**
 * Remove duplicates from suggestions and limit to maxItems
 */
function deduplicateAndLimit(suggestions: CompletionItem[], maxItems: number): CompletionItem[] {
  const seen = new Set<string>();
  const result: CompletionItem[] = [];

  for (const suggestion of suggestions) {
    if (!seen.has(suggestion.label) && result.length < maxItems) {
      seen.add(suggestion.label);
      result.push(suggestion);
    }
  }

  return result;
}

/**
 * Group suggestions by category
 * Groups are ordered: aggregators, metrics, tags, tag_values
 * Empty groups are filtered out
 *
 * @param suggestions - Array of completion items to group
 * @returns Array of suggestion groups with labels and suggestions
 */
export function groupSuggestions(suggestions: CompletionItem[]): SuggestionGroup[] {
  // Map to collect suggestions by category
  const groups = new Map<string, CompletionItem[]>();

  // Collect suggestions into categories
  for (const suggestion of suggestions) {
    const category = getCategoryFromKind(suggestion.kind);
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(suggestion);
  }

  // Define category order and labels
  const categoryOrder: Array<{ key: string; category: SuggestionGroup['category']; label: string }> = [
    { key: 'aggregators', category: 'aggregators', label: 'Aggregators' },
    { key: 'metrics', category: 'metrics', label: 'Metrics' },
    { key: 'tags', category: 'tags', label: 'Tags' },
    { key: 'tag_values', category: 'tag_values', label: 'Tag Values' },
  ];

  // Build result array in order, filtering out empty groups
  const result: SuggestionGroup[] = [];
  for (const { key, category, label } of categoryOrder) {
    const suggestions = groups.get(key);
    if (suggestions && suggestions.length > 0) {
      result.push({
        category,
        label,
        suggestions,
      });
    }
  }

  return result;
}

/**
 * Map CompletionItem kind to category key
 */
function getCategoryFromKind(kind?: string): string {
  switch (kind) {
    case 'aggregation':
    case 'aggregator':
      return 'aggregators';
    case 'metric':
      return 'metrics';
    case 'tag':
      return 'tags';
    case 'tag_value':
      return 'tag_values';
    default:
      return 'metrics'; // Default to metrics for unknown kinds
  }
}


