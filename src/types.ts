import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  label?: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  queryText: '',
  label: '',
};

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

export interface MyVariableQuery {
  rawQuery: string;
}

/**
 * Completion item for autocomplete suggestions
 */
export interface CompletionItem {
  label: string;
  kind?: 'metric' | 'aggregation' | 'aggregator' | 'tag' | 'tag_value' | 'grouping_tag' | 'filter_tag_key' | 'function';
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

/**
 * Query context for autocomplete - what part of the query the cursor is in
 */
export type ContextType = 'metric' | 'aggregation' | 'aggregator' | 'tag' | 'tag_value' | 'grouping_tag' | 'filter_tag_key' | 'unknown';

export interface QueryContext {
  contextType: ContextType;
  metricName?: string;
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
