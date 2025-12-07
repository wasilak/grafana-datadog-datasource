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
export function parseQuery(queryText: string, cursorPosition: number): QueryContext {
  if (!queryText) {
    return createEmptyContext(cursorPosition);
  }

  // Get the line containing the cursor
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
  } else {
    // For other contexts, use the standard token extraction
    currentToken = extractCurrentToken(lineContent, positionInLine);
  }

  // Extract metric name if in tag/tag_value context
  const metricName = extractMetricName(lineContent, positionInLine);

  // Extract existing tags from the query
  const existingTags = extractExistingTags(lineContent);

  return {
    cursorPosition,
    currentToken,
    contextType,
    metricName,
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
 * Detects the context type at the cursor position
 * Datadog query format: [aggregator:]metric{tag_key:tag_value,...} by aggregation
 *
 * Examples:
 * - "system.cpu" -> metric context
 * - "system.cpu.by_host{h" -> tag context
 * - "system.cpu.by_host{host:web-" -> tag_value context
 * - "system.cpu.by_host{} by av" -> aggregation context
 * - "a:system.cpu" -> aggregator context (when typing aggregator)
 */
function detectContextType(line: string, position: number): QueryContext['contextType'] {
  // Handle empty line
  if (!line.trim()) {
    return 'metric';
  }

  // Check for "by" keyword for aggregation context
  const byMatch = line.match(/\s+by\s+/);
  if (byMatch && position > byMatch.index! + byMatch[0].length - 1) {
    return 'aggregation';
  }

  // Check for curly braces for tag/tag_value context
  const openBrace = line.lastIndexOf('{', position);
  const closeBrace = line.indexOf('}', position);

  if (openBrace !== -1 && (closeBrace === -1 || position < closeBrace)) {
    // We're inside the tag section
    const tagSection = line.substring(openBrace + 1, position);

    // Check if we're in tag_value context (after ':')
    const colonInTagSection = tagSection.includes(':');
    if (colonInTagSection) {
      return 'tag_value';
    }

    return 'tag';
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
 * Metric name is the part before the first '{' or 'by'
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
  return metricPart ? metricPart : undefined;
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
