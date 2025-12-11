# Design Document: Grafana Dashboard Variable Support

## Overview

This document describes the technical design for implementing comprehensive Grafana dashboard variable support in the Datadog datasource plugin. The implementation will enable users to create dynamic dashboards using template variables that query the Datadog API for metric names, tag keys, and tag values, and then use those variables throughout their dashboards for dynamic filtering and templating.

The design encompasses:
1. **Variable Interpolation** - Replace variable placeholders with actual values in queries
2. **Query Variables** - Fetch variable options from Datadog API endpoints
3. **Variable Query Editor** - UI for configuring variable queries
4. **Backend Resource Handlers** - Dedicated API endpoints for variable data
5. **Error Handling** - Grafana-compliant error management
6. **Logging & Observability** - Comprehensive instrumentation
7. **Explore Mode Support** - Variable functionality in ad-hoc analysis
8. **Annotation Support** - Variables in annotation queries
9. **Panel Label Support** - Variable interpolation in panel titles and labels

## Architecture

The variable support system follows a layered architecture integrating with Grafana's template variable system:

```
Frontend Layer (React/TypeScript)
├── VariableQueryEditor Component
├── ExploreQueryEditor Component (with variables)
├── Enhanced QueryEditor Component
└── Query Editor Help Component
    ↓
Variable Processing Layer
├── Variable Interpolation Service
├── Variable Query Service
├── Variable Validation Service
└── Panel Label Interpolation Service
    ↓
Backend Resource Layer (Go)
├── /resources/metrics Handler
├── /resources/tag-keys Handler
├── /resources/tag-values Handler
└── Logging & Error Handling
    ↓
Datadog API Integration
├── Metrics API Client
├── Tags API Client
└── Authentication & Rate Limiting
```

## Components and Interfaces

### Component 1: Variable Query Editor

**Purpose**: React component for configuring query variables with intuitive UI

**File**: `src/VariableQueryEditor.tsx`

**Key Features**:
- Query type selection (metrics, tag keys, tag values)
- Dynamic form fields based on query type
- Real-time preview of variable values
- Validation and error display

**Interface**:
```typescript
interface VariableQueryEditorProps {
  query: MyVariableQuery;
  onChange: (query: MyVariableQuery, definition: string) => void;
}

interface MyVariableQuery {
  queryType: 'metrics' | 'tag_keys' | 'tag_values';
  namespace?: string;        // For metrics filtering
  searchPattern?: string;    // For metrics search
  metricName?: string;       // For tag keys/values
  tagKey?: string;          // For tag values
}
```

### Component 2: Enhanced DataSource Class

**Purpose**: Extend existing DataSource with variable support methods

**File**: `src/datasource.ts`

**New Methods**:
```typescript
class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  // Existing methods...
  
  // Variable support
  async metricFindQuery(query: MyVariableQuery, options?: any): Promise<MetricFindValue[]>;
  
  // Enhanced template variable interpolation
  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars): MyQuery;
  
  // Annotation support
  annotations: {};
}
```

### Component 3: Backend Resource Handlers

**Purpose**: Go backend handlers for variable data endpoints

**File**: `pkg/plugin/resources.go`

**Endpoints**:
- `GET /resources/metrics` - Fetch metric names
- `GET /resources/tag-keys` - Fetch tag keys for a metric
- `GET /resources/tag-values` - Fetch tag values for a tag key

**Interface**:
```go
type ResourceHandler struct {
    client DatadogClient
    logger log.Logger
    cache  *Cache
}

func (h *ResourceHandler) handleMetrics(w http.ResponseWriter, r *http.Request)
func (h *ResourceHandler) handleTagKeys(w http.ResponseWriter, r *http.Request)  
func (h *ResourceHandler) handleTagValues(w http.ResponseWriter, r *http.Request)
```

### Component 4: Variable Interpolation Service

**Purpose**: Handle variable replacement in queries and labels

**File**: `src/utils/variableInterpolation.ts`

**Interface**:
```typescript
interface VariableInterpolationService {
  interpolateQuery(query: MyQuery, scopedVars: ScopedVars): MyQuery;
  interpolateLabel(label: string, scopedVars: ScopedVars): string;
  formatMultiValue(values: string[], format: string): string;
}
```

### Component 5: Query Editor Help Component

**Purpose**: Contextual help with variable examples

**File**: `src/QueryEditorHelp.tsx`

**Interface**:
```typescript
interface QueryEditorHelpProps {
  onClickExample: (query: DataQuery) => void;
}

interface VariableExample {
  title: string;
  expression: string;
  label: string;
  category: 'basic' | 'multi-value' | 'formatting';
}
```

## Data Models

### MyVariableQuery
```typescript
interface MyVariableQuery {
  queryType: 'metrics' | 'tag_keys' | 'tag_values';
  namespace?: string;        // Filter metrics by namespace
  searchPattern?: string;    // Search pattern for metrics
  metricName?: string;       // Metric name for tag queries
  tagKey?: string;          // Tag key for tag value queries
}
```

### Variable Response Data Frames
```typescript
interface VariableDataFrame {
  name: string;
  fields: [
    {
      name: 'text';
      type: FieldType.string;
      values: string[];
    }
  ];
}
```

### Resource Handler Request/Response
```go
type MetricsRequest struct {
    Namespace     string `json:"namespace,omitempty"`
    SearchPattern string `json:"searchPattern,omitempty"`
}

type TagKeysRequest struct {
    MetricName string `json:"metricName,omitempty"`
}

type TagValuesRequest struct {
    MetricName string `json:"metricName,omitempty"`
    TagKey     string `json:"tagKey"`
}

type VariableResponse struct {
    Values []string `json:"values"`
    Error  string   `json:"error,omitempty"`
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Variable interpolation works correctly across all contexts
*For any* query, label, or annotation containing variables (single or multiple, including built-in variables like `$__from`), interpolating the variables should replace all placeholders with their current values while preserving the original structure
**Validates: Requirements 1.1, 1.2, 1.4, 16.1, 15.1, 17.1**

### Property 2: Multi-value variable formatting produces consistent output
*For any* multi-value variable and format specifier (CSV, pipe, JSON, Lucene, or custom), the formatting should produce the same output for identical inputs and follow the specified format rules
**Validates: Requirements 2.1, 2.2, 2.3, 7.1, 7.2, 7.3**

### Property 3: Variable queries return properly structured data frames
*For any* variable query type (metrics, tag keys, tag values), the response should be a valid data frame with a single string field containing the variable options, properly converted to MetricFindValue format
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 3.4, 4.4, 5.4**

### Property 4: API integration filters data correctly
*For any* variable query with filters (namespace, search pattern, metric name, tag key), the system should return only results matching all specified filters
**Validates: Requirements 3.2, 3.3, 4.2, 5.2**

### Property 5: Error handling provides user-friendly messages
*For any* error condition (API failures, validation errors, interpolation failures), the system should log technical details to console but display grammatically correct, non-technical error messages to users
**Validates: Requirements 8.2, 8.4, 8.5**

### Property 6: Caching improves performance without stale data
*For any* variable query executed within the 5-minute cache TTL, the response should come from cache and be significantly faster, while queries outside the TTL should fetch fresh data
**Validates: Requirements 9.1, 9.2**

### Property 7: Resource handlers return proper HTTP responses
*For any* resource handler request, the response should have appropriate HTTP status codes (200 for success, 4xx for client errors, 5xx for server errors) and structured JSON format
**Validates: Requirements 11.4, 11.5**

### Property 8: Logging provides complete observability
*For any* variable operation (queries, interpolation, errors), structured log entries should be created with sufficient context (duration, status, user, trace ID) for debugging and monitoring
**Validates: Requirements 13.1, 13.2, 13.3, 13.4**

### Property 9: Cross-mode consistency is maintained
*For any* variable functionality (interpolation, autocomplete, validation), the behavior should be identical between dashboard mode and Explore mode
**Validates: Requirements 14.2, 14.4**

### Property 10: Real-time updates work correctly
*For any* variable value change, all dependent elements (query results, panel labels, autocomplete suggestions) should update immediately to reflect the new values
**Validates: Requirements 6.5, 16.3, 17.3**

## Error Handling

### Frontend Error Scenarios

1. **Variable Query Validation Errors**
   - **Handling**: Display field-specific validation messages
   - **User Impact**: Clear guidance on how to fix configuration
   - **Implementation**: Use Grafana's form validation patterns

2. **Variable Interpolation Failures**
   - **Handling**: Log technical details to console, show simple message to user
   - **User Impact**: Query continues with original variable placeholders
   - **Implementation**: `try/catch` with fallback behavior

3. **Resource Handler Request Failures**
   - **Handling**: Display user-friendly error message, retry mechanism
   - **User Impact**: Variable dropdown shows error state with retry option
   - **Implementation**: HTTP error handling with exponential backoff

### Backend Error Scenarios

1. **Datadog API Authentication Failures**
   - **Handling**: Return 401 status with clear message
   - **User Impact**: Prompt to check API credentials
   - **Implementation**: Validate API key before making requests

2. **Datadog API Rate Limiting**
   - **Handling**: Return 429 status with retry-after header
   - **User Impact**: Temporary delay with progress indicator
   - **Implementation**: Respect rate limits and implement backoff

3. **Network Timeouts**
   - **Handling**: Return 504 status with timeout message
   - **User Impact**: Clear indication of timeout with retry option
   - **Implementation**: Context-based timeouts with cancellation

## Testing Strategy

### Unit Testing

**Frontend Tests**:
- **Variable Interpolation Tests** (`variableInterpolation.test.ts`):
  - Test single variable replacement
  - Test multi-value variable formatting
  - Test nested variable scenarios
  - Test edge cases (empty values, special characters)

- **Variable Query Editor Tests** (`VariableQueryEditor.test.tsx`):
  - Test query type switching
  - Test form validation
  - Test real-time preview updates
  - Test error display

**Backend Tests**:
- **Resource Handler Tests** (`resources_test.go`):
  - Test each endpoint with valid requests
  - Test error scenarios (auth, timeout, invalid params)
  - Test response format validation
  - Test caching behavior

### Property-Based Testing

- **Variable Interpolation Property Tests**:
  - Generate random queries with variables
  - Verify interpolation preserves query structure
  - Test with various variable formats and values

- **Multi-value Formatting Property Tests**:
  - Generate random arrays of values
  - Test all format options produce consistent results
  - Verify format output matches expected patterns

### Integration Testing

- **End-to-End Variable Workflow Tests**:
  - Create variable → Configure query → Use in dashboard
  - Test variable changes propagate to all dependent queries
  - Test variable interpolation in different contexts (queries, labels, annotations)

- **Backend Integration Tests**:
  - Test resource handlers with real Datadog API
  - Test authentication and error handling
  - Test caching and performance characteristics

## Implementation Details

### Variable Query Editor Implementation

```typescript
export const VariableQueryEditor: React.FC<VariableQueryEditorProps> = ({ query, onChange }) => {
  const [state, setState] = useState<MyVariableQuery>(query);
  const [preview, setPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const updateQuery = useCallback((newQuery: MyVariableQuery) => {
    setState(newQuery);
    onChange(newQuery, generateQueryDefinition(newQuery));
  }, [onChange]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getBackendSrv().fetch({
        url: `/api/datasources/proxy/${datasourceUid}/resources/${getEndpoint(state.queryType)}`,
        method: 'POST',
        data: state,
      });
      setPreview(response.data.values || []);
    } catch (error) {
      console.error('Failed to load variable preview:', error);
      throw new Error('Unable to load variable options');
    } finally {
      setLoading(false);
    }
  }, [state, datasourceUid]);

  return (
    <div className="gf-form-group">
      <InlineField label="Query Type">
        <Select
          value={state.queryType}
          options={queryTypeOptions}
          onChange={(option) => updateQuery({ ...state, queryType: option.value })}
        />
      </InlineField>
      
      {state.queryType === 'metrics' && (
        <>
          <InlineField label="Namespace">
            <Input
              value={state.namespace || ''}
              onChange={(e) => updateQuery({ ...state, namespace: e.currentTarget.value })}
              placeholder="e.g., system, aws, custom"
            />
          </InlineField>
          <InlineField label="Search Pattern">
            <Input
              value={state.searchPattern || ''}
              onChange={(e) => updateQuery({ ...state, searchPattern: e.currentTarget.value })}
              placeholder="e.g., cpu, memory, disk"
            />
          </InlineField>
        </>
      )}
      
      {/* Additional fields for tag_keys and tag_values... */}
      
      <InlineField label="Preview">
        <div className="variable-preview">
          {loading ? (
            <Spinner />
          ) : (
            <div className="variable-preview-values">
              {preview.slice(0, 10).map((value, index) => (
                <Badge key={index} text={value} color="blue" />
              ))}
              {preview.length > 10 && <span>... and {preview.length - 10} more</span>}
            </div>
          )}
        </div>
      </InlineField>
    </div>
  );
};
```

### Backend Resource Handler Implementation

```go
func (h *ResourceHandler) handleMetrics(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    pCtx := backend.PluginConfigFromContext(ctx)
    
    // Parse request
    var req MetricsRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.logger.Error("Failed to parse metrics request", "error", err)
        http.Error(w, "Invalid request format", http.StatusBadRequest)
        return
    }
    
    // Validate authentication
    if err := h.validateAuth(pCtx); err != nil {
        h.logger.Error("Authentication failed", "error", err, "user", pCtx.User.Login)
        http.Error(w, "Authentication failed", http.StatusUnauthorized)
        return
    }
    
    // Check cache
    cacheKey := fmt.Sprintf("metrics:%s:%s", req.Namespace, req.SearchPattern)
    if cached, found := h.cache.Get(cacheKey); found {
        h.writeJSONResponse(w, cached)
        return
    }
    
    // Fetch from Datadog API
    metrics, err := h.client.GetMetrics(ctx, req.Namespace, req.SearchPattern)
    if err != nil {
        h.logger.Error("Failed to fetch metrics", "error", err, "namespace", req.Namespace)
        http.Error(w, "Unable to fetch metrics from Datadog", http.StatusInternalServerError)
        return
    }
    
    // Cache and return response
    response := VariableResponse{Values: metrics}
    h.cache.Set(cacheKey, response, 5*time.Minute)
    h.writeJSONResponse(w, response)
}

func (h *ResourceHandler) writeJSONResponse(w http.ResponseWriter, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    if err := json.NewEncoder(w).Encode(data); err != nil {
        h.logger.Error("Failed to encode JSON response", "error", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
    }
}
```

### Variable Interpolation Implementation

```typescript
export class VariableInterpolationService {
  constructor(private templateSrv = getTemplateSrv()) {}

  interpolateQuery(query: MyQuery, scopedVars: ScopedVars): MyQuery {
    try {
      return {
        ...query,
        queryText: this.templateSrv.replace(query.queryText || '', scopedVars),
        label: this.templateSrv.replace(query.label || '', scopedVars),
      };
    } catch (error) {
      console.error('Variable interpolation failed:', error);
      // Return original query as fallback
      return query;
    }
  }

  interpolateLabel(label: string, scopedVars: ScopedVars): string {
    try {
      return this.templateSrv.replace(label, scopedVars);
    } catch (error) {
      console.error('Label interpolation failed:', error);
      return label; // Fallback to original label
    }
  }

  formatMultiValue(values: string[], format: string): string {
    switch (format) {
      case 'csv':
        return values.join(',');
      case 'pipe':
        return values.join('|');
      case 'json':
        return JSON.stringify(values);
      case 'lucene':
        return `(${values.map(v => `"${v}"`).join(' OR ')})`;
      default:
        return values.join(',');
    }
  }
}
```

### Explore Mode Support

```typescript
// ExploreQueryEditor.tsx
export const ExploreQueryEditor: React.FC<QueryEditorProps> = (props) => {
  const { query, onChange, onRunQuery } = props;
  
  return (
    <div className="explore-query-editor">
      <InlineField label="Query" grow>
        <CodeEditor
          value={query.queryText || ''}
          language="datadog"
          onBlur={(value) => onChange({ ...query, queryText: value })}
          getSuggestions={(model, position) => {
            // Enhanced autocomplete with variable support
            return generateSuggestionsWithVariables(model.getValue(), position);
          }}
        />
      </InlineField>
      
      <InlineField label="Variables Help">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowHelp(!showHelp)}
          icon="question-circle"
        >
          Variable Examples
        </Button>
      </InlineField>
      
      {showHelp && <QueryEditorHelp onClickExample={onChange} />}
    </div>
  );
};
```

### Logging Implementation

```go
// Enhanced logging with structured fields
func (h *ResourceHandler) logRequest(ctx context.Context, endpoint string, duration time.Duration, err error) {
    pCtx := backend.PluginConfigFromContext(ctx)
    
    fields := []interface{}{
        "endpoint", endpoint,
        "duration", duration,
        "user", pCtx.User.Login,
        "datasource", pCtx.DataSourceInstanceSettings.Name,
        "traceID", getTraceID(ctx),
    }
    
    if err != nil {
        fields = append(fields, "error", err.Error())
        h.logger.Error("Resource request failed", fields...)
    } else {
        h.logger.Info("Resource request completed", fields...)
    }
}
```

## Performance Considerations

1. **Caching Strategy**:
   - 5-minute TTL for variable queries
   - LRU cache with 1000 entry limit
   - Cache invalidation on datasource config changes

2. **Request Optimization**:
   - Debounce variable query requests (500ms)
   - Parallel loading of independent variables
   - Request deduplication for identical queries

3. **Memory Management**:
   - Limit variable option count to 1000 items
   - Streaming JSON parsing for large responses
   - Garbage collection of unused cache entries

4. **Network Efficiency**:
   - HTTP/2 connection reuse
   - Gzip compression for responses
   - Request timeout of 30 seconds

## Security Considerations

1. **Input Validation**:
   - Sanitize all variable values before interpolation
   - Validate query parameters against allowed patterns
   - Prevent injection attacks through variable values

2. **Authentication**:
   - Validate Datadog API credentials for each request
   - Use secure credential storage
   - Handle authentication errors gracefully

3. **Rate Limiting**:
   - Respect Datadog API rate limits
   - Implement client-side rate limiting
   - Provide clear feedback on rate limit hits

## Migration and Compatibility

This implementation is designed to be fully backward compatible:

1. **Existing Queries**: All existing queries continue to work unchanged
2. **New Features**: Variable support is opt-in through variable creation
3. **API Compatibility**: No breaking changes to existing datasource API
4. **Configuration**: No changes required to existing datasource configurations

The implementation follows Grafana's plugin development best practices and integrates seamlessly with the existing codebase.