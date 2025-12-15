import { DataSourceInstanceSettings, CoreApp, ScopedVars, MetricFindValue, QueryFixAction, QueryFixType } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { DataSourceWithQueryModificationSupport } from '@grafana/data';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, MyVariableQuery } from './types';
import { variableInterpolationService } from './utils/variableInterpolation';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> implements DataSourceWithQueryModificationSupport<MyQuery> {
  // Enable annotation support
  annotations = {};
  private templateSrv = getTemplateSrv();

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars) {
    // Detect query type and set it on the query
    const queryType = this.detectQueryType(query);
    
    // Use the enhanced variable interpolation service that handles both metrics and logs
    const interpolatedQuery = variableInterpolationService.interpolateQuery(query, scopedVars);
    
    // Set the detected query type
    interpolatedQuery.queryType = queryType;
    
    // For logs queries, ensure indexes array is preserved if present
    if (queryType === 'logs' && query.indexes) {
      interpolatedQuery.indexes = query.indexes;
    }
    
    return interpolatedQuery;
  }

  filterQuery(query: MyQuery): boolean {
    // Allow execution if query text is provided OR if it's an expression query OR if it's a logs query
    const hasMetricsQuery = !!query.queryText;
    const hasExpressionQuery = query.type === 'math' && !!query.expression;
    const hasLogsQuery = !!query.logQuery;
    
    // For logs queries, perform additional validation
    if (hasLogsQuery && query.logQuery) {
      // Import validation function dynamically to avoid circular dependencies
      import('./utils/logsQueryValidator').then(({ validateLogsQuery }) => {
        const validation = validateLogsQuery(query.logQuery!);
        if (!validation.isValid) {
          console.warn('Logs query validation failed:', validation.error);
          // Note: We still allow the query to proceed as validation errors 
          // will be shown in the UI, but the query might fail at runtime
        }
      }).catch(err => {
        console.warn('Failed to load logs query validator:', err);
      });
    }
    
    return hasMetricsQuery || hasExpressionQuery || hasLogsQuery;
  }

  /**
   * Detects whether a query should be treated as a logs query based on panel context and query properties
   */
  private detectQueryType(query: MyQuery): 'logs' | 'metrics' {
    // If queryType is explicitly set, use it
    if (query.queryType) {
      return query.queryType;
    }

    // If logQuery is provided, treat as logs query
    if (query.logQuery) {
      return 'logs';
    }

    // Check if the panel prefers logs visualization
    if (query.meta?.preferredVisualisationType === 'logs') {
      return 'logs';
    }

    // Default to metrics
    return 'metrics';
  }

  /**
   * Modifies a query based on the provided action for click-to-filter functionality
   * Supports ADD_FILTER and ADD_FILTER_OUT operations for logs queries
   * Requirements: 4.2, 4.3
   */
  modifyQuery(query: MyQuery, action: QueryFixAction): MyQuery {
    // Only handle logs queries
    if (this.detectQueryType(query) !== 'logs') {
      return query;
    }

    const { type, options } = action;
    const currentLogQuery = query.logQuery || '';

    let modifiedLogQuery = currentLogQuery;

    switch (type) {
      case 'ADD_FILTER':
        if (options?.key && options?.value) {
          modifiedLogQuery = this.addFilterToLogsQuery(currentLogQuery, options.key, options.value, false);
        }
        break;

      case 'ADD_FILTER_OUT':
        if (options?.key && options?.value) {
          modifiedLogQuery = this.addFilterToLogsQuery(currentLogQuery, options.key, options.value, true);
        }
        break;

      default:
        // Return original query for unsupported actions
        return query;
    }

    return {
      ...query,
      logQuery: modifiedLogQuery,
      queryType: 'logs' as const,
    };
  }

  /**
   * Returns the list of supported query modification types
   * Requirements: 4.2, 4.3
   */
  getSupportedQueryModifications(): Array<QueryFixType | string> {
    return ['ADD_FILTER', 'ADD_FILTER_OUT'];
  }

  /**
   * Adds a filter to a logs query string using Datadog logs search syntax
   * Handles both positive and negative filters with proper boolean logic
   * Requirements: 7.1, 7.2, 8.1, 8.2
   */
  private addFilterToLogsQuery(currentQuery: string, key: string, value: string, isNegative: boolean): string {
    // Sanitize the key and value to prevent injection
    const sanitizedKey = this.sanitizeLogsQueryPart(key);
    const sanitizedValue = this.sanitizeLogsQueryPart(value);

    // Create the filter string
    const filterPrefix = isNegative ? '-' : '';
    const filterString = `${filterPrefix}${sanitizedKey}:${sanitizedValue}`;

    // If the current query is empty, just return the filter
    if (!currentQuery.trim()) {
      return filterString;
    }

    // Check if this exact filter already exists to avoid duplicates
    const existingFilterPattern = new RegExp(`\\b${filterPrefix}${sanitizedKey}:${sanitizedValue}\\b`);
    if (existingFilterPattern.test(currentQuery)) {
      return currentQuery; // Filter already exists
    }

    // Add the filter with proper boolean logic
    // Use AND to combine with existing query
    return `${currentQuery.trim()} AND ${filterString}`;
  }

  /**
   * Sanitizes query parts to prevent injection and ensure valid Datadog logs syntax
   * Requirements: 9.1 (security consideration)
   */
  private sanitizeLogsQueryPart(part: string): string {
    // Remove or escape potentially dangerous characters
    let sanitized = part.trim();

    // Escape special Datadog logs search characters
    sanitized = sanitized.replace(/[+&|!(){}[\]^"~*?:\\]/g, '\\$&');

    // If the value contains spaces or special characters, wrap in quotes
    if (sanitized.includes(' ') || /[+&|!(){}[\]^"~*?:\\]/.test(sanitized)) {
      // Remove existing quotes to avoid double-quoting
      sanitized = sanitized.replace(/^"|"$/g, '');
      sanitized = `"${sanitized}"`;
    }

    return sanitized;
  }

  /**
   * This method is called when a template variable query is executed.
   * It handles variable queries for metrics, tag keys, and tag values.
   */
  async metricFindQuery(query: MyVariableQuery | string): Promise<MetricFindValue[]> {
    try {
      console.log('metricFindQuery called with:', query);
      console.log('metricFindQuery query type:', typeof query, typeof query === 'object' ? Object.keys(query) : 'N/A');
      
      // Handle string queries (legacy format)
      if (typeof query === 'string') {
        console.log('Received string query, attempting to parse:', query);
        try {
          const parsedQuery = JSON.parse(query) as MyVariableQuery;
          query = parsedQuery;
        } catch (e) {
          console.error('Failed to parse string query as JSON:', e);
          return [];
        }
      }
      
      // Ensure we have a valid query object
      if (!query || typeof query !== 'object' || !query.queryType) {
        console.error('Invalid query object:', query);
        return [];
      }
      
      // Validate required fields and return empty results if any are empty
      const validateAndConvertField = (value: string | undefined): string => {
        // Convert empty/undefined to '*' for backend compatibility
        return (value && value.trim() !== '') ? value : '*';
      };

      const isFieldEmpty = (value: string | undefined): boolean => {
        return !value || value.trim() === '';
      };

      // Check for empty required fields based on query type
      switch (query.queryType) {
        case 'metrics':
          if (isFieldEmpty(query.metricName)) {
            console.log('Metrics query has empty metricName field, returning empty results');
            return [];
          }
          break;
        case 'tag_keys':
          if (isFieldEmpty(query.metricName)) {
            console.log('Tag keys query has empty metricName field, returning empty results');
            return [];
          }
          break;
        case 'tag_values':
          if (isFieldEmpty(query.metricName) || isFieldEmpty(query.tagKey)) {
            console.log('Tag values query has empty required fields, returning empty results');
            return [];
          }
          break;
      }
      
      // Determine the resource endpoint based on query type
      let resourcePath = '';
      const params: Record<string, string> = {};

      switch (query.queryType) {
        case 'metrics':
          resourcePath = 'metrics';
          if (query.namespace && query.namespace !== '*') {
            params.namespace = query.namespace;
          }
          // Convert metricName to '*' if empty, otherwise use as-is
          params.searchPattern = validateAndConvertField(query.metricName);
          break;

        case 'tag_keys':
          resourcePath = 'tag-keys';
          // Convert metricName to '*' if empty, otherwise use as-is
          params.metricName = validateAndConvertField(query.metricName);
          // Use tagKey as filter pattern for tag keys (supports both autocomplete and regex)
          if (query.tagKey && query.tagKey !== '*') {
            params.filter = query.tagKey;
          }
          break;

        case 'tag_values':
          resourcePath = 'tag-values';
          // Convert fields to '*' if empty, otherwise use as-is
          params.metricName = validateAndConvertField(query.metricName);
          params.tagKey = validateAndConvertField(query.tagKey);
          break;

        default:
          throw new Error(`Unknown query type: ${query.queryType}`);
      }

      // Build URL without query parameters (backend expects POST with JSON body)
      const url = `/api/datasources/uid/${this.uid}/resources/${resourcePath}`;

      console.log('Making request to:', url, 'with params:', params);

      // Make the request to the backend resource handler
      // Backend expects POST requests with JSON body for variable resource handlers
      const response = await getBackendSrv().post(url, params);

      console.log('Response received:', response);

      // Handle the response - backend should return { values: string[] }
      if (response && Array.isArray(response.values)) {
        return response.values.map((value: string) => ({
          text: value,
          value: value,
        }));
      }

      // Fallback for unexpected response format
      if (Array.isArray(response)) {
        return response.map((value: any) => ({
          text: typeof value === 'string' ? value : String(value),
          value: typeof value === 'string' ? value : String(value),
        }));
      }

      return [];
    } catch (error) {
      console.error('Variable query failed:', error);
      
      // Return empty array on error to prevent Grafana from showing error dialogs
      // The error will be logged but won't break the variable functionality
      return [];
    }
  }
}
