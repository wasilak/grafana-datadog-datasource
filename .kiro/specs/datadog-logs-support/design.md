# Design Document: Datadog Logs Support

## Overview

This design document outlines the implementation of logs query support for the Grafana Datadog datasource plugin. The implementation will extend the existing plugin architecture to support Datadog's Logs Search API while maximally reusing existing patterns for authentication, error handling, caching, and user interface components.

The design follows Grafana's plugin development best practices and leverages the existing infrastructure to ensure consistency and maintainability. The logs functionality will be seamlessly integrated with the current metrics implementation, sharing common components and patterns while providing logs-specific features.

## Architecture

### High-Level Architecture

The logs support will be implemented as an extension to the existing datasource architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Grafana Frontend                         │
├─────────────────────────────────────────────────────────────┤
│  Query Editor (Existing)     │  Logs Query Editor (New)    │
│  - CodeEditor component      │  - Reuses CodeEditor        │
│  - Autocomplete system       │  - Extends autocomplete     │
│  - Variable interpolation    │  - Reuses interpolation     │
├─────────────────────────────────────────────────────────────┤
│              DataSource Class (Extended)                   │
│  - QueryData method          │  - Logs query detection     │
│  - Metrics API calls         │  - Logs API calls           │
│  - Error handling            │  - Shared error patterns    │
├─────────────────────────────────────────────────────────────┤
│                Backend Plugin (Extended)                   │
│  - Metrics handlers          │  - Logs handlers            │
│  - Resource endpoints        │  - Logs autocomplete        │
│  - Authentication            │  - Shared auth patterns     │
├─────────────────────────────────────────────────────────────┤
│                   Datadog APIs                             │
│  - Metrics API v2            │  - Logs API v2              │
│  - /metrics/query            │  - /logs/events/search      │
└─────────────────────────────────────────────────────────────┘
```

### Query Type Detection

The system will automatically detect whether to use logs or metrics functionality based on Grafana's panel context:

1. **Panel Type Detection**: Use Grafana's panel metadata to determine if the query should be treated as logs or metrics
2. **Query Routing**: Route queries to appropriate API endpoints based on detected type
3. **UI Adaptation**: Show appropriate query editor interface based on context

### Data Flow

```
User Input → Query Type Detection → API Selection → Data Processing → Grafana Display
     ↓              ↓                    ↓              ↓              ↓
Query Editor → Panel Context → Logs/Metrics API → Data Frames → Logs/Graph Panel
```

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

#### LogsDataFrame Structure

```typescript
interface LogsDataFrame extends DataFrame {
  name: string;
  fields: [
    {
      name: 'timestamp';
      type: FieldType.time;
      values: number[];         // Unix timestamps in milliseconds
    },
    {
      name: 'message';
      type: FieldType.string;
      values: string[];         // Log message content
    },
    {
      name: 'level';
      type: FieldType.string;
      values: string[];         // Log levels (DEBUG, INFO, WARN, ERROR, FATAL)
    },
    {
      name: 'service';
      type: FieldType.string;
      values: string[];         // Service names
    },
    {
      name: 'source';
      type: FieldType.string;
      values: string[];         // Log sources
    }
  ];
  meta: {
    type: FrameType.LogLines;  // Indicate this is log data
    preferredVisualisationType: 'logs';
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

#### Log Entry Model

```go
type LogEntry struct {
    ID         string                 `json:"id"`
    Timestamp  time.Time             `json:"timestamp"`
    Message    string                `json:"message"`
    Level      string                `json:"level"`
    Service    string                `json:"service,omitempty"`
    Source     string                `json:"source,omitempty"`
    Tags       map[string]string     `json:"tags,omitempty"`
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

**Property 3: Logs Data Frame Structure**
*For any* logs API response, the system should create a properly structured data frame with timestamp, message, level, service, and source fields, with appropriate metadata for Grafana's logs panel
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