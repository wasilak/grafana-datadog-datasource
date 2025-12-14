import { QueryContext } from '../../types';

/**
 * Parses a Datadog query and detects the context at a given cursor position.
 * This function analyzes the query structure to determine whether the cursor is in a:
 * - metric context (metric name)
 * - aggregation context (avg, sum, etc.)
 * - tag context (tag key)
 * - tag_value context (tag value)
 * - other context (unknown position)
 *
 * @param queryText - The full query text
 * @param cursorPosition - The character position of the cursor
 * @returns QueryContext with detected context type and metadata
 */
/**
 * Pre-processes a query by interpolating variables for autocomplete context analysis.
 * This allows the parser to understand the structure even when variables are present.
 * @param queryText - The original query text with variables
 * @returns The query text with variables replaced by placeholder values for parsing
 */
function preprocessQueryForAutocomplete(queryText: string): string {
  if (!queryText) {
    return queryText;
  }

  // Replace formatted variables ${var:format} with placeholder values
  let processedQuery = queryText.replace(/\$\{([^}:]+):[^}]+\}/g, (match, varName) => {
    // Return a placeholder that maintains query structure
    // For metrics context, use a metric-like placeholder
    // For tag context, use a tag-like placeholder
    return `placeholder_${varName}`;
  });

  // Replace simple variables $var with placeholder values
  processedQuery = processedQuery.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
    // Handle built-in variables
    if (varName.startsWith('__')) {
      switch (varName) {
        case '__from':
        case '__to':
          return '1234567890'; // Timestamp placeholder
        default:
          return `builtin_${varName}`;
      }
    }
    return `placeholder_${varName}`;
  });

  return processedQuery;
}

export function parseQuery(queryText: string, cursorPosition: number): QueryContext {
  if (!queryText) {
    return createEmptyContext(cursorPosition);
  }

  // Pre-process the query to handle variables for better autocomplete context
  const processedQuery = preprocessQueryForAutocomplete(queryText);

  // Get the line containing the cursor
  const lines = processedQuery.split('\n');
  let charCount = 0;
  let cursorLine = 0;
  let positionInLine = cursorPosition;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (charCount + lineLength > cursorPosition) {
      cursorLine = i;
      positionInLine = cursorPosition - charCount;
      break;
    }
    charCount += lineLength;
  }

  const lineContent = lines[cursorLine] || '';

  // Determine context type by analyzing the line structure
  const contextType = detectContextType(lineContent, positionInLine);

  // Extract the current token at cursor position based on context
  let currentToken = '';
  if (contextType === 'aggregator') {
    // For aggregator context, extract text from the beginning up to position, stopping at colon
    const colonIndex = lineContent.indexOf(':');
    const end = colonIndex !== -1 && positionInLine > colonIndex ? colonIndex : positionInLine;
    let start = 0;
    // Find the start of the aggregator word (stop at non-alphanumeric characters)
    while (start < end && !/[a-zA-Z_]/.test(lineContent[start])) {
      start++;
    }
    currentToken = lineContent.substring(start, end);
  } else if (contextType === 'grouping_tag') {
    // For grouping_tag context, extract token between commas or braces
    currentToken = extractGroupingTagToken(lineContent, positionInLine);
  } else if (contextType === 'filter_tag_key') {
    // For filter_tag_key context, extract token between commas, braces, or colons
    currentToken = extractFilterTagKeyToken(lineContent, positionInLine);
  } else if (contextType === 'filter_tag_value') {
    // For filter_tag_value context, extract the partial value being typed
    currentToken = extractFilterTagValueToken(lineContent, positionInLine);
  } else {
    // For other contexts, use the standard token extraction
    currentToken = extractCurrentToken(lineContent, positionInLine);
  }

  // Extract metric name if in tag/tag_value context (use processed query for better parsing)
  const metricName = extractMetricName(lineContent, positionInLine);

  // Extract tag key if in filter_tag_value context
  const tagKey = contextType === 'filter_tag_value' ? extractFilterTagKey(lineContent, positionInLine) : undefined;

  // Extract existing tags from the query
  const existingTags = extractExistingTags(lineContent);

  return {
    cursorPosition,
    currentToken,
    contextType,
    metricName,
    tagKey,
    existingTags,
    lineContent,
  };
}

/**
 * Creates an empty context for empty queries
 */
function createEmptyContext(cursorPosition: number): QueryContext {
  return {
    cursorPosition,
    currentToken: '',
    contextType: 'metric',
    existingTags: new Set(),
    lineContent: '',
  };
}

/**
 * Extracts the current token (word) at the cursor position
 */
function extractCurrentToken(line: string, position: number): string {
  // Find word boundaries
  let start = position;
  let end = position;

  // Move start backwards to find beginning of token
  while (start > 0 && /\S/.test(line[start - 1]) && line[start - 1] !== ':') {
    start--;
  }

  // Move end forwards to find end of token
  while (end < line.length && /\S/.test(line[end]) && line[end] !== '{' && line[end] !== ' ') {
    end++;
  }

  return line.substring(start, end);
}

/**
 * Extracts the current token for grouping tag context (inside "by {}")
 * Tokens are separated by commas or braces
 */
function extractGroupingTagToken(line: string, position: number): string {
  // Find the "by {" opening brace
  const byMatch = line.match(/\s+by\s+\{/);
  if (!byMatch) {
    return '';
  }

  const openBracePos = byMatch.index! + byMatch[0].length - 1;
  const closeBracePos = line.indexOf('}', openBracePos);

  // Extract the section between braces
  const endPos = closeBracePos === -1 ? line.length : closeBracePos;
  const groupingSection = line.substring(openBracePos + 1, endPos);

  // Find position relative to the grouping section
  const relativePos = position - (openBracePos + 1);

  if (relativePos < 0 || relativePos > groupingSection.length) {
    return '';
  }

  // Check if cursor is right after a comma or opening brace - if so, we're starting a new tag
  const charBeforeCursor = relativePos > 0 ? groupingSection[relativePos - 1] : null;
  
  console.log('extractGroupingTagToken:', {
    groupingSection,
    relativePos,
    charBeforeCursor,
    isAfterComma: charBeforeCursor === ',',
  });
  
  if (relativePos === 0) {
    return ''; // At the very beginning (right after opening brace)
  }
  
  // Find the current token by looking for comma boundaries
  let start = relativePos;
  let end = relativePos;

  // Move backwards to find start (stop at comma or beginning)
  while (start > 0 && groupingSection[start - 1] !== ',') {
    start--;
  }

  // Move forwards to find end (stop at comma or end)
  while (end < groupingSection.length && groupingSection[end] !== ',') {
    end++;
  }

  const token = groupingSection.substring(start, end).trim();
  
  // If the token is empty or cursor is right after a comma, return empty string
  if (!token || charBeforeCursor === ',') {
    return '';
  }
  
  return token;
}

/**
 * Extracts the current token for filter tag key context (inside "{}" after metric name)
 * Tokens are separated by trigger characters: '{', ' ', '(', ','
 */
function extractFilterTagKeyToken(line: string, position: number): string {
  // Find the filter section opening brace (first { in the line)
  const openBracePos = line.indexOf('{');
  if (openBracePos === -1) {
    return '';
  }

  // Check if cursor is right after a trigger character
  const charBeforeCursor = position > openBracePos + 1 ? line[position - 1] : '{';
  const isAfterTriggerChar = charBeforeCursor === '{' || charBeforeCursor === ' ' || charBeforeCursor === '(' || charBeforeCursor === ',';
  
  if (isAfterTriggerChar) {
    return ''; // Starting a new tag key
  }

  // Find the current token by looking backwards to the last trigger character
  let tokenStart = position - 1;
  while (tokenStart > openBracePos && line[tokenStart] !== '{' && line[tokenStart] !== ' ' && line[tokenStart] !== '(' && line[tokenStart] !== ',') {
    tokenStart--;
  }
  
  const token = line.substring(tokenStart + 1, position).trim();
  
  // If token contains a colon, only return the part before the colon (the key part)
  const colonIndex = token.indexOf(':');
  if (colonIndex !== -1) {
    return token.substring(0, colonIndex).trim();
  }
  
  return token;
}

/**
 * Detects the context type at the cursor position
 * Datadog query format: [aggregator:]metric{tag_key:tag_value,...} by {grouping_tag1,grouping_tag2}
 *
 * Examples:
 * - "system.cpu" -> metric context
 * - "system.cpu.by_host{h" -> filter_tag_key context
 * - "system.cpu.by_host{host:web-" -> tag_value context
 * - "system.cpu.by_host{} by {" -> grouping_tag context
 * - "system.cpu.by_host{} by {host," -> grouping_tag context
 * - "a:system.cpu" -> aggregator context (when typing aggregator)
 */
function detectContextType(line: string, position: number): QueryContext['contextType'] {
  // Handle empty line
  if (!line.trim()) {
    return 'metric';
  }

  // Check for "by {" pattern for grouping tag context
  const byMatch = line.match(/\s+by\s+\{/);
  if (byMatch) {
    const byBraceStart = byMatch.index! + byMatch[0].length - 1; // Position of '{'
    // Find the closing brace after "by {"
    const closeBraceAfterBy = line.indexOf('}', byBraceStart);
    
    console.log('detectContextType - by { check:', {
      line,
      position,
      byMatch: byMatch[0],
      byMatchIndex: byMatch.index,
      byBraceStart,
      closeBraceAfterBy,
      isInGrouping: position > byBraceStart && (closeBraceAfterBy === -1 || position <= closeBraceAfterBy),
    });
    
    // If cursor is between "by {" and "}" (or no closing brace yet)
    // Include position at closing brace to handle cursor right at }
    if (position > byBraceStart && (closeBraceAfterBy === -1 || position <= closeBraceAfterBy)) {
      return 'grouping_tag';
    }
  }

  // Check for curly braces for tag/tag_value context (filter section)
  const openBrace = line.lastIndexOf('{', position);
  const closeBrace = line.indexOf('}', position);

  console.log('detectContextType - brace check:', {
    line,
    position,
    openBrace,
    closeBrace,
    isInsideBraces: openBrace !== -1 && (closeBrace === -1 || position <= closeBrace),
  });

  if (openBrace !== -1 && (closeBrace === -1 || position <= closeBrace)) {
    // Make sure this isn't the "by {" brace
    const textBeforeBrace = line.substring(0, openBrace).trim();
    if (textBeforeBrace.endsWith(' by')) {
      // This is the grouping brace, not the filter brace
      return 'grouping_tag';
    }
    
    // We're inside the filter tag section
    // Check if cursor is right after trigger characters
    const charBeforeCursor = position > openBrace + 1 ? line[position - 1] : '{';
    
    // Special case: after '(' we want tag VALUE autocomplete (for IN operator)
    if (charBeforeCursor === '(') {
      return 'filter_tag_value';
    }
    
    // Check if we're inside parentheses (for IN operator)
    const filterContent = line.substring(openBrace + 1, position);
    const lastOpenParen = filterContent.lastIndexOf('(');
    const lastCloseParen = filterContent.lastIndexOf(')');
    const isInsideParens = lastOpenParen !== -1 && (lastCloseParen === -1 || lastOpenParen > lastCloseParen);
    
    // If we're inside parentheses and after a comma, we want tag VALUE autocomplete
    if (isInsideParens && charBeforeCursor === ',') {
      return 'filter_tag_value';
    }
    
    // After '{', ' ', ',' (but not inside parens) we want tag KEY autocomplete
    const isAfterKeyTriggerChar = charBeforeCursor === '{' || charBeforeCursor === ' ' || (charBeforeCursor === ',' && !isInsideParens);
    
    if (isAfterKeyTriggerChar) {
      return 'filter_tag_key';
    }

    // Check if we're in filter_tag_value context (after ':' and not after trigger chars)
    // Find the current token by looking backwards to the last trigger character
    let tokenStart = position - 1;
    while (tokenStart > openBrace && line[tokenStart] !== '{' && line[tokenStart] !== ' ' && line[tokenStart] !== '(' && line[tokenStart] !== ',') {
      tokenStart--;
    }
    
    const currentToken = line.substring(tokenStart + 1, position);
    const colonInToken = currentToken.includes(':');
    
    if (colonInToken) {
      const colonPos = currentToken.indexOf(':');
      const cursorPosInToken = position - tokenStart - 1;
      
      if (cursorPosInToken > colonPos) {
        return 'filter_tag_value';
      }
    }

    // Default to filter tag key context
    return 'filter_tag_key';
  }

  // Check for aggregator context: if there's a colon after an identifier before the first space or brace
  // Pattern: [aggregator:]metric, e.g. "avg:system.cpu"
  const colonIndex = line.indexOf(':');
  if (colonIndex !== -1 && position <= colonIndex) {
    // Cursor is before or at the colon, so we're in aggregator context
    return 'aggregator';
  }

  // Default to metric context
  return 'metric';
}

/**
 * Extracts the metric name from the query
 * Metric name is the part before the first '{' or 'by', without the aggregator prefix
 * Example: "sum:datadog.apis.usage.per_user{*}" -> "datadog.apis.usage.per_user"
 */
function extractMetricName(line: string, position: number): string | undefined {
  // Find the opening brace
  const braceIndex = line.indexOf('{');
  const byIndex = line.search(/\s+by\s+/);

  let metricEndIndex = line.length;
  if (braceIndex !== -1) {
    metricEndIndex = Math.min(metricEndIndex, braceIndex);
  }
  if (byIndex !== -1) {
    metricEndIndex = Math.min(metricEndIndex, byIndex);
  }

  const metricPart = line.substring(0, metricEndIndex).trim();
  
  if (!metricPart) {
    return undefined;
  }
  
  // Strip aggregator prefix if present (e.g., "sum:", "avg:", "max:")
  // Datadog format: [aggregator:]metric_name
  const colonIndex = metricPart.indexOf(':');
  if (colonIndex !== -1) {
    // Return the part after the colon (the actual metric name)
    return metricPart.substring(colonIndex + 1).trim();
  }
  
  return metricPart;
}

/**
 * Extracts all existing tags from the query
 * Tags are in format: {tag1:val1, tag2:val2}
 */
function extractExistingTags(line: string): Set<string> {
  const tags = new Set<string>();

  // Find tag section between { and }
  const openBrace = line.indexOf('{');
  const closeBrace = line.indexOf('}');

  if (openBrace === -1 || closeBrace === -1 || openBrace >= closeBrace) {
    return tags;
  }

  const tagSection = line.substring(openBrace + 1, closeBrace);

  // Split by comma and extract tag keys
  const tagPairs = tagSection.split(',').map(t => t.trim());
  for (const pair of tagPairs) {
    const colonIndex = pair.indexOf(':');
    if (colonIndex !== -1) {
      const tagKey = pair.substring(0, colonIndex).trim();
      if (tagKey) {
        tags.add(tagKey);
      }
    } else if (pair) {
      // Incomplete tag without colon
      tags.add(pair);
    }
  }

  return tags;
}

/**
 * Extract the filter tag key for filter_tag_value context
 * This is used when the cursor is after ':' or after '(' (for IN operator)
 */
function extractFilterTagKey(lineContent: string, cursorPosition: number): string | undefined {
  // Find the filter section opening brace (first { in the line)
  const openBracePos = lineContent.indexOf('{');
  if (openBracePos === -1) {
    return undefined;
  }

  const charBeforeCursor = cursorPosition > openBracePos + 1 ? lineContent[cursorPosition - 1] : '';
  
  // Check if we're inside parentheses (for IN operator)
  const filterContent = lineContent.substring(openBracePos + 1, cursorPosition);
  const lastOpenParen = filterContent.lastIndexOf('(');
  const lastCloseParen = filterContent.lastIndexOf(')');
  const isInsideParens = lastOpenParen !== -1 && (lastCloseParen === -1 || lastOpenParen > lastCloseParen);
  
  // Special case: cursor after '(' or after ',' inside parentheses - find tag key before "IN ("
  if (charBeforeCursor === '(' || (isInsideParens && charBeforeCursor === ',')) {
    // Look backwards for "IN (" pattern
    const beforeParen = lineContent.substring(openBracePos + 1, openBracePos + 1 + lastOpenParen).trim();
    const inMatch = beforeParen.match(/(\w+)\s+IN\s*$/);
    if (inMatch) {
      return inMatch[1]; // Return the tag key before "IN"
    }
    return undefined;
  }

  // Regular case: cursor after ':' - find current token
  let tokenStart = cursorPosition - 1;
  while (tokenStart > openBracePos && lineContent[tokenStart] !== '{' && lineContent[tokenStart] !== ' ' && lineContent[tokenStart] !== '(' && lineContent[tokenStart] !== ',') {
    tokenStart--;
  }
  
  const currentToken = lineContent.substring(tokenStart + 1, cursorPosition);
  
  // Find the colon in the current token
  const colonIndex = currentToken.indexOf(':');
  if (colonIndex === -1) {
    return undefined;
  }
  
  // Extract the tag key (before the colon)
  const tagKey = currentToken.substring(0, colonIndex).trim();
  return tagKey || undefined;
}

/**
 * Extracts the current token for filter tag value context (after ':' or after '(' for IN operator)
 * Tokens are separated by trigger characters and colons
 */
function extractFilterTagValueToken(line: string, position: number): string {
  // Find the filter section opening brace (first { in the line)
  const openBracePos = line.indexOf('{');
  if (openBracePos === -1) {
    return '';
  }

  const charBeforeCursor = position > openBracePos + 1 ? line[position - 1] : '';
  
  // Check if we're inside parentheses (for IN operator)
  const filterContent = line.substring(openBracePos + 1, position);
  const lastOpenParen = filterContent.lastIndexOf('(');
  const lastCloseParen = filterContent.lastIndexOf(')');
  const isInsideParens = lastOpenParen !== -1 && (lastCloseParen === -1 || lastOpenParen > lastCloseParen);
  
  // Special case: cursor after '(' or after ',' inside parentheses - we're starting to type a value in IN clause
  if (charBeforeCursor === '(' || (isInsideParens && charBeforeCursor === ',')) {
    return ''; // Empty token, starting fresh
  }

  // If we're inside parentheses, find the current value token (separated by commas)
  if (isInsideParens) {
    const parenContent = filterContent.substring(lastOpenParen + 1);
    const relativePos = parenContent.length;
    
    // Find the start of the current value (after last comma or start of parentheses)
    let valueStart = relativePos;
    while (valueStart > 0 && parenContent[valueStart - 1] !== ',') {
      valueStart--;
    }
    
    return parenContent.substring(valueStart, relativePos).trim();
  }

  // Regular case: find the current token by looking backwards to the last trigger character
  let tokenStart = position - 1;
  while (tokenStart > openBracePos && line[tokenStart] !== '{' && line[tokenStart] !== ' ' && line[tokenStart] !== '(' && line[tokenStart] !== ',') {
    tokenStart--;
  }
  
  const currentToken = line.substring(tokenStart + 1, position);
  
  // Find the colon in the current token
  const colonIndex = currentToken.indexOf(':');
  if (colonIndex === -1) {
    return '';
  }
  
  // Extract the value part (after the colon)
  const value = currentToken.substring(colonIndex + 1).trim();
  
  return value;
}

/**
 * Parse logs query to determine context for autocomplete suggestions
 * Handles Datadog logs search syntax: service:web-app status:ERROR "error message" AND/OR/NOT
 */
export function parseLogsQuery(queryText: string, cursorPosition: number): QueryContext {
  if (!queryText) {
    return {
      contextType: 'logs_search',
      currentToken: '',
      existingTags: new Set(),
      lineContent: '',
      cursorPosition,
    };
  }

  // Get the line containing the cursor (logs queries are typically single-line)
  const lines = queryText.split('\n');
  let charCount = 0;
  let cursorLine = 0;
  let positionInLine = cursorPosition;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (charCount + lineLength > cursorPosition) {
      cursorLine = i;
      positionInLine = cursorPosition - charCount;
      break;
    }
    charCount += lineLength;
  }

  const lineContent = lines[cursorLine] || '';

  // Detect logs-specific context
  const contextType = detectLogsContextType(lineContent, positionInLine);
  
  // Extract current token based on context
  const currentToken = extractLogsCurrentToken(lineContent, positionInLine, contextType);

  return {
    contextType,
    currentToken,
    existingTags: new Set(), // Not used for logs queries
    lineContent,
    cursorPosition,
  };
}

/**
 * Detect context type for logs queries
 */
function detectLogsContextType(line: string, position: number): QueryContext['contextType'] {
  // Handle empty line
  if (!line.trim()) {
    return 'logs_search';
  }

  // Check if cursor is after a facet name followed by colon
  // Look backwards from cursor position to find facet patterns
  const beforeCursor = line.substring(0, position);
  
  // Check for service: pattern (enhanced to handle boolean operators and wildcards)
  const serviceMatch = beforeCursor.match(/\bservice:\s*([^:\s\)]*\*?|[^:\s\)]*\s+(AND|OR)\s+[^:\s\)]*\*?)$/);
  if (serviceMatch) {
    return 'logs_service';
  }

  // Check for source: pattern (enhanced to handle boolean operators and wildcards)
  const sourceMatch = beforeCursor.match(/\bsource:\s*([^:\s\)]*\*?|[^:\s\)]*\s+(AND|OR)\s+[^:\s\)]*\*?)$/);
  if (sourceMatch) {
    return 'logs_source';
  }

  // Check for status: or level: pattern (enhanced to handle boolean operators and wildcards)
  const levelMatch = beforeCursor.match(/\b(status|level):\s*(\([^)]*\)|[^:\s\)]*\*?)$/);
  if (levelMatch) {
    return 'logs_level';
  }

  // Check for host: pattern (enhanced to handle boolean operators and wildcards)
  const hostMatch = beforeCursor.match(/\bhost:\s*([^:\s\)]*\*?|[^:\s\)]*\s+(AND|OR)\s+[^:\s\)]*\*?)$/);
  if (hostMatch) {
    return 'logs_host';
  }

  // Check for env: pattern (enhanced to handle boolean operators and wildcards)
  const envMatch = beforeCursor.match(/\benv:\s*([^:\s\)]*\*?|[^:\s\)]*\s+(AND|OR)\s+[^:\s\)]*\*?)$/);
  if (envMatch) {
    return 'logs_env';
  }

  // Check for grouped facet patterns like status:(ERROR OR WARN)
  const groupedFacetMatch = beforeCursor.match(/\b(service|source|status|level|host|env|version):\s*\([^)]*$/);
  if (groupedFacetMatch) {
    const facetName = groupedFacetMatch[1];
    switch (facetName) {
      case 'service':
        return 'logs_service';
      case 'source':
        return 'logs_source';
      case 'status':
      case 'level':
        return 'logs_level';
      case 'host':
        return 'logs_host';
      case 'env':
        return 'logs_env';
      default:
        return 'logs_facet';
    }
  }

  // Check if we're typing after a boolean operator
  const booleanOperatorMatch = beforeCursor.match(/\b(AND|OR|NOT)\s+([a-zA-Z_][a-zA-Z0-9_]*:?)?$/);
  if (booleanOperatorMatch) {
    // If there's a facet name after the operator, determine the context
    const facetName = booleanOperatorMatch[2];
    if (facetName && facetName.endsWith(':')) {
      const cleanFacetName = facetName.slice(0, -1);
      if (['service', 'source', 'status', 'level', 'host', 'env', 'version'].includes(cleanFacetName)) {
        return 'logs_facet';
      }
    }
    return 'logs_search';
  }

  // Check if we're typing a facet name (word followed by colon)
  const facetMatch = beforeCursor.match(/\b([a-zA-Z_][a-zA-Z0-9_]*):?$/);
  if (facetMatch && beforeCursor.endsWith(':')) {
    const facetName = facetMatch[1];
    if (['service', 'source', 'status', 'level', 'host', 'env', 'version'].includes(facetName)) {
      return 'logs_facet';
    }
  }

  // Check for wildcard patterns in search terms
  const wildcardMatch = beforeCursor.match(/\b\w+\*$/);
  if (wildcardMatch) {
    return 'logs_search';
  }

  // Default to general logs search context
  return 'logs_search';
}

/**
 * Extract current token for logs queries
 */
function extractLogsCurrentToken(line: string, position: number, contextType: QueryContext['contextType']): string {
  if (position === 0) {
    return '';
  }

  // For logs queries, tokens are typically separated by spaces, colons, or operators
  const beforeCursor = line.substring(0, position);
  
  // Different extraction logic based on context
  switch (contextType) {
    case 'logs_service':
    case 'logs_source':
    case 'logs_level':
    case 'logs_host':
    case 'logs_env':
      // Extract token after the colon
      const colonMatch = beforeCursor.match(/:\s*([^:\s]*)$/);
      return colonMatch ? colonMatch[1] : '';
      
    case 'logs_facet':
      // Extract the facet name being typed
      const facetMatch = beforeCursor.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)$/);
      return facetMatch ? facetMatch[1] : '';
      
    default:
      // General token extraction - get the word at cursor position
      let start = position - 1;
      while (start >= 0 && /[a-zA-Z0-9_.-]/.test(line[start])) {
        start--;
      }
      start++; // Move to first character of token
      
      let end = position;
      while (end < line.length && /[a-zA-Z0-9_.-]/.test(line[end])) {
        end++;
      }
      
      return line.substring(start, end);
  }
}