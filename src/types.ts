import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface JSONParsingConfig {
  enabled: boolean;
  targetField: 'whole_log' | 'message' | 'data' | 'attributes' | string;
  options?: {
    maxDepth?: number;
    maxSize?: number;
    preserveOriginal?: boolean;
    flattenNested?: boolean;
  };
}

export interface MyQuery extends DataQuery {
  queryText?: string;
  // Legend configuration
  legendMode?: 'auto' | 'custom';
  legendTemplate?: string;
  // Variable interpolation support - these fields will be populated by applyTemplateVariables
  interpolatedQueryText?: string;
  interpolatedLabel?: string;
  // Expression query fields for formulas
  type?: string;       // "math" for math expressions
  expression?: string; // Math expression like "$A*100/$B"
  // Query options
  interval?: number;   // Override interval in milliseconds
  // Logs query fields
  queryType?: 'logs' | 'metrics'; // Query type - defaults to 'metrics'
  logQuery?: string;   // Logs search query
  indexes?: string[];  // Target log indexes
  // JSON parsing configuration
  jsonParsing?: JSONParsingConfig;
  // Explore mode metadata for visualization hints
  meta?: {
    preferredVisualisationType?: 'graph' | 'table' | 'logs' | 'stat' | 'gauge';
    exploreMode?: boolean;
    [key: string]: any;
  };
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  queryText: '',
  legendMode: 'auto',
  legendTemplate: '',
  queryType: 'metrics',
  logQuery: '',
  indexes: [],
  jsonParsing: {
    enabled: false,
    targetField: 'message',
    options: {
      maxDepth: 10,
      maxSize: 1024 * 1024, // 1MB
      preserveOriginal: true,
      flattenNested: true,
    },
  },
};;;

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  site?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
  appKey?: string;
}

/**
 * Variable query interface for Grafana template variables
 * Supports querying Datadog API for metric names, tag keys, and tag values
 */
export interface MyVariableQuery {
  queryType: 'metrics' | 'tag_keys' | 'tag_values';
  namespace?: string;        // Filter metrics by namespace (e.g., 'system', 'aws')
  searchPattern?: string;    // Search pattern for metrics (e.g., 'cpu', 'memory') - supports regex with /pattern/
  metricName?: string;       // Metric name for tag queries
  tagKey?: string;          // Tag key for tag value queries
  filter?: string;          // Filter pattern for tag keys/values - supports regex with /pattern/
  rawQuery?: string;        // Legacy field for backward compatibility
}

/**
 * Props interface for VariableQueryEditor component
 */
export interface VariableQueryEditorProps {
  query: MyVariableQuery | string | any; // Grafana can pass different formats
  onChange: (query: MyVariableQuery, definition: string) => void;
  datasource?: any; // Grafana datasource instance
}

/**
 * Variable response from backend resource handlers
 */
export interface VariableResponse {
  values: string[];
  error?: string;
}

/**
 * Data frame structure for variable queries
 * Extends Grafana's data frame format for template variables
 */
export interface VariableDataFrame {
  name: string;
  fields: Array<{
    name: 'text';
    type: 'string';
    values: string[];
  }>;
}

/**
 * MetricFindValue format required by Grafana for template variables
 */
export interface MetricFindValue {
  text: string;
  value?: string;
}

/**
 * Variable query options for different query types
 */
export interface VariableQueryTypeOption {
  label: string;
  value: 'metrics' | 'tag_keys' | 'tag_values';
  description: string;
}

/**
 * Completion item for autocomplete suggestions
 */
export interface CompletionItem {
  label: string;
  kind?: 'metric' | 'aggregation' | 'aggregator' | 'tag' | 'tag_value' | 'grouping_tag' | 'filter_tag_key' | 'filter_tag_value' | 'function' | 'logs_service' | 'logs_source' | 'logs_level' | 'logs_host' | 'logs_env' | 'logs_facet' | 'logs_operator' | 'logs_tag' | 'logs_tag_value';
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

/**
 * Query context for autocomplete - what part of the query the cursor is in
 */
export type ContextType = 'metric' | 'aggregation' | 'aggregator' | 'tag' | 'tag_value' | 'grouping_tag' | 'filter_tag_key' | 'filter_tag_value' | 'logs_search' | 'logs_facet' | 'logs_service' | 'logs_source' | 'logs_level' | 'logs_host' | 'logs_env' | 'unknown';

export interface QueryContext {
  contextType: ContextType;
  metricName?: string;
  tagKey?: string; // For filter_tag_value context - the tag key being edited
  existingTags: Set<string>;
  currentToken: string;
  lineContent: string;
  cursorPosition: number;
}

/**
 * Grouped suggestions by category
 */
export interface SuggestionGroup {
  category: 'metrics' | 'aggregators' | 'tags' | 'tag_values';
  label: string;
  suggestions: CompletionItem[];
}

/**
 * State for the autocomplete hook
 */
export interface AutocompleteState {
  isOpen: boolean;
  suggestions: CompletionItem[];
  groupedSuggestions: SuggestionGroup[];
  isLoading: boolean;
  selectedIndex: number;
  hoveredIndex: number | null;
  error?: string;
  validationError?: string;
}

/**
 * Validation error with message and fix suggestion
 */
export interface ValidationError {
  message: string;
  fix?: string;
}

/**
 * Result of query validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Cache entry for autocomplete data
 */
export interface CacheEntry {
  data: CompletionItem[];
  timestamp: number;
}

/**
 * Completion cache structure
 */
export interface CompletionCache {
  metricSuggestions: Map<string, CacheEntry>;
  tagSuggestions: Map<string, CacheEntry>;
  TTL: number;
}

/**
 * Variable format options for multi-value variables
 */
export type VariableFormat = 'csv' | 'pipe' | 'json' | 'lucene' | 'raw';

/**
 * Variable interpolation context
 */
export interface VariableInterpolationContext {
  format?: VariableFormat;
  values: string[];
  isMultiValue: boolean;
}

/**
 * Variable example for help documentation
 */
export interface VariableExample {
  title: string;
  expression: string;
  label: string;
  category: 'basic' | 'multi-value' | 'formatting';
  description: string;
}
