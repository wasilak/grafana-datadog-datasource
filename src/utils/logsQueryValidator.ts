/**
 * Logs Query Validator
 * 
 * Provides validation functionality specifically for Datadog logs queries.
 * This is separate from the metrics validator to handle logs-specific syntax and patterns.
 */

export interface LogsValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validates a Datadog logs query for syntax errors and provides suggestions
 */
export function validateLogsQuery(query: string): LogsValidationResult {
  if (!query || query.trim().length === 0) {
    return { isValid: true };
  }

  const trimmedQuery = query.trim();
  const warnings: string[] = [];

  // Check for unmatched parentheses
  const openParens = (trimmedQuery.match(/\(/g) || []).length;
  const closeParens = (trimmedQuery.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return {
      isValid: false,
      error: openParens > closeParens ? 'unmatched opening parenthesis' : 'unmatched closing parenthesis'
    };
  }

  // Check for unmatched quotes
  const quotes = (trimmedQuery.match(/"/g) || []).length;
  if (quotes % 2 !== 0) {
    return {
      isValid: false,
      error: 'Unmatched quote - make sure all quotes are properly closed'
    };
  }

  // Check for invalid boolean operator sequences (consecutive operators without operands)
  // Invalid: "AND AND", "OR OR", "AND OR", "OR AND", "NOT AND", "NOT OR"
  // Valid: "AND NOT", "OR NOT" (when followed by terms or parentheses)
  if (/\b(AND|OR)\s+(AND|OR)\b/.test(trimmedQuery) || /\bNOT\s+(AND|OR)\b/.test(trimmedQuery)) {
    return {
      isValid: false,
      error: 'Invalid boolean operator usage - cannot have consecutive operators'
    };
  }

  // Check for invalid wildcard patterns
  if (/\*{2,}/.test(trimmedQuery)) {
    return {
      isValid: false,
      error: 'Invalid wildcard pattern - use single * for wildcards'
    };
  }

  // Check for time range syntax (basic validation)
  if (/@timestamp:\s*[<>]=?\s*\w+/.test(trimmedQuery)) {
    // Time range queries should be handled by Grafana's time picker
    warnings.push('Consider using Grafana\'s time range picker instead of @timestamp filters');
  }

  // Performance warnings
  if (/^\w*\*/.test(trimmedQuery) && !/\w+:/.test(trimmedQuery)) {
    warnings.push('Wildcard searches without facets may be slow - consider adding service: or status: filters');
  }

  if (/^\w{1,2}$/.test(trimmedQuery)) {
    warnings.push('Very short search terms may return too many results - consider being more specific');
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Provides query suggestions based on the current query content
 */
export function getQuerySuggestions(query: string): string[] {
  const suggestions: string[] = [];
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    suggestions.push('Try searching for specific terms like "error", "timeout", or "exception"');
    suggestions.push('Use facets like service:name or status:ERROR to filter results');
    suggestions.push('Combine terms with AND, OR, NOT operators');
    return suggestions;
  }

  // Suggest facets for common error terms
  if (/\b(error|exception|fail|timeout|crash)\b/.test(trimmedQuery)) {
    suggestions.push('Consider using status:ERROR for log level filtering');
  }

  // Suggest service facet for service-related terms
  if (/\b(service|app|application)\b/.test(trimmedQuery)) {
    suggestions.push('Use service:name to filter by specific service');
  }

  // Suggest boolean operators for multiple terms
  if (trimmedQuery.split(/\s+/).length > 1 && !/\b(AND|OR|NOT)\b/.test(trimmedQuery)) {
    suggestions.push('Use AND, OR, NOT operators to combine search terms');
  }

  // Suggest wildcards for partial matches
  if (/\b\w{3,}\b/.test(trimmedQuery) && !trimmedQuery.includes('*')) {
    suggestions.push('Add * for wildcard matching (e.g., error* matches error, errors, errorCode)');
  }

  // Suggest quotes for exact phrases
  if (trimmedQuery.includes(' ') && !trimmedQuery.includes('"')) {
    suggestions.push('Use quotes for exact phrase matching: "exact phrase"');
  }

  return suggestions;
}