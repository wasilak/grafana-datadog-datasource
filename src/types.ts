import { DataQuery, DataSourceJsonData, CompletionItem } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  label: string;
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  site: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData extends DataSourceJsonData {
  apiKey?: string;
  appKey?: string;
}

export interface MyVariableQuery {
  rawQuery: string;
}

// ==================== Query Autocomplete Types ====================

/**
 * Represents the context of a cursor position within a Datadog query
 */
export interface QueryContext {
  cursorPosition: number;
  currentToken: string;
  contextType: 'metric' | 'aggregation' | 'tag' | 'tag_value' | 'other';
  metricName?: string;
  existingTags: Set<string>;
  lineContent: string;
}

/**
 * State management for autocomplete feature
 */
export interface AutocompleteState {
  isOpen: boolean;
  suggestions: CompletionItem[];
  isLoading: boolean;
  selectedIndex: number;
  error?: string;
  validationError?: string;
}

/**
 * Cache for fetched suggestions with TTL support
 */
export interface CompletionCache {
  metricSuggestions: Map<string, { data: CompletionItem[]; timestamp: number }>;
  tagSuggestions: Map<string, { data: string[]; timestamp: number }>;
  TTL: number; // milliseconds
}

/**
 * Result of query validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Individual validation error with suggested fix
 */
export interface ValidationError {
  message: string;
  fix?: string;
}
