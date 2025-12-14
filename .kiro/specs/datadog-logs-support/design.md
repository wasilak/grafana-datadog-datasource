# Design Document: Datadog Logs Support

## Overview

This design document outlines the implementation of logs query support for the Grafana Datadog datasource plugin. The implementation will extend the existing plugin architecture to support Datadog's Logs Search API while maximally reusing existing patterns for authentication, error handling, caching, and user interface components.

**CRITICAL UPDATE**: After reviewing the official Grafana logs data source tutorial, we've identified fundamental architectural issues in our current implementation that must be fixed. The pagination caching problems are symptoms of Grafana not properly recognizing our data as logs due to incorrect field structure.

The design follows Grafana's plugin development best practices and leverages the existing infrastructure to ensure consistency and maintainability. The logs functionality will be seamlessly integrated with the current metrics implementation, sharing common components and patterns while providing logs-specific features.

## Critical Architectural Fixes Required

### 🚨 Root Cause Analysis
The pagination and caching issues we've been experiencing are caused by **incorrect data frame structure**, not actual caching problems. Grafana expects specific field names and structure for logs data sources:

1. **Field Names**: Must use `body` (not `message`), `severity` (not `level`)
2. **Labels Structure**: Must use single `labels` field with JSON (not separate fields)
3. **Metadata**: Must use `PreferredVisualization: "logs"` directly (not in custom meta)

### 🔧 Immediate Fixes Needed
1. ✅ **Plugin Configuration**: Added `"logs": true` and `"streaming": true` to plugin.json
2. ❌ **Data Frame Structure**: Must rewrite `createLogsDataFrames()` function completely
3. ❌ **Frontend Caching**: Remove complex frontend caching system (likely unnecessary)
4. ❌ **Enhanced Features**: Add search highlighting, filtering, and trace linking

## Architecture

### Architectural Insights from OpenSearch Analysis

After analyzing the OpenSearch datasource implementation, we've identified several sophisticated patterns that should be incorporated into our design:

1. **Query Handler Pattern**: Clean separation of different query types using a common interface
2. **Request Builder Pattern**: Abstracted API request construction with proper authentication handling
3. **Response Parser Pattern**: Dedicated classes for converting API responses to Grafana data frames
4. **Context-Aware Autocomplete**: Advanced completion providers with cursor position analysis

These patterns will significantly improve maintainability, testability, and user experience.

### High-Level Architecture

The logs support will be implemented as an extension to the existing datasource architecture, incorporating proven patterns from the OpenSearch implementation:

```
┌─────────────────────────────────────────────────────────────┐
│                    Grafana Frontend                         │
├─────────────────────────────────────────────────────────────┤
│  Query Editor (Enhanced)     │  Logs Query Editor (New)    │
│  - CodeEditor component      │  - Reuses CodeEditor        │
│  - Context-aware autocomplete│  - Advanced completion      │
│  - Variable interpolation    │  - Reuses interpolation     │
├─────────────────────────────────────────────────────────────┤
│              DataSource Class (Enhanced)                   │
│  - Query Handler Router      │  - Supplementary Queries    │
│  - Request Builders          │  - Response Parsers         │
│  - Configuration Management  │  - Advanced Error Handling  │
├─────────────────────────────────────────────────────────────┤
│                Backend Plugin (Enhanced)                   │
│  - MetricsHandler            │  - LogsHandler              │
│  - Request Builders          │  - Response Parsers         │
│  - Resource endpoints        │  - Comprehensive Testing    │
│  - Authentication            │  - Configuration Options    │
├─────────────────────────────────────────────────────────────┤
│                   Datadog APIs                             │
│  - Metrics API v2            │  - Logs API v2              │
│  - /metrics/query            │  - /logs/events/search      │
│  - /metrics/autocomplete     │  - /logs/aggregate          │
└─────────────────────────────────────────────────────────────┘
```

### Query Type Detection

The system will automatically detect whether to use logs or metrics functionality based on Grafana's panel context:

1. **Panel Type Detection**: Use Grafana's panel metadata to determine if the query should be treated as logs or metrics
2. **Query Routing**: Route queries to appropriate API endpoints based on detected type
3. **UI Adaptation**: Show appropriate query editor interface based on context

### Enhanced Data Flow (Based on OpenSearch Patterns)

```
User Input → Query Handler Router → Request Builder → API Call → Response Parser → Data Frames
     ↓              ↓                    ↓              ↓              ↓              ↓
Query Editor → MetricsHandler/     → DatadogRequest → Datadog → LogsResponse → Grafana
              LogsHandler            Builder          API       Parser        Display
```

### Key Architectural Patterns

#### 1. Query Handler Pattern
Following OpenSearch's approach, we'll implement a clean handler architecture:
- **QueryHandler Interface**: Common interface for all query types
- **MetricsHandler**: Handles existing metrics queries
- **LogsHandler**: Handles new logs queries
- **Router**: Routes queries to appropriate handlers based on type

#### 2. Request Builder Pattern
Abstract API request construction for maintainability:
- **DatadogRequestBuilder**: Base class with common authentication
- **DatadogLogsRequestBuilder**: Logs-specific request construction
- **DatadogMetricsRequestBuilder**: Metrics-specific request construction

#### 3. Response Parser Pattern
Separate response processing from query handling:
- **ResponseParser Interface**: Common parsing interface
- **LogsResponseParser**: Converts Datadog logs responses to Grafana data frames
- **MetricsResponseParser**: Handles metrics response parsing



## Components and Interfaces

### Frontend Components

#### 1. Enhanced DataSource Class

**Location**: `src/datasource.ts`

**Extensions**:
- Add logs query detection logic in `QueryData` method
- Extend `applyTemplateVariables` to handle logs-specific variable interpolation
- Add logs query validation in `filterQuery` method

```typescript
interface LogsQuery extends MyQuery {
  queryType: 'logs';
  logQuery: string;
  indexes?: string[];
  realTime?: boolean;
}

class DataSource extends DataSourceWithBackend<MyQuery | LogsQuery, MyDataSourceOptions> {
  // Existing methods...
  
  // Enhanced to detect logs vs metrics queries
  async query(request: DataQueryRequest<MyQuery | LogsQuery>): Promise<DataQueryResponse> {
    // Query type detection and routing logic
  }
  
  // Extended to handle logs variable interpolation
  applyTemplateVariables(query: MyQuery | LogsQuery, scopedVars: ScopedVars): MyQuery | LogsQuery {
    // Reuse existing logic with logs extensions
  }
}
```

#### 2. Logs Query Editor Component

**Location**: `src/LogsQueryEditor.tsx` (new file)

**Purpose**: Provide logs-specific query interface while reusing existing components

```typescript
interface LogsQueryEditorProps {
  query: LogsQuery;
  onChange: (query: LogsQuery) => void;
  onRunQuery: () => void;
  datasource: DataSource;
}

export const LogsQueryEditor: React.FC<LogsQueryEditorProps> = ({
  query,
  onChange,
  onRunQuery,
  datasource,
}) => {
  // Reuse existing CodeEditor component
  // Extend existing autocomplete system
  // Integrate with existing help system
};
```

#### 3. Enhanced Query Editor

**Location**: `src/QueryEditor.tsx`

**Extensions**:
- Add query type detection based on panel context
- Conditionally render logs or metrics editor
- Maintain backward compatibility

```typescript
export const QueryEditor: React.FC<QueryEditorProps> = (props) => {
  const isLogsPanel = detectLogsPanel(props);
  
  if (isLogsPanel) {
    return <LogsQueryEditor {...props} />;
  }
  
  // Existing metrics query editor
  return <MetricsQueryEditor {...props} />;
};
```

#### 4. Extended Autocomplete System

**Location**: `src/hooks/useQueryAutocomplete.ts`

**Extensions**:
- Add logs-specific suggestion types (services, sources, levels)
- Extend existing suggestion grouping for logs context
- Reuse existing debouncing and caching patterns

### Backend Components

#### 1. Enhanced Datasource Plugin

**Location**: `pkg/plugin/datasource.go`

**Extensions**:
- Add logs query detection in `QueryData` method
- Implement Datadog Logs API integration
- Extend existing error handling patterns

```go
// Add to existing QueryModel struct
type QueryModel struct {
    // Existing fields...
    QueryType string `json:"queryType,omitempty"` // "metrics" or "logs"
    LogQuery  string `json:"logQuery,omitempty"`  // Logs search query
    Indexes   []string `json:"indexes,omitempty"` // Target log indexes
}

// Enhanced QueryData method
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
    // Detect query type and route appropriately
    for _, q := range req.Queries {
        var qm QueryModel
        json.Unmarshal(q.JSON, &qm)
        
        if qm.QueryType == "logs" {
            return d.queryLogs(ctx, req)
        }
        // Existing metrics logic...
    }
}
```

#### 2. Logs API Integration

**Location**: `pkg/plugin/logs.go` (new file)

**Purpose**: Handle Datadog Logs API interactions using the exact Datadog Logs Search API v2

**API Endpoint**: `POST https://api.datadoghq.com/api/v2/logs/events/search`

**Authentication**: Uses existing Datadog credentials:
- `DD-API-KEY`: API key from datasource configuration
- `DD-APPLICATION-KEY`: Application key from datasource configuration

```go
// queryLogs executes logs queries against Datadog's Logs API v2
func (d *Datasource) queryLogs(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
    // Construct request body matching Datadog's exact format:
    // {
    //   "data": {
    //     "type": "search_request",
    //     "attributes": {
    //       "query": "service:web-app-production status:error",
    //       "time": {"from": "now-1h", "to": "now"},
    //       "sort": "timestamp",
    //       "limit": 10
    //     }
    //   }
    // }
    
    // Reuse existing authentication setup (DD-API-KEY, DD-APPLICATION-KEY)
    // Reuse existing timeout and context patterns (30 second timeout)
    // Reuse existing error handling patterns
    // Handle pagination using meta.page.after cursor
}
```

#### 3. Logs Resource Handlers

**Location**: `pkg/plugin/datasource.go` (extensions)

**Purpose**: Provide autocomplete data for logs queries

```go
// Add to existing CallResource method
func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
    switch {
    // Existing handlers...
    case req.Method == "GET" && req.Path == "autocomplete/logs/services":
        return d.LogsServicesHandler(ctx, req, sender)
    case req.Method == "GET" && req.Path == "autocomplete/logs/sources":
        return d.LogsSourcesHandler(ctx, req, sender)
    // ...
    }
}
```

## Data Models

### Frontend Data Models

#### LogsQuery Interface

```typescript
interface LogsQuery extends DataQuery {
  queryType: 'logs';
  logQuery: string;           // Datadog logs search query
  indexes?: string[];         // Target log indexes
  realTime?: boolean;         // Enable real-time streaming
  
  // Inherited from DataQuery
  refId: string;
  hide?: boolean;
  key?: string;
  queryType?: string;
  datasource?: DataSourceRef;
}
```

#### LogsDataFrame Structure (CORRECTED - Based on Official Grafana Tutorial)

```typescript
interface LogsDataFrame extends DataFrame {
  name: string;
  fields: [
    {
      name: 'timestamp';        // ✅ CORRECT - Official standard
      type: FieldType.time;
      values: number[];         // Unix timestamps in milliseconds
    },
    {
      name: 'body';            // ✅ CORRECT - Changed from 'message' to 'body'
      type: FieldType.string;
      values: string[];         // Log message content
    },
    {
      name: 'severity';        // ✅ CORRECT - Changed from 'level' to 'severity'
      type: FieldType.string;
      values: string[];         // Log levels (DEBUG, INFO, WARN, ERROR, FATAL)
    },
    {
      name: 'id';             // ✅ CORRECT - Log entry ID
      type: FieldType.string;
      values: string[];         // Unique log entry identifiers
    },
    {
      name: 'labels';         // ✅ CORRECT - Single labels field with JSON
      type: FieldType.other;
      values: json.RawMessage[]; // All metadata as JSON: service, source, host, env, tags, attributes
    }
  ];
  meta: {
    type: FrameType.LogLines;           // ✅ CORRECT - Indicate this is log data
    PreferredVisualization: 'logs';     // ✅ CORRECT - Direct property, not custom
    searchWords?: string[];             // ✅ NEW - For search highlighting
    limit?: number;                     // ✅ NEW - For pagination
  };
}
```

### Backend Data Models

#### Datadog Logs API Models

Based on Datadog's Logs Search API v2 (`POST /api/v2/logs/events/search`):

```go
// LogsSearchRequest matches Datadog's exact API structure
type LogsSearchRequest struct {
    Data LogsSearchData `json:"data"`
}

type LogsSearchData struct {
    Type       string                `json:"type"`       // Must be "search_request"
    Attributes LogsSearchAttributes  `json:"attributes"`
    Relationships *LogsRelationships `json:"relationships,omitempty"` // For pagination
}

type LogsSearchAttributes struct {
    Query string    `json:"query"`           // Search query (e.g., "service:web-app-production status:error")
    Time  LogsTime  `json:"time"`            // Time range
    Sort  string    `json:"sort,omitempty"`  // Sort field (usually "timestamp")
    Limit int       `json:"limit,omitempty"` // Max results per page (max 1000)
}

type LogsTime struct {
    From string `json:"from"` // Start time (e.g., "now-1h" or timestamp)
    To   string `json:"to"`   // End time (e.g., "now" or timestamp)
}

type LogsRelationships struct {
    Page LogsPageRelation `json:"page"`
}

type LogsPageRelation struct {
    Data LogsPageData `json:"data"`
}

type LogsPageData struct {
    Type string `json:"type"` // "page_data"
    ID   string `json:"id"`   // Cursor from previous response
}
```

#### Log Entry Model (CORRECTED)

```go
type LogEntry struct {
    ID         string                 `json:"id"`
    Timestamp  time.Time             `json:"timestamp"`
    Body       string                `json:"body"`       // ✅ CORRECT - Changed from Message
    Severity   string                `json:"severity"`   // ✅ CORRECT - Changed from Level
    Labels     json.RawMessage       `json:"labels"`     // ✅ CORRECT - All metadata as JSON
}

// Helper struct for building labels JSON
type LogLabels struct {
    Service    string            `json:"service,omitempty"`
    Source     string            `json:"source,omitempty"`
    Host       string            `json:"host,omitempty"`
    Env        string            `json:"env,omitempty"`
    Tags       map[string]string `json:"tags,omitempty"`
    Attributes map[string]interface{} `json:"attributes,omitempty"`
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all the properties identified in the prework analysis, I've identified several areas where properties can be consolidated or where one property implies another:

**Redundancy Elimination:**
- Properties 6.2 and 6.3 (authentication and time range reuse) are subsumed by the broader property 6.1 (API integration reuse)
- Properties 9.1, 9.4, and 9.5 (variable interpolation patterns) can be combined into a comprehensive variable handling property
- Properties 10.2, 10.3, and 10.5 (timeout, loading states, rate limits) are all aspects of the broader performance pattern reuse
- Properties 12.1, 12.4, and 12.5 (various error types) can be consolidated into a comprehensive error handling reuse property

**Comprehensive Properties:**
The following properties provide unique validation value and cover the essential correctness requirements:

**Property 1: Logs API Integration Consistency**
*For any* logs query, the system should use the same authentication, timeout, and error handling patterns as the existing metrics implementation
**Validates: Requirements 6.1, 6.2, 6.3, 6.5, 10.2, 10.3, 10.5, 12.1, 12.4, 12.5**

**Property 2: Query Type Detection and Routing**
*For any* panel context, the system should automatically detect whether to use logs or metrics mode and route queries to the appropriate API endpoint
**Validates: Requirements 2.1, 2.2, 2.5**

**Property 3: Logs Data Frame Structure (CORRECTED)**
*For any* logs API response, the system should create a properly structured data frame with timestamp, body, severity, id, and labels fields following Grafana's official logs data source standards, with appropriate metadata for Grafana's logs panel recognition
**Validates: Requirements 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 13.1**

**Property 4: Logs Query Parameter Handling**
*For any* logs query with search terms, facet filters, boolean operators, or time ranges, the system should correctly translate them to Datadog's logs search API format
**Validates: Requirements 1.1, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5**

**Property 5: Variable Interpolation Consistency**
*For any* logs query containing template variables, the system should reuse the existing variable interpolation patterns and safely handle multi-value variables and injection prevention
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

**Property 6: Autocomplete System Extension**
*For any* logs query context, the autocomplete system should provide appropriate suggestions for log facets, services, sources, and operators using the existing suggestion patterns
**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

**Property 7: Log Level and Service Filtering**
*For any* logs query with level or service filters, the system should apply the filters correctly and include the filtered fields in the resulting data frame
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5**

**Property 8: Pagination and Caching Consistency**
*For any* logs query returning large result sets, the system should implement pagination and caching using the same patterns as the metrics implementation
**Validates: Requirements 10.1, 10.4**

**Property 9: Error Handling Pattern Reuse**
*For any* logs API error (authentication, permissions, syntax, timeouts), the system should reuse the existing error parsing and message generation patterns
**Validates: Requirements 12.2, 12.3**

**Property 10: UI Component Reuse**
*For any* logs query interface, the system should reuse existing UI components (CodeEditor, autocomplete, help system) adapted for logs context
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Error Handling

### Error Categories

The logs implementation will reuse and extend the existing error handling patterns:

#### 1. Authentication Errors
- **Reuse**: Existing `parseDatadogError` function for 401/403 errors
- **Extension**: Add logs-specific permission scope messages (`logs_read_data`)

#### 2. Query Syntax Errors
- **Reuse**: Existing `parseDatadogErrorResponse` function structure
- **Extension**: Add logs-specific syntax validation and suggestions

#### 3. API Availability Errors
- **Reuse**: Existing HTTP status code handling
- **Extension**: Logs-specific timeout and rate limit messages

#### 4. Data Processing Errors
- **New**: Handle logs-specific data transformation errors
- **Pattern**: Follow existing error message formatting and user-friendly language

### Error Handling Flow

```
Logs API Error → Existing Error Parser → Logs-Specific Extensions → User Message
      ↓                    ↓                        ↓                    ↓
  HTTP Status → parseDatadogError() → Logs Context → Friendly Message
```

## Enhanced Features (Based on Official Tutorial)

### Search Word Highlighting
- Extract search terms from logs query
- Add `searchWords` array to frame metadata
- Grafana will automatically highlight matching words in log messages

### Log Filtering Support
- Implement `modifyQuery` method in datasource
- Support `ADD_FILTER` and `ADD_FILTER_OUT` operations
- Allow users to click log values to add/remove filters

### Trace Linking
- Extract trace IDs from Datadog log attributes
- Add data links to trace fields
- Enable seamless navigation from logs to traces

### Live Tailing (Streaming)
- Add `"streaming": true` to plugin.json (✅ Already added)
- Implement streaming query support
- Enable real-time log updates

## Testing Strategy

### Dual Testing Approach

The implementation will use both unit testing and property-based testing to ensure comprehensive coverage:

#### Unit Testing
- **Component Testing**: Test individual React components (LogsQueryEditor, enhanced QueryEditor)
- **Integration Testing**: Test logs API integration with mocked Datadog responses
- **Error Handling**: Test specific error scenarios and message formatting
- **UI Interactions**: Test autocomplete, validation, and user interactions

#### Property-Based Testing

The property-based testing will use **fast-check** (JavaScript/TypeScript) for frontend tests and **Go's testing/quick** package for backend tests, configured to run a minimum of 100 iterations per property.

**Frontend Property Tests** (using fast-check):
- **Property 2**: Query type detection across random panel contexts
- **Property 5**: Variable interpolation with random variable combinations
- **Property 6**: Autocomplete suggestions for random query contexts
- **Property 10**: UI component behavior with random inputs

**Backend Property Tests** (using testing/quick):
- **Property 1**: API integration consistency across random query parameters
- **Property 3**: Data frame structure for random API responses
- **Property 4**: Query parameter translation for random search terms
- **Property 7**: Filtering logic for random filter combinations
- **Property 8**: Pagination behavior for random result set sizes
- **Property 9**: Error handling for random error conditions

Each property-based test will be tagged with a comment explicitly referencing the correctness property:
```go
// **Feature: datadog-logs-support, Property 1: Logs API Integration Consistency**
func TestLogsAPIIntegrationConsistency(t *testing.T) {
    // Property test implementation
}
```

### Testing Framework Configuration

- **Frontend**: Jest with fast-check integration
- **Backend**: Go's built-in testing with testing/quick
- **Minimum Iterations**: 100 per property test
- **Test Organization**: Property tests grouped by component, unit tests for specific scenarios

The testing strategy ensures that both concrete examples work correctly (unit tests) and that the general correctness properties hold across all possible inputs (property tests), providing comprehensive validation of the logs functionality.

## Logs Histogram and Volume Visualization

### Overview

Based on analysis of the OpenSearch plugin implementation, Grafana provides a **Supplementary Queries** system specifically designed for logs volume histograms. This is the proper way to implement histogram support, rather than returning multiple data frames in a single query.

The implementation will use Grafana's `DataSourceWithSupplementaryQueriesSupport` interface to automatically generate histogram queries when logs are displayed in Grafana's logs panel.

### Supplementary Queries Architecture

```typescript
export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> 
  implements DataSourceWithSupplementaryQueriesSupport<MyQuery> {
  
  // Declare support for logs volume histograms
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume];
  }
  
  // Generate histogram query from logs query
  getSupplementaryQuery(options: SupplementaryQueryOptions, query: MyQuery): MyQuery | undefined {
    if (options.type === SupplementaryQueryType.LogsVolume && query.queryType === 'logs') {
      return this.createLogsVolumeQuery(query);
    }
    return undefined;
  }
  
  // Handle supplementary query requests
  getSupplementaryRequest(
    type: SupplementaryQueryType, 
    request: DataQueryRequest<MyQuery>
  ): DataQueryRequest<MyQuery> | undefined {
    if (type === SupplementaryQueryType.LogsVolume) {
      return this.getLogsVolumeDataProvider(request);
    }
    return undefined;
  }
}
```

### Logs Volume Query Generation

```typescript
private createLogsVolumeQuery(originalQuery: MyQuery): MyQuery {
  return {
    refId: `log-volume-${originalQuery.refId}`,
    queryType: 'logs-volume',
    logQuery: originalQuery.logQuery,  // Same search criteria
    // Histogram-specific parameters
    aggregation: 'count',
    bucketSize: 'auto',
    groupBy: ['@timestamp'],
  };
}
```

### Backend Implementation

The backend will handle logs volume queries separately from regular logs queries:

```go
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
    response := &backend.QueryDataResponse{
        Responses: make(map[string]backend.DataResponse),
    }
    
    for _, query := range req.Queries {
        var dataResponse backend.DataResponse
        
        switch query.QueryType {
        case "logs":
            dataResponse = d.queryLogs(ctx, query, req.PluginContext)
        case "logs-volume":
            dataResponse = d.queryLogsVolume(ctx, query, req.PluginContext)
        default:
            // Handle metrics queries...
        }
        
        response.Responses[query.RefID] = dataResponse
    }
    
    return response, nil
}
```

### Logs Volume Query Implementation

```go
func (d *Datasource) queryLogsVolume(ctx context.Context, query backend.DataQuery, pCtx backend.PluginContext) backend.DataResponse {
    // 1. Calculate appropriate bucket size based on time range
    bucketSize := calculateBucketSize(query.TimeRange)
    
    // 2. Construct Datadog Logs Aggregation API request
    aggRequest := LogsAggregationRequest{
        Query: extractLogQuery(query.JSON),
        Time: TimeRange{
            From: query.TimeRange.From.Format(time.RFC3339),
            To: query.TimeRange.To.Format(time.RFC3339),
        },
        Compute: []Compute{{Aggregation: "count"}},
        GroupBy: []GroupBy{{
            Facet: "@timestamp",
            Histogram: Histogram{Interval: bucketSize},
        }},
    }
    
    // 3. Execute aggregation API call
    response, err := d.callLogsAggregationAPI(ctx, aggRequest, pCtx)
    if err != nil {
        return backend.DataResponse{Error: err}
    }
    
    // 4. Transform response to Grafana data frame
    frame := createLogsVolumeDataFrame(response, bucketSize)
    
    return backend.DataResponse{Frames: []*data.Frame{frame}}
}
```

### Bucket Size Calculation

```go
func calculateBucketSize(timeRange backend.TimeRange) string {
    duration := timeRange.To.Sub(timeRange.From)
    
    switch {
    case duration <= time.Hour:
        return "1m"
    case duration <= 6*time.Hour:
        return "5m"
    case duration <= 24*time.Hour:
        return "15m"
    case duration <= 7*24*time.Hour:
        return "1h"
    default:
        return "4h"
    }
}
```

### Logs Volume Data Frame Structure

The logs volume query returns a separate data frame optimized for histogram visualization:

```typescript
interface LogsVolumeDataFrame extends DataFrame {
  name: 'logs-volume';
  refId: 'log-volume-A';  // Prefixed with log-volume-
  fields: [
    {
      name: 'Time';
      type: FieldType.time;
      values: number[];         // Time bucket timestamps
    },
    {
      name: 'Count';
      type: FieldType.number;
      values: number[];         // Log count per time bucket
    }
  ];
  meta: {
    preferredVisualisationType: 'graph';  // For histogram display
    custom: {
      bucketSize: string;      // '1m', '5m', '15m', '1h', 'auto'
    }
  };
}
```

### Automatic Histogram Generation

With the supplementary queries approach, **no UI controls are needed**. Grafana automatically:

1. Detects when logs queries are displayed in logs panels
2. Calls `getSupplementaryRequest()` to generate histogram queries
3. Executes both the original logs query and the histogram query
4. Displays the histogram above the logs automatically

This provides a much cleaner user experience with zero configuration required.

### Error Handling for Histogram

Histogram generation failures should not prevent log entries from being displayed:

```go
func (d *Datasource) queryLogsWithHistogram(ctx context.Context, query LogsQuery) (*backend.QueryDataResponse, error) {
    // 1. Always fetch log entries first
    logsFrame, err := d.queryLogEntries(ctx, query)
    if err != nil {
        return nil, err
    }
    
    response := &backend.QueryDataResponse{
        Responses: map[string]backend.DataResponse{
            query.RefID: {Frames: []*data.Frame{logsFrame}},
        },
    }
    
    // 2. Optionally add histogram if enabled
    if query.Histogram != nil && query.Histogram.Enabled {
        histogramFrame, err := d.generateLogsHistogram(ctx, query, timeRange)
        if err != nil {
            // Log error but continue with logs data
            log.Warn("Failed to generate histogram", "error", err)
        } else {
            response.Responses[query.RefID].Frames = append(
                response.Responses[query.RefID].Frames,
                histogramFrame,
            )
        }
    }
    
    return response, nil
}
```

### Additional Correctness Properties

**Property 10: Logs Histogram Data Frame Structure**
*For any* logs query with histogram enabled, the system should generate a properly formatted histogram data frame with time buckets and aggregated values that Grafana recognizes for histogram visualization
**Validates: Requirements 18.1, 18.2, 18.3**

**Property 11: Logs Histogram Integration Consistency**
*For any* logs query, enabling or disabling histogram should not affect the logs data frame structure or content, and histogram failures should not prevent logs from being displayed
**Validates: Requirements 18.4, 18.5**