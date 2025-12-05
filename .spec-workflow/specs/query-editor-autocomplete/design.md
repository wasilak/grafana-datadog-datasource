# Design Document: Query Editor Autocomplete

## Overview

This document describes the technical design for adding intelligent autocomplete functionality to the Grafana Datadog datasource query editor. The feature will provide context-aware suggestions for metric names, aggregation functions, and tags with a 300-500ms debounce delay. The design leverages Grafana's built-in autocomplete dialog UI component and integrates with the existing Datadog API infrastructure.

## Steering Document Alignment

### Technical Standards

The plugin follows Grafana's standard patterns for datasource plugins (v12.3.0). Our design aligns with these patterns:
- Use of `@grafana/data` and `@grafana/ui` components
- React 19 with hooks and functional components (migrating from PureComponent)
- TypeScript with strict typing
- Proper use of `getBackendSrv()` for API calls
- Support for template variable interpolation via `getTemplateSrv()`

### Project Structure

The implementation will follow the existing file organization:
- Components: `src/QueryEditor.tsx` (refactored)
- Hooks: `src/hooks/useQueryAutocomplete.ts` (new)
- Utilities: `src/utils/autocomplete/` (new directory)
  - `src/utils/autocomplete/parser.ts` - Query parsing and context detection
  - `src/utils/autocomplete/suggestions.ts` - Suggestion generation logic
  - `src/utils/autocomplete/api.ts` - Datadog API integration for suggestions
- Types: `src/types.ts` (extended)

## Code Reuse Analysis

### Existing Components to Leverage

- **`QueryEditor.tsx`**: The existing component will be refactored to use hooks instead of PureComponent class pattern, integrating the autocomplete hook
- **`datasource.ts`**: Existing methods like `fetchMetricNames()` and `metricFindQuery()` will be extracted and reused for suggestion fetching
- **Grafana UI `CompletionItem` & `CodeEditor`**: Will use Grafana's built-in autocomplete dialog components for consistency
- **`getBackendSrv()`**: Existing API call mechanism will be used for suggestion fetching
- **`getTemplateSrv()`**: Template variable replacement will be applied to autocomplete context

### Integration Points

- **Datadog API Integration**: Leverage existing Datadog API routes defined in `plugin.json` to fetch metrics and tags
- **Query State Management**: Work with existing `MyQuery` interface for query text storage
- **Datasource Instance**: Access datasource instance for API routes and configuration
- **Variable Interpolation**: Support Grafana dashboard variables in metric and tag contexts

## Architecture

The autocomplete feature is designed with a layered, modular architecture:

```
QueryEditor (UI Layer)
    ↓
useQueryAutocomplete Hook (State Management)
    ├─ Debounce Logic
    ├─ State Management
    └─ API Orchestration
        ↓
Suggestion Engine (Business Logic)
    ├─ parser.ts (Query context analysis)
    ├─ suggestions.ts (Suggestion generation)
    └─ api.ts (Datadog API calls)
        ↓
Datadog API (External Service)
    ├─ Metrics endpoint
    └─ Tags endpoint
```

### Modular Design Principles

1. **Single File Responsibility**:
   - `parser.ts`: Only responsible for parsing queries and detecting cursor context
   - `suggestions.ts`: Only generates suggestion lists from parsed data
   - `api.ts`: Only handles API calls and response transformation
   - `useQueryAutocomplete.ts`: Only manages autocomplete state and debounce timing

2. **Component Isolation**:
   - Autocomplete logic is completely separate from rendering
   - Suggestion fetching is isolated in utility functions
   - UI component remains focused on display only

3. **Service Layer Separation**:
   - Data Access: `api.ts` handles all Datadog API communication
   - Business Logic: `parser.ts` and `suggestions.ts` handle context analysis and suggestion generation
   - Presentation: `QueryEditor.tsx` handles rendering and user interaction

4. **Utility Modularity**:
   - Each utility has a single, clear purpose
   - No cross-cutting concerns within utilities
   - All functions are pure and testable

## Components and Interfaces

### Component 1: `useQueryAutocomplete` Hook

- **Purpose**: Manages autocomplete state, debouncing, and API calls
- **Interfaces**:
  ```typescript
  interface AutocompleteState {
    isOpen: boolean;
    suggestions: CompletionItem[];
    isLoading: boolean;
    selectedIndex: number;
    error?: string;
  }
  
  function useQueryAutocomplete(
    query: string,
    queryText: string | undefined,
    cursor: { line: number; ch: number }
  ): {
    state: AutocompleteState;
    onItemSelect: (item: CompletionItem) => void;
    onNavigate: (direction: 'up' | 'down') => void;
    onClose: () => void;
  }
  ```
- **Dependencies**: `datasource` instance, debounce utilities
- **Reuses**: Existing `datasource.fetchMetricNames()` and API utilities

### Component 2: `QueryEditor` (Refactored)

- **Purpose**: React component for query input with integrated autocomplete UI
- **Interfaces**:
  ```typescript
  interface QueryEditorProps {
    query: MyQuery;
    onChange: (query: MyQuery) => void;
    onRunQuery: () => void;
    datasource: DataSource;
  }
  ```
- **Dependencies**: `useQueryAutocomplete` hook, Grafana UI components
- **Reuses**: Existing `TextArea` input, label rendering logic

### Component 3: Suggestion Utilities

- **Purpose**: Provide pure functions for parsing and generating suggestions
- **Interfaces**:
  ```typescript
  // parser.ts
  interface QueryContext {
    cursorPosition: number;
    currentToken: string;
    contextType: 'metric' | 'aggregation' | 'tag' | 'tag_value' | 'other';
    metricName?: string;
    existingTags: string[];
  }
  
  function parseQuery(queryText: string, cursorPosition: number): QueryContext
  
  // suggestions.ts
  function generateSuggestions(
    context: QueryContext,
    metrics: string[],
    tagsForMetric: string[],
    existingSuggestions?: CachedSuggestions
  ): CompletionItem[]
  
  // api.ts - Uses official Datadog TypeScript API client
  async function fetchMetricsFromDatadog(
    configuration: Configuration
  ): Promise<string[]>
  
  async function fetchTagsForMetric(
    configuration: Configuration,
    metricName: string
  ): Promise<string[]>
  ```
- **Dependencies**: `@datadog/datadog-api-client` (official client)
- **Reuses**: Type definitions from `types.ts`, existing datasource configuration for auth

## Data Models

### CompletionItem (from Grafana)
```typescript
interface CompletionItem {
  label: string;           // Display text
  kind?: string;          // 'metric' | 'aggregation' | 'tag' | 'tag_value'
  detail?: string;        // Additional info shown in dropdown
  insertText: string;     // Text to insert when selected
  sortText?: string;      // Used for sorting suggestions
  documentation?: string; // Hover text
  range?: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
}
```

### QueryContext (Internal)
```typescript
interface QueryContext {
  cursorPosition: number;
  currentToken: string;
  contextType: 'metric' | 'aggregation' | 'tag' | 'tag_value' | 'other';
  metricName?: string;
  existingTags: Set<string>;
  lineContent: string;
}
```

### AutocompleteCache
```typescript
interface AutocompleteCache {
  metricSuggestions: Map<string, { data: CompletionItem[]; timestamp: number }>;
  tagSuggestions: Map<string, { data: string[]; timestamp: number }>;
  TTL: number; // 30 seconds
}
```

## Error Handling

### Error Scenarios

1. **Datadog API Timeout (>2 seconds)**
   - **Handling**: Cancel request, show timeout message, allow manual entry
   - **User Impact**: User sees "Suggestions loading..." message that clears after timeout

2. **Network Error / API Failure**
   - **Handling**: Log error, close autocomplete, show warning tooltip
   - **User Impact**: Autocomplete closes, user can continue typing manually

3. **Invalid Query Context**
   - **Handling**: Skip suggestion generation, return empty list
   - **User Impact**: No suggestions shown for invalid cursor positions

4. **Unauthorized / Invalid Credentials**
   - **Handling**: Show authentication error in autocomplete instead of suggestions
   - **User Impact**: User is prompted to verify datasource credentials

5. **Memory/Performance Issues (too many suggestions)**
   - **Handling**: Limit suggestions to top 100 items, implement virtualization
   - **User Impact**: Scrollable list, responsive keyboard navigation

## Testing Strategy

### Unit Testing

- **Query Parser Tests** (`parser.ts`):
  - Parse metric names at various cursor positions
  - Detect aggregation function context
  - Identify tag filter context
  - Handle edge cases (empty queries, special characters)

- **Suggestion Generator Tests** (`suggestions.ts`):
  - Generate correct completions for metric context
  - Generate correct completions for aggregation context
  - Filter duplicate suggestions
  - Handle metric names with special characters

- **Hook Tests** (`useQueryAutocomplete.ts`):
  - Debounce triggers after 300-500ms of inactivity
  - Cancel previous debounce on new input
  - Navigation between suggestions
  - Selection and insertion of completions

### Integration Testing

- **API Integration Tests** (`api.ts`):
  - Fetch metrics from Datadog API successfully
  - Handle API errors gracefully
  - Cache responses correctly
  - Cache expiration works as expected

- **QueryEditor Integration**:
  - Autocomplete appears on debounce timeout
  - Keyboard navigation closes and opens autocomplete
  - Selected item inserts into query correctly
  - Multiple selections in same query work correctly

### End-to-End Testing

- **User Workflows**:
  1. Type metric name → autocomplete appears → select metric → aggregation suggestions appear
  2. Type aggregation → tag filter context → select tags → query executes successfully
  3. Keyboard-only navigation through autocomplete
  4. API timeout scenario → graceful fallback
  5. Empty query → initial metric suggestions appear

## Datadog API Integration

### API Client Library

The implementation SHALL use the official Datadog TypeScript API client (`@datadog/datadog-api-client`) instead of bare HTTP calls.

**Installation:**
```bash
npm install @datadog/datadog-api-client
# or
yarn add @datadog/datadog-api-client
```

**Configuration Pattern:**
```typescript
import { client, v1 } from '@datadog/datadog-api-client';

const configuration = client.createConfiguration({
  authMethods: {
    apiKeyAuth: apiKey,
    appKeyAuth: appKey
  },
  httpConfig: {
    timeout: 2000, // 2-second timeout for suggestions
    signal: abortController.signal
  }
});
```

### Metrics and Tags API Endpoints

Using the official client, the autocomplete feature will interact with:

1. **MetricsApi** (v1):
   - `listMetrics()` - Get all available metrics (paginated)
   - Purpose: Metric name suggestions

2. **TagsApi** (v1):
   - `listHostTags()` - Get available tags
   - Purpose: Tag key and value suggestions for filters

3. **MetricsApi** (v1):
   - `queryMetricsData()` - Query metric metadata including available tags
   - Purpose: Get tags specific to a metric

### Benefits of Official Client

- Type-safe API interactions with full TypeScript support
- Built-in authentication handling via configuration
- Automatic request retry with exponential backoff
- Request timeout and AbortController support
- Proper error types and handling
- Compliance with Datadog's API versioning strategy
- Future-proof against API changes

## Performance Considerations

1. **Debounce Duration**: 300-500ms strikes balance between responsiveness and API load
2. **Caching**: 30-second TTL cache for metric and tag suggestions
3. **API Limiting**: Max 5 concurrent suggestion requests
4. **Suggestion Limiting**: Display max 100 suggestions with virtualization
5. **Query Parsing**: Simple regex-based parser (<10ms execution time)

## Migration Path from PureComponent to Hooks

The `QueryEditor` component will be refactored from `PureComponent` to a functional component using hooks:

**Before:**
```typescript
export class QueryEditor extends PureComponent<Props>
```

**After:**
```typescript
export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props)
```

This modernizes the codebase to match Grafana's current patterns while maintaining backward compatibility.
