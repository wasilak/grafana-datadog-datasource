/**
 * Logs query validation utilities
 * Provides validation for Datadog logs search syntax
 */

export interface LogsValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validates a Datadog logs query syntax
 */
export function validateLogsQuery(query: string): LogsValidationResult {
  if (!query || query.trim() === '') {
    return { isValid: true }; // Empty queries are valid
  }

  const trimmedQuery = query.trim();
  const warnings: string[] = [];

  try {
    // Check for basic syntax errors
    const syntaxValidation = validateBasicSyntax(trimmedQuery);
    if (!syntaxValidation.isValid) {
      return syntaxValidation;
    }

    // Check for common issues and provide warnings
    const warningChecks = checkForWarnings(trimmedQuery);
    warnings.push(...warningChecks);

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Query validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validates basic syntax rules for logs queries
 */
function validateBasicSyntax(query: string): LogsValidationResult {
  // Check for unmatched parentheses
  const parenthesesCheck = validateParentheses(query);
  if (!parenthesesCheck.isValid) {
    return parenthesesCheck;
  }

  // Check for unmatched quotes
  const quotesCheck = validateQuotes(query);
  if (!quotesCheck.isValid) {
    return quotesCheck;
  }

  // Check for invalid facet syntax
  const facetCheck = validateFacetSyntax(query);
  if (!facetCheck.isValid) {
    return facetCheck;
  }

  // Check for invalid boolean operators (Requirements 4.3)
  const booleanCheck = validateBooleanOperators(query);
  if (!booleanCheck.isValid) {
    return booleanCheck;
  }

  // Check for invalid wildcard patterns (Requirements 4.4)
  const wildcardCheck = validateWildcardPatterns(query);
  if (!wildcardCheck.isValid) {
    return wildcardCheck;
  }

  // Check for time range integration issues (Requirements 4.5)
  const timeRangeCheck = validateTimeRangeIntegration(query);
  if (!timeRangeCheck.isValid) {
    return timeRangeCheck;
  }

  // Collect warnings from all checks
  const allWarnings: string[] = [];
  if (booleanCheck.warnings) allWarnings.push(...booleanCheck.warnings);
  if (wildcardCheck.warnings) allWarnings.push(...wildcardCheck.warnings);
  if (timeRangeCheck.warnings) allWarnings.push(...timeRangeCheck.warnings);

  return { 
    isValid: true,
    warnings: allWarnings.length > 0 ? allWarnings : undefined
  };
}

/**
 * Validates parentheses are properly matched
 */
function validateParentheses(query: string): LogsValidationResult {
  let depth = 0;
  let position = 0;

  for (const char of query) {
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth < 0) {
        return {
          isValid: false,
          error: `Unmatched closing parenthesis at position ${position + 1}`
        };
      }
    }
    position++;
  }

  if (depth > 0) {
    return {
      isValid: false,
      error: `${depth} unmatched opening parenthesis${depth > 1 ? 'es' : ''}`
    };
  }

  return { isValid: true };
}

/**
 * Validates quotes are properly matched
 */
function validateQuotes(query: string): LogsValidationResult {
  let inQuotes = false;
  let position = 0;
  let quoteStart = -1;

  for (const char of query) {
    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true;
        quoteStart = position;
      } else {
        inQuotes = false;
      }
    }
    position++;
  }

  if (inQuotes) {
    return {
      isValid: false,
      error: `Unmatched quote starting at position ${quoteStart + 1}`
    };
  }

  return { isValid: true };
}

/**
 * Validates facet syntax (facet:value patterns)
 */
function validateFacetSyntax(query: string): LogsValidationResult {
  // Match facet patterns: word:value
  const facetPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*):([^:\s]*)/g;
  let match;

  while ((match = facetPattern.exec(query)) !== null) {
    const [fullMatch, facetName, facetValue] = match;
    
    // Check if facet value is empty (except for quoted values)
    if (!facetValue && !facetValue.startsWith('"')) {
      return {
        isValid: false,
        error: `Empty value for facet "${facetName}". Use quotes for empty values or provide a value.`
      };
    }

    // Validate known facet names (provide suggestions for typos)
    const knownFacets = ['service', 'source', 'status', 'level', 'host', 'env', 'version', 'tag'];
    if (!knownFacets.includes(facetName.toLowerCase())) {
      // This is a warning, not an error - custom facets are allowed
      continue;
    }

    // Validate status/level values
    if (facetName.toLowerCase() === 'status' || facetName.toLowerCase() === 'level') {
      const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
      const levelValue = facetValue.toUpperCase().replace(/[()]/g, '');
      
      // Check if it's a complex expression like (ERROR OR WARN)
      if (levelValue.includes('OR') || levelValue.includes('AND')) {
        const levels = levelValue.split(/\s+(OR|AND)\s+/);
        for (const level of levels) {
          const cleanLevel = level.trim();
          if (cleanLevel && !validLevels.includes(cleanLevel) && cleanLevel !== 'OR' && cleanLevel !== 'AND') {
            // This is a warning, not an error - custom levels might exist
            continue;
          }
        }
      } else if (levelValue && !validLevels.includes(levelValue)) {
        // This is a warning, not an error - custom levels might exist
        continue;
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates boolean operator usage
 */
function validateBooleanOperators(query: string): LogsValidationResult {
  // Enhanced validation for boolean operators supporting advanced patterns
  // Requirements 4.3: Support for AND, OR, NOT operators
  
  // Check for invalid operator sequences
  const invalidSequences = [
    /\b(AND|OR|NOT)\s+(AND|OR|NOT)\b/g,  // Double operators (except NOT followed by others)
    /^\s*(AND|OR)\b/,                     // Starting with AND/OR (NOT is allowed at start)
    /\b(AND|OR)\s*$/,                     // Ending with AND/OR
    /\bNOT\s+NOT\b/g,                     // Double NOT
  ];

  for (const pattern of invalidSequences) {
    const match = pattern.exec(query);
    if (match) {
      // Special case: NOT followed by AND/OR is valid (e.g., "NOT service:test AND status:ERROR")
      if (match[0].includes('NOT') && (match[0].includes('AND') || match[0].includes('OR'))) {
        const notAndOrPattern = /\bNOT\s+(AND|OR)\b/;
        if (notAndOrPattern.test(match[0])) {
          return {
            isValid: false,
            error: `Invalid operator sequence: "${match[0].trim()}". Use "NOT condition AND/OR" instead.`
          };
        }
      } else {
        return {
          isValid: false,
          error: `Invalid boolean operator usage: "${match[0].trim()}"`
        };
      }
    }
  }

  // Validate grouped expressions: status:(ERROR OR WARN)
  const groupedExpressions = query.match(/\w+:\s*\([^)]+\)/g);
  if (groupedExpressions) {
    for (const expr of groupedExpressions) {
      const groupContent = expr.match(/\(([^)]+)\)/)?.[1];
      if (groupContent) {
        // Validate boolean operators within groups
        const groupResult = validateBooleanOperators(groupContent);
        if (!groupResult.isValid) {
          return {
            isValid: false,
            error: `Invalid grouped expression "${expr}": ${groupResult.error}`
          };
        }
      }
    }
  }

  // Check for unmatched parentheses in boolean expressions
  const openParens = (query.match(/\(/g) || []).length;
  const closeParens = (query.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return {
      isValid: false,
      error: `Unmatched parentheses in boolean expression. Found ${openParens} opening and ${closeParens} closing parentheses.`
    };
  }

  return { isValid: true };
}

// Validates wildcard pattern syntax
// Implements Requirements 4.4 for wildcard pattern support
function validateWildcardPatterns(query: string): LogsValidationResult {
  // Check for invalid wildcard patterns
  const invalidPatterns = [
    /\*{2,}/g,                           // Multiple consecutive asterisks
    /^\*/,                               // Starting with asterisk (usually not useful)
    /\*\s+\*/g,                          // Asterisks separated by spaces
  ];

  for (const pattern of invalidPatterns) {
    const match = pattern.exec(query);
    if (match) {
      if (match[0].includes('**')) {
        return {
          isValid: false,
          error: `Invalid wildcard pattern: "${match[0]}". Use single asterisk (*) for wildcards.`
        };
      }
      if (match[0] === '*' && pattern.source === '^\\*') {
        // Starting with asterisk - this is a warning, not an error
        continue;
      }
      return {
        isValid: false,
        error: `Invalid wildcard pattern: "${match[0].trim()}"`
      };
    }
  }

  // Validate wildcard usage in facet filters
  const facetWildcards = query.match(/\w+:\s*[^:\s]*\*/g);
  if (facetWildcards) {
    for (const facetWildcard of facetWildcards) {
      // Check if wildcard is properly positioned (at the end of the value)
      const wildcardInMiddle = /\w+:\s*[^:\s]*\*[^:\s\)]+/;
      if (wildcardInMiddle.test(facetWildcard)) {
        return {
          isValid: false,
          error: `Invalid wildcard in facet filter: "${facetWildcard}". Wildcards should be at the end of the value.`
        };
      }
    }
  }

  return { isValid: true };
}

// Validates time range integration patterns
// Implements Requirements 4.5 for time range integration
function validateTimeRangeIntegration(query: string): LogsValidationResult {
  // Check for inline time filters that might conflict with Grafana's time picker
  const timeFilterPatterns = [
    /@timestamp:/i,
    /timestamp:/i,
    /\btime:/i,
    /\bdate:/i,
  ];

  const warnings: string[] = [];
  
  for (const pattern of timeFilterPatterns) {
    if (pattern.test(query)) {
      warnings.push(
        `Found inline time filter in query. Consider using Grafana's time range picker instead for better integration.`
      );
      break; // Only show this warning once
    }
  }

  // Check for relative time expressions
  const relativeTimePattern = /@timestamp:\s*[><]=?\s*now[-+]\w+/i;
  if (relativeTimePattern.test(query)) {
    warnings.push(
      `Relative time filters will be combined with Grafana's time range picker. Ensure this is intended.`
    );
  }

  return { 
    isValid: true, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
}

/**
 * Checks for common issues and provides warnings
 */
function checkForWarnings(query: string): string[] {
  const warnings: string[] = [];

  // Check for potentially inefficient wildcards
  if (query.includes('*') && !query.includes(':')) {
    warnings.push('Wildcard searches without facets may be slow. Consider using facets like service:* or source:*');
  }

  // Check for very broad searches
  if (query.length < 3 && !query.includes(':')) {
    warnings.push('Very short search terms may return too many results. Consider adding facets or longer terms.');
  }

  // Check for case sensitivity hints
  if (/\b(error|warn|info|debug)\b/.test(query.toLowerCase()) && !query.includes('status:')) {
    warnings.push('For log levels, consider using status:ERROR instead of searching for "error" in message text.');
  }

  return warnings;
}

/**
 * Provides suggestions for common query improvements
 */
export function getQuerySuggestions(query: string): string[] {
  const suggestions: string[] = [];

  if (!query || query.trim() === '') {
    return [
      'Try searching for specific terms like "error" or "timeout"',
      'Use facets to filter: service:web-app status:ERROR',
      'Combine conditions: service:api AND status:WARN'
    ];
  }

  const trimmedQuery = query.trim().toLowerCase();

  // Suggest facet usage for common terms
  if (trimmedQuery.includes('error') && !trimmedQuery.includes('status:')) {
    suggestions.push('Consider using status:ERROR for log level filtering');
  }

  if (trimmedQuery.includes('service') && !trimmedQuery.includes('service:')) {
    suggestions.push('Use service:name to filter by specific service');
  }

  if (trimmedQuery.includes('host') && !trimmedQuery.includes('host:')) {
    suggestions.push('Use host:hostname to filter by specific host');
  }

  // Suggest boolean operators for multiple terms
  if (trimmedQuery.split(' ').length > 1 && !/(and|or|not)/i.test(trimmedQuery)) {
    suggestions.push('Use AND, OR, NOT operators to combine search terms');
  }

  return suggestions;
}