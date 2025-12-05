# Query Editor Autocomplete

This document describes the Query Editor Autocomplete feature for the Datadog datasource plugin.

## Overview

The Query Editor Autocomplete feature provides context-aware suggestions while writing Datadog queries in Grafana. It helps users discover available metrics, aggregation functions, and tags without needing to remember exact names or syntax.

### Key Features

- **Context-Aware Suggestions**: Suggestions adapt based on cursor position (metric, aggregation, tag context)
- **Real-Time Validation**: Query syntax validation with helpful error messages
- **Performance Optimized**: 30-second TTL caching prevents excessive API calls
- **Debounced Updates**: 300-500ms debounce reduces backend load
- **Keyboard Navigation**: Arrow keys, Enter, Tab, and Escape for efficient interaction
- **Secure Backend Integration**: All API credentials handled by Grafana backend

## Architecture

### Frontend Components

```
QueryEditor
  └─ useQueryAutocomplete Hook
       ├─ parseQuery: Analyzes query structure and cursor context
       ├─ generateSuggestions: Creates CompletionItem array
       └─ validateQuery: Syntax validation
```

### Backend Integration

```
Frontend → Grafana Backend Proxy → Go Plugin CallResourceHandler → Datadog API
```

The backend plugin implements secure endpoints:
- `GET /api/datasources/uid/{uid}/resources/autocomplete/metrics` - Fetch available metrics
- `GET /api/datasources/uid/{uid}/resources/autocomplete/tags/{metric}` - Fetch tags for a metric

### Data Flow

1. **User Input**: User types in query editor
2. **Debounce**: 400ms debounce timer starts
3. **Parse**: Query structure analyzed to determine context
4. **Validate**: Query syntax validated synchronously
5. **Fetch**: Backend endpoints called for suggestions (cached for 30 seconds)
6. **Display**: Suggestions rendered in autocomplete menu
7. **Interact**: User selects with keyboard or mouse
8. **Insert**: Selection inserted into query at cursor position

## Query Context Types

The autocomplete detects four different contexts to provide appropriate suggestions:

### 1. Metric Context
When cursor is in metric name position.
- **Example**: `avg:metric.` ← cursor here
- **Suggestions**: Available metric names (cpu, memory, disk, network, etc.)

### 2. Aggregation Context
When cursor is at query start, before the metric.
- **Example**: `avg` ← cursor here or before
- **Suggestions**: Aggregation functions (avg, sum, min, max, count, etc.)

### 3. Tag Context
When cursor is in tag filter section.
- **Example**: `avg:metric.cpu{host:}` ← cursor here
- **Suggestions**: Available tag keys (host, service, env, region, etc.)

### 4. Tag Value Context
When cursor is after tag key in tag filter.
- **Example**: `avg:metric.cpu{host:web-}` ← cursor here
- **Suggestions**: Tag values for the specified tag key

## Configuration

### Debounce Timing

Default debounce is 400ms (within Datadog spec of 300-500ms). Adjust in `src/hooks/useQueryAutocomplete.ts`:

```typescript
const DEFAULT_DEBOUNCE_MS = 400; // Milliseconds
```

### Cache TTL

Default cache TTL is 30 seconds. Adjust in Go backend `pkg/plugin/datasource.go`:

```go
ttl := 30 * time.Second
```

### API Timeout

Default timeout for API calls is 2 seconds. Adjust in Go backend:

```go
fetchCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
```

### Concurrent Request Limit

Maximum 5 concurrent requests to Datadog API. Change in `pkg/plugin/datasource.go`:

```go
concurrencyLimit: make(chan struct{}, 5), // Adjust buffer size
```

## Usage Examples

### Example 1: Basic Metric Query

1. Start typing: `a` (autocomplete opens)
2. Suggestions show: avg, sum, min, max, count...
3. Select `avg` (press Enter or click)
4. Continue typing: `avg:metric.`
5. Suggestions show metric names
6. Select `cpu`: `avg:metric.cpu`

### Example 2: Adding Tags

1. Query: `avg:metric.cpu{`
2. Suggestions show available tags: host, service, env...
3. Select `host`: `avg:metric.cpu{host:`
4. Suggestions show tag values: web-01, web-02, db-01...
5. Select `web-01`: `avg:metric.cpu{host:web-01}`

### Example 3: Validation Errors

Query: `metric.cpu` (missing aggregation)
- Red error indicator shows: "Missing aggregation function"
- User adds aggregation: `avg:metric.cpu`
- Error clears, green checkmark shows

## Keyboard Navigation

| Key | Action |
|-----|--------|
| **Arrow Down** | Move to next suggestion |
| **Arrow Up** | Move to previous suggestion |
| **Enter** | Select highlighted suggestion |
| **Tab** | Select highlighted suggestion and keep menu open |
| **Escape** | Close autocomplete menu |
| **Ctrl+/** | Toggle comment on current line |

## Error Messages and Troubleshooting

### "Datadog credentials invalid"
- **Cause**: API key or app key not configured
- **Solution**: Check datasource configuration in Grafana → Data Sources → Datadog

### "Endpoint not found (backend not available)"
- **Cause**: Backend plugin not loaded
- **Solution**: Verify backend plugin binary exists and Grafana version >= 12.3.0

### "Suggestions request timeout"
- **Cause**: Datadog API not responding within 2 seconds
- **Solution**: Check Datadog API status, network connectivity, or increase timeout

### "Failed to fetch suggestions"
- **Cause**: Network error or API error
- **Solution**: Check browser console for detailed error, verify network connectivity

### Autocomplete menu not appearing
- **Cause**: 
  - No suggestions found for context
  - Hook not properly integrated
  - Debounce timer not firing
- **Solution**: Check browser console, verify API calls in Network tab, confirm datasource UID passed to hook

### Suggestions are stale or incorrect
- **Cause**: Cache returning old data
- **Solution**: Wait 30 seconds for cache to expire, or manually refresh browser

## Performance Considerations

### Debouncing
The 400ms debounce prevents excessive API calls while user is still typing. A faster debounce increases responsiveness but may overload the API.

### Caching
30-second TTL caching reduces API calls for repeated metrics/tags queries. The cache is per-datasource instance, not global.

### Concurrent Request Limiting
Maximum 5 concurrent requests prevents overwhelming Datadog API. Excess requests queue and execute when slots available.

### Metrics Response Size
If your Datadog account has thousands of metrics, the response may be large. Consider using metric name filters if performance issues occur.

## Developer Notes

### Testing
Run unit tests for individual components:
```bash
npm test src/hooks/useQueryAutocomplete
npm test src/components/QueryEditor
npm test src/utils/autocomplete/parser
```

Run integration tests:
```bash
npm test tests/hooks/useQueryAutocomplete.test.ts
npm test tests/components/QueryEditor.test.tsx
```

### Backend Plugin Development
The Go backend plugin is in `pkg/plugin/datasource.go`.

Key methods:
- `CallResource()` - Routes autocomplete requests
- `MetricsHandler()` - Fetches metrics from Datadog
- `TagsHandler()` - Fetches tags for a metric

### Debugging
Enable debug logging in browser console:
```javascript
localStorage.setItem('loglevel.grafana-datadog-datasource', 'debug');
```

Check Go backend logs in Grafana server logs:
```bash
tail -f /var/log/grafana/grafana.log | grep "datadog"
```

## API Reference

### Frontend Hook: useQueryAutocomplete

```typescript
interface UseQueryAutocompleteOptions {
  datasourceUid: string;    // Required: Datasource instance UID
  debounceMs?: number;      // Optional: Debounce delay (default: 400)
}

interface AutocompleteState {
  isOpen: boolean;                // Menu visibility
  suggestions: CompletionItem[];  // Available suggestions
  isLoading: boolean;             // API call in progress
  selectedIndex: number;          // Currently highlighted suggestion
  error?: string;                 // Error message if fetch failed
  validationError?: string;       // Query validation error
}

function useQueryAutocomplete(options: UseQueryAutocompleteOptions): {
  state: AutocompleteState;
  onInput: (queryText: string, cursorPosition: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onItemSelect: (item: CompletionItem) => void;
  onClose: () => void;
}
```

### Backend Endpoints

#### GET /autocomplete/metrics
Fetch list of available metrics.

**Response:**
```json
["metric.cpu", "metric.memory", "metric.disk"]
```

**Status Codes:**
- 200: Success
- 401: Invalid credentials
- 404: Endpoint not found

**Caching:** 30 seconds TTL

#### GET /autocomplete/tags/{metric}
Fetch tags available for a specific metric.

**Parameters:**
- `metric` (URL path): Metric name (e.g., "metric.cpu")

**Response:**
```json
["host:web-01", "host:web-02", "service:api", "env:prod"]
```

**Status Codes:**
- 200: Success
- 400: Missing metric name
- 401: Invalid credentials
- 404: Endpoint not found

**Caching:** 30 seconds TTL per metric

## Future Enhancements

Potential improvements for future versions:

1. **Metric Filtering**: Allow filtering metrics by type or pattern
2. **Tag Suggestions**: Suggest complete tag key:value pairs
3. **Custom Debounce**: User-configurable debounce timing
4. **Query History**: Autocomplete from recently used queries
5. **Advanced Regex Support**: Context detection for complex query syntax
6. **Multilingual Support**: Localized error messages and UI
7. **Offline Mode**: Cache suggestions in localStorage for offline use
8. **Performance Metrics**: Analytics on suggestion usage patterns

## Related Documentation

- [Datadog API Documentation](https://docs.datadoghq.com/api/latest/)
- [Grafana Plugin Development](https://grafana.com/developers/plugin-tools)
- [Query Editor Components](./query-editor.md)
