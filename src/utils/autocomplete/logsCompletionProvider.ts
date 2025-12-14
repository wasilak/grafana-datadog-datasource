import { CompletionItem, QueryContext } from '../../types';

/**
 * Context-aware completion provider for Datadog logs queries
 * Inspired by OpenSearch's PPLCompletionItemProvider pattern
 * Provides intelligent suggestions based on cursor position and query structure
 */
export class LogsCompletionItemProvider {
  private services: string[];
  private sources: string[];
  private logLevels: string[];
  private facetNames: string[];
  private operators: string[];

  constructor() {
    // Initialize with logical operators (these are static and don't come from backend)
    this.operators = ['AND', 'OR', 'NOT'];
    
    // Initialize empty arrays for all backend-driven data
    this.services = [];
    this.sources = [];
    this.logLevels = [];
    this.facetNames = [];
  }

  /**
   * Update services data from backend
   */
  updateServices(services: string[]): void {
    this.services = services;
  }

  /**
   * Update sources data from backend
   */
  updateSources(sources: string[]): void {
    this.sources = sources;
  }

  /**
   * Update log levels data from backend
   */
  updateLevels(levels: string[]): void {
    this.logLevels = levels;
  }

  /**
   * Update facet fields data from backend
   */
  updateFields(fields: string[]): void {
    this.facetNames = fields;
  }

  /**
   * Get completion items based on query context and cursor position
   * Implements context-aware suggestion logic similar to OpenSearch's approach
   */
  getCompletionItems(context: QueryContext): CompletionItem[] {
    const suggestions: CompletionItem[] = [];

    // Analyze cursor position and context to provide relevant suggestions
    switch (context.contextType) {
      case 'logs_search':
        suggestions.push(...this.getSearchContextSuggestions(context));
        break;
      case 'logs_facet':
        suggestions.push(...this.getFacetNameSuggestions(context));
        break;
      case 'logs_service':
        suggestions.push(...this.getServiceSuggestions(context));
        break;
      case 'logs_source':
        suggestions.push(...this.getSourceSuggestions(context));
        break;
      case 'logs_level':
        suggestions.push(...this.getLevelSuggestions(context));
        break;
      default:
        suggestions.push(...this.getDefaultSuggestions(context));
        break;
    }

    return this.filterAndSortSuggestions(suggestions, context.currentToken);
  }

  /**
   * Get suggestions for general search context
   * Provides facets, operators, and search patterns
   */
  private getSearchContextSuggestions(context: QueryContext): CompletionItem[] {
    const suggestions: CompletionItem[] = [];

    // Add facet suggestions
    suggestions.push(...this.getFacetNameSuggestions(context));

    // Add operator suggestions if appropriate
    if (this.shouldSuggestOperators(context)) {
      suggestions.push(...this.getOperatorSuggestions(context));
    }

    // Add search pattern suggestions
    suggestions.push(...this.getSearchPatternSuggestions(context));

    return suggestions;
  }

  /**
   * Get facet name suggestions with descriptions
   */
  private getFacetNameSuggestions(context: QueryContext): CompletionItem[] {
    const facetDescriptions: Record<string, string> = {
      'service': 'Filter by service name (e.g., service:web-app)',
      'source': 'Filter by log source (e.g., source:nginx)',
      'status': 'Filter by log level (e.g., status:ERROR)',
      'level': 'Filter by log level (e.g., level:WARN)',
      'host': 'Filter by hostname (e.g., host:web-01)',
      'env': 'Filter by environment (e.g., env:production)',
      'version': 'Filter by application version (e.g., version:1.2.3)',
      '@timestamp': 'Filter by timestamp range',
      '@message': 'Filter by message content',
      '@severity': 'Filter by severity level',
      '@source_category': 'Filter by source category'
    };

    return this.facetNames.map(facet => ({
      label: `${facet}:`,
      kind: 'logs_facet' as const,
      detail: facetDescriptions[facet] || `Filter by ${facet}`,
      insertText: `${facet}:`,
      sortText: `1_${facet}`, // Sort facets first
      documentation: `Facet filter: ${facet}`
    }));
  }

  /**
   * Get service name suggestions
   */
  private getServiceSuggestions(context: QueryContext): CompletionItem[] {
    return this.services.map(service => ({
      label: service,
      kind: 'logs_service' as const,
      detail: `Service: ${service}`,
      insertText: service,
      sortText: `2_${service}`,
      documentation: `Filter logs from service: ${service}`
    }));
  }

  /**
   * Get source name suggestions
   */
  private getSourceSuggestions(context: QueryContext): CompletionItem[] {
    return this.sources.map(source => ({
      label: source,
      kind: 'logs_source' as const,
      detail: `Source: ${source}`,
      insertText: source,
      sortText: `2_${source}`,
      documentation: `Filter logs from source: ${source}`
    }));
  }

  /**
   * Get log level suggestions with combinations
   */
  private getLevelSuggestions(context: QueryContext): CompletionItem[] {
    const suggestions: CompletionItem[] = [];

    // Add individual log levels
    suggestions.push(...this.logLevels.map(level => ({
      label: level,
      kind: 'logs_level' as const,
      detail: `${level} level logs`,
      insertText: level,
      sortText: `2_${level}`,
      documentation: `Filter ${level.toLowerCase()} level logs`
    })));

    // Add common level combinations if not already in grouped context
    if (!context.lineContent.includes('(')) {
      const combinations = [
        { name: '(ERROR OR WARN)', description: 'Error or warning logs' },
        { name: '(ERROR OR WARN OR FATAL)', description: 'Error, warning, or fatal logs' },
        { name: '(INFO OR DEBUG)', description: 'Info or debug logs' }
      ];

      suggestions.push(...combinations.map(combo => ({
        label: combo.name,
        kind: 'logs_level' as const,
        detail: combo.description,
        insertText: combo.name,
        sortText: `3_${combo.name}`,
        documentation: combo.description
      })));
    }

    return suggestions;
  }

  /**
   * Get operator suggestions (AND, OR, NOT)
   */
  private getOperatorSuggestions(context: QueryContext): CompletionItem[] {
    const operatorDescriptions: Record<string, string> = {
      'AND': 'Logical AND - both conditions must be true',
      'OR': 'Logical OR - either condition can be true',
      'NOT': 'Logical NOT - excludes matching logs'
    };

    return this.operators.map(operator => ({
      label: operator,
      kind: 'logs_operator' as const,
      detail: operatorDescriptions[operator],
      insertText: ` ${operator} `,
      sortText: `4_${operator}`,
      documentation: operatorDescriptions[operator]
    }));
  }

  /**
   * Get search pattern suggestions (wildcards, quotes, etc.)
   */
  private getSearchPatternSuggestions(context: QueryContext): CompletionItem[] {
    const patterns: CompletionItem[] = [];

    // Add wildcard suggestion if not already present
    if (!context.currentToken.includes('*')) {
      patterns.push({
        label: '*',
        kind: 'logs_operator' as const,
        detail: 'Wildcard - matches any characters',
        insertText: '*',
        sortText: '5_wildcard',
        documentation: 'Wildcard pattern (e.g., error* matches error, errors, errorCode)'
      });
    }

    // Add exact phrase suggestion
    patterns.push({
      label: '"exact phrase"',
      kind: 'logs_operator' as const,
      detail: 'Exact phrase search',
      insertText: '""',
      sortText: '5_phrase',
      documentation: 'Search for exact phrase - matches the exact text'
    });

    // Add exclusion suggestion
    patterns.push({
      label: '-excluded',
      kind: 'logs_operator' as const,
      detail: 'Exclude term',
      insertText: '-',
      sortText: '5_exclude',
      documentation: 'Exclude term - logs that do not contain the specified text'
    });

    return patterns;
  }

  /**
   * Get default suggestions when context is unclear
   */
  private getDefaultSuggestions(context: QueryContext): CompletionItem[] {
    const suggestions: CompletionItem[] = [];

    // Add most common facets
    suggestions.push(...this.getFacetNameSuggestions(context).slice(0, 5));

    // Add operators if appropriate
    if (this.shouldSuggestOperators(context)) {
      suggestions.push(...this.getOperatorSuggestions(context));
    }

    return suggestions;
  }

  /**
   * Determine if operators should be suggested based on context
   */
  private shouldSuggestOperators(context: QueryContext): boolean {
    // Don't suggest operators if we're at the beginning of the query
    if (context.lineContent.trim().length === 0) {
      return false;
    }

    // Don't suggest operators if we're immediately after another operator
    const beforeCursor = context.lineContent.substring(0, context.cursorPosition).trim();
    const endsWithOperator = /\b(AND|OR|NOT)\s*$/.test(beforeCursor);
    
    return !endsWithOperator;
  }

  /**
   * Filter suggestions based on current token and sort by relevance
   */
  private filterAndSortSuggestions(suggestions: CompletionItem[], currentToken: string): CompletionItem[] {
    const token = currentToken.toLowerCase();

    return suggestions
      .filter(suggestion => {
        // If no token, show all suggestions
        if (!token) {
          return true;
        }

        // Check if suggestion matches the current token
        return suggestion.label.toLowerCase().includes(token) ||
               (suggestion.insertText && suggestion.insertText.toLowerCase().includes(token));
      })
      .sort((a, b) => {
        // Sort by sortText first (category priority)
        if (a.sortText && b.sortText) {
          const sortComparison = a.sortText.localeCompare(b.sortText);
          if (sortComparison !== 0) {
            return sortComparison;
          }
        }

        // Then sort by relevance to current token
        if (token) {
          const aStartsWith = a.label.toLowerCase().startsWith(token);
          const bStartsWith = b.label.toLowerCase().startsWith(token);
          
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
        }

        // Finally sort alphabetically
        return a.label.localeCompare(b.label);
      })
      .slice(0, 100); // Limit to 100 suggestions
  }

  /**
   * Analyze cursor position within the query for advanced context detection
   * Similar to OpenSearch's cursor position analysis
   */
  analyzeCursorPosition(queryText: string, cursorPosition: number): {
    isInQuotes: boolean;
    isInParentheses: boolean;
    isAfterOperator: boolean;
    isAfterFacet: boolean;
    nearestFacet?: string;
  } {
    const beforeCursor = queryText.substring(0, cursorPosition);
    
    // Check if cursor is inside quotes
    const quoteCount = (beforeCursor.match(/"/g) || []).length;
    const isInQuotes = quoteCount % 2 === 1;

    // Check if cursor is inside parentheses
    const openParens = (beforeCursor.match(/\(/g) || []).length;
    const closeParens = (beforeCursor.match(/\)/g) || []).length;
    const isInParentheses = openParens > closeParens;

    // Check if cursor is after an operator
    const isAfterOperator = /\b(AND|OR|NOT)\s*$/.test(beforeCursor.trim());

    // Check if cursor is after a facet (facet:)
    const facetMatch = beforeCursor.match(/\b(\w+):\s*$/);
    const isAfterFacet = !!facetMatch;
    const nearestFacet = facetMatch ? facetMatch[1] : undefined;

    return {
      isInQuotes,
      isInParentheses,
      isAfterOperator,
      isAfterFacet,
      nearestFacet
    };
  }

  /**
   * Get context-specific suggestions based on cursor analysis
   */
  getContextSpecificSuggestions(
    queryText: string, 
    cursorPosition: number,
    context: QueryContext
  ): CompletionItem[] {
    const cursorAnalysis = this.analyzeCursorPosition(queryText, cursorPosition);
    
    // If in quotes, suggest text completion patterns
    if (cursorAnalysis.isInQuotes) {
      return this.getQuotedTextSuggestions(context);
    }

    // If in parentheses, suggest values for the current facet
    if (cursorAnalysis.isInParentheses && cursorAnalysis.nearestFacet) {
      return this.getParenthesesValueSuggestions(cursorAnalysis.nearestFacet, context);
    }

    // If after operator, suggest facets and search terms
    if (cursorAnalysis.isAfterOperator) {
      return this.getPostOperatorSuggestions(context);
    }

    // If after facet, suggest values for that facet
    if (cursorAnalysis.isAfterFacet && cursorAnalysis.nearestFacet) {
      return this.getFacetValueSuggestions(cursorAnalysis.nearestFacet, context);
    }

    // Default to general suggestions
    return this.getCompletionItems(context);
  }

  /**
   * Get suggestions for text inside quotes
   */
  private getQuotedTextSuggestions(context: QueryContext): CompletionItem[] {
    // TODO: Implement backend-driven text pattern suggestions
    // For now, return empty array until actual API integration is implemented
    return [];
  }

  /**
   * Get suggestions for values inside parentheses
   */
  private getParenthesesValueSuggestions(facet: string, context: QueryContext): CompletionItem[] {
    switch (facet.toLowerCase()) {
      case 'service':
        return this.getServiceSuggestions(context);
      case 'source':
        return this.getSourceSuggestions(context);
      case 'status':
      case 'level':
        return this.getLevelSuggestions(context);
      default:
        return this.getOperatorSuggestions(context);
    }
  }

  /**
   * Get suggestions after logical operators
   */
  private getPostOperatorSuggestions(context: QueryContext): CompletionItem[] {
    // After operators, suggest facets and search terms
    return [
      ...this.getFacetNameSuggestions(context).slice(0, 5),
      ...this.getSearchPatternSuggestions(context)
    ];
  }

  /**
   * Get value suggestions for a specific facet
   */
  private getFacetValueSuggestions(facet: string, context: QueryContext): CompletionItem[] {
    switch (facet.toLowerCase()) {
      case 'service':
        return this.getServiceSuggestions(context);
      case 'source':
        return this.getSourceSuggestions(context);
      case 'status':
      case 'level':
        return this.getLevelSuggestions(context);
      case 'host':
        return this.getHostSuggestions(context);
      case 'env':
        return this.getEnvironmentSuggestions(context);
      default:
        return [];
    }
  }

  /**
   * Get host suggestions (would be populated from backend)
   */
  private getHostSuggestions(context: QueryContext): CompletionItem[] {
    // TODO: Implement backend endpoint for host suggestions
    // For now, return empty array until actual API integration is implemented
    return [];
  }

  /**
   * Get environment suggestions
   */
  private getEnvironmentSuggestions(context: QueryContext): CompletionItem[] {
    // TODO: Implement backend endpoint for environment suggestions
    // For now, return empty array until actual API integration is implemented
    return [];
  }
}