# API Reference

This document describes the internal APIs and interfaces used by the Grafana Datadog datasource plugin.

## Backend API Endpoints

The plugin backend exposes several resource endpoints for frontend communication.

### Base URL Pattern

All resource endpoints follow this pattern:
```
/api/datasources/uid/{datasource-uid}/resources/{endpoint}
```

### Authentication

All requests are authenticated using the datasource's configured API and App keys. The frontend never handles credentials directly.

## Autocomplete Endpoints

### Metrics Autocomplete

#### Get Metric Names
```http
GET /autocomplete/metrics
```

**Response:**
```json
{
  "data": [
    "system.cpu.user",
    "system.memory.used",
    "container.cpu.usage"
  ]
}
```

#### Get Tag Names
```http
GET /autocomplete/tags?metric={metric_name}
```

**Parameters:**
- `metric` (optional): Filter tags by metric

**Response:**
```json
{
  "data": [
    "host",
    "service",
    "env",
    "availability_zone"
  ]
}
```

#### Get Tag Values
```http
GET /autocomplete/tag-values/{tag_name}?metric={metric_name}
```

**Parameters:**
- `tag_name` (required): Tag name to get values for
- `metric` (optional): Filter values by metric

**Response:**
```json
{
  "data": [
    "web-01",
    "web-02",
    "db-01"
  ]
}
```

### Logs Autocomplete

#### Get Log Services
```http
GET /autocomplete/logs/services
```

**Response:**
```json
{
  "data": [
    "web-app",
    "api-service",
    "database"
  ]
}
```

#### Get Log Sources
```http
GET /autocomplete/logs/sources
```

**Response:**
```json
{
  "data": [
    "nginx",
    "postgresql",
    "kubernetes"
  ]
}
```

#### Get Log Levels
```http
GET /autocomplete/logs/levels
```

**Response:**
```json
{
  "data": [
    "DEBUG",
    "INFO",
    "WARN",
    "ERROR",
    "FATAL"
  ]
}
```

#### Get Log Fields
```http
GET /autocomplete/logs/fields
```

**Response:**
```json
{
  "data": [
    "service",
    "source",
    "status",
    "host",
    "@env",
    "@version"
  ]
}
```

#### Get Log Field Values
```http
GET /autocomplete/logs/field-values/{field_name}
```

**Parameters:**
- `field_name` (required): Field name to get values for

**Response:**
```json
{
  "data": [
    "production",
    "staging",
    "development"
  ]
}
```

#### Get Log Tags
```http
GET /autocomplete/logs/tags
```

**Response:**
```json
{
  "data": [
    "service",
    "env",
    "version",
    "pod_name"
  ]
}
```

#### Get Log Tag Values
```http
GET /autocomplete/logs/tag-values/{tag_name}
```

**Parameters:**
- `tag_name` (required): Tag name to get values for

**Response:**
```json
{
  "data": [
    "v1.2.3",
    "v1.2.4",
    "v1.3.0"
  ]
}
```

## Variable Query Endpoints

### Metric Find Query
```http
POST /variable-query
Content-Type: application/json

{
  "query": "tag_values(system.cpu.user, host)",
  "range": {
    "from": "2023-01-01T00:00:00Z",
    "to": "2023-01-01T23:59:59Z"
  }
}
```

**Response:**
```json
{
  "data": [
    {
      "text": "web-01",
      "value": "web-01"
    },
    {
      "text": "web-02", 
      "value": "web-02"
    }
  ]
}
```

## Frontend API Interfaces

### DataSource Class

The main datasource class implements Grafana's `DataSourceApi` interface.

```typescript
class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  // Query execution
  query(request: DataQueryRequest<MyQuery>): Observable<DataQueryResponse>;
  
  // Health check
  testDatasource(): Promise<TestDataSourceResponse>;
  
  // Variable queries
  metricFindQuery(query: VariableQuery): Promise<MetricFindValue[]>;
  
  // Supplementary queries
  getSupplementaryQuery(type: SupplementaryQueryType, query: MyQuery): MyQuery;
  
  // Resource calls
  getResource(path: string, params?: any): Promise<any>;
}
```

### Query Interface

```typescript
interface MyQuery extends DataQuery {
  // Query identification
  refId: string;
  queryType?: 'logs' | 'metrics';
  
  // Metrics query fields
  query?: string;           // Datadog metrics query
  expression?: string;      // Formula expression
  legendFormat?: string;    // Custom legend template
  
  // Logs query fields  
  logQuery?: string;        // Datadog logs search query
  
  // Common fields
  hide?: boolean;           // Hide query from legend
  intervalMs?: number;      // Query interval
  maxDataPoints?: number;   // Maximum data points
}
```

### Configuration Interface

```typescript
interface MyDataSourceOptions extends DataSourceJsonData {
  site?: string;            // Datadog site (datadoghq.com or datadoghq.eu)
}

interface MySecureJsonData {
  apiKey?: string;          // Datadog API key
  appKey?: string;          // Datadog App key
}
```

## Autocomplete System API

### Query Context Interface

```typescript
interface QueryContext {
  contextType: ContextType;
  currentToken: string;
  cursorPosition: number;
  nearestFacet?: string;
  existingTags: Set<string>;
}

type ContextType = 
  | 'metric' 
  | 'aggregation' 
  | 'tag' 
  | 'tag_value'
  | 'logs_search'
  | 'logs_facet'
  | 'logs_service'
  | 'logs_source'
  | 'logs_level';
```

### Completion Item Interface

```typescript
interface CompletionItem {
  name: string;
  detail?: string;
  documentation?: string;
  kind?: CompletionItemKind;
  insertText?: string;
  filterText?: string;
  sortText?: string;
}

type CompletionItemKind = 
  | 'metric'
  | 'aggregation' 
  | 'tag'
  | 'tag_value'
  | 'logs_service'
  | 'logs_source'
  | 'logs_level'
  | 'logs_facet'
  | 'logs_operator';
```

### Autocomplete Hook API

```typescript
interface UseQueryAutocompleteProps {
  datasource: DataSource;
  queryType?: 'metrics' | 'logs';
  onSuggestionSelected?: (suggestion: CompletionItem) => void;
}

interface UseQueryAutocompleteResult {
  suggestions: CompletionItem[];
  loading: boolean;
  error: string | null;
  getSuggestions: (query: string, position: number) => Promise<CompletionItem[]>;
}

function useQueryAutocomplete(props: UseQueryAutocompleteProps): UseQueryAutocompleteResult;
```

## Backend Go Interfaces

### Main Datasource Interface

```go
type Datasource struct {
    // Configuration
    JSONData       map[string]interface{}
    SecureJSONData map[string]string
    
    // Caching
    cache                 map[string]*CacheEntry
    logsCache            map[string]*LogsCacheEntry
    logsAutocompleteCache map[string]*LogsAutocompleteCacheEntry
    
    // Concurrency control
    cacheMu           sync.Mutex
    logsCacheMu       sync.Mutex
    logsAutocompleteMu sync.Mutex
}

// Main plugin interfaces
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error)
func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error
```

### Query Model Interface

```go
type QueryModel struct {
    // Common fields
    RefID         string `json:"refId"`
    QueryType     string `json:"queryType,omitempty"`
    Hide          bool   `json:"hide,omitempty"`
    IntervalMs    int64  `json:"intervalMs,omitempty"`
    MaxDataPoints int64  `json:"maxDataPoints,omitempty"`
    
    // Metrics fields
    Query        string `json:"query,omitempty"`
    Expression   string `json:"expression,omitempty"`
    LegendFormat string `json:"legendFormat,omitempty"`
    
    // Logs fields
    LogQuery string `json:"logQuery,omitempty"`
}
```

### Cache Interfaces

```go
type CacheEntry struct {
    Data      []byte
    Timestamp time.Time
}

type LogsCacheEntry struct {
    LogEntries []LogEntry
    NextCursor string
    Timestamp  time.Time
}

type LogsAutocompleteCacheEntry struct {
    Data      []string
    Timestamp time.Time
}

// Cache methods
func (d *Datasource) GetCachedEntry(key string, ttl time.Duration) *CacheEntry
func (d *Datasource) SetCachedEntry(key string, data []byte)
func (d *Datasource) GetCachedLogsEntry(key string, ttl time.Duration) *LogsCacheEntry
func (d *Datasource) SetCachedLogsEntry(key string, logEntries []LogEntry, nextCursor string)
```

### Logs API Structures

```go
// Logs search request
type LogsSearchRequest struct {
    Data LogsSearchData `json:"data"`
}

type LogsSearchData struct {
    Type          string                `json:"type"`
    Attributes    LogsSearchAttributes  `json:"attributes"`
    Relationships *LogsRelationships    `json:"relationships,omitempty"`
}

type LogsSearchAttributes struct {
    Query string   `json:"query"`
    Time  LogsTime `json:"time"`
    Sort  string   `json:"sort"`
    Limit int      `json:"limit"`
}

// Logs response
type LogsResponse struct {
    Data []map[string]interface{} `json:"data"`
    Meta LogsResponseMeta         `json:"meta,omitempty"`
}

type LogEntry struct {
    ID         string                 `json:"id"`
    Timestamp  time.Time             `json:"timestamp"`
    Message    string                `json:"message"`
    Level      string                `json:"level"`
    Service    string                `json:"service"`
    Source     string                `json:"source"`
    Host       string                `json:"host"`
    Attributes map[string]interface{} `json:"attributes"`
    Tags       map[string]string      `json:"tags"`
}
```

### Request Builder Interfaces

```go
type DatadogLogsRequestBuilder struct {
    apiKey  string
    appKey  string
    baseURL string
}

type LogsSearchRequestParams struct {
    Query     string
    From      int64
    To        int64
    Cursor    string
    PageSize  int
}

func (b *DatadogLogsRequestBuilder) BuildLogsSearchRequest(ctx context.Context, params LogsSearchRequestParams) (*http.Request, error)
func (b *DatadogLogsRequestBuilder) ValidateCredentials() error
```

### Response Parser Interfaces

```go
type LogsResponseParser struct {
    datasource *Datasource
}

func (p *LogsResponseParser) ParseResponse(apiResponse interface{}, refID string, query string) (data.Frames, error)
func (p *LogsResponseParser) createLogsDataFrames(logEntries []LogEntry, refID string, query string) data.Frames
func (p *LogsResponseParser) createLogsVolumeFrame(logEntries []LogEntry, refID string, timeRange backend.TimeRange) *data.Frame
```

## Error Handling API

### Frontend Error Interface

```typescript
interface QueryError {
  message: string;
  refId?: string;
  cancelled?: boolean;
}

interface DataQueryResponse {
  data: DataFrame[];
  error?: QueryError;
  key?: string;
  state?: LoadingState;
}
```

### Backend Error Handling

```go
// Error response creation
func (d *Datasource) handleError(err error, refID string) backend.DataResponse {
    return backend.ErrDataResponse(
        backend.StatusBadRequest,
        d.parseDatadogError(err),
    )
}

// Error parsing
func (d *Datasource) parseDatadogError(err error) string {
    // Convert API errors to user-friendly messages
}

// Logs-specific error parsing
func (d *Datasource) parseLogsError(err error, httpStatus int, responseBody string) string {
    // Handle logs API specific errors
}
```

## Variable Query API

### Variable Query Interface

```typescript
interface VariableQuery {
  query: string;
  refId: string;
}

interface MetricFindValue {
  text: string;
  value: string;
  expandable?: boolean;
}
```

### Variable Query Functions

```go
// Backend variable query handling
func (d *Datasource) handleVariableQuery(ctx context.Context, query string) ([]backend.MetricFindValue, error)

// Supported query patterns:
// - tag_values(metric, tag)
// - tag_values(metric, tag, filter)
// - metrics(pattern)
// - tag_names(metric)
```

## Testing API

### Mock Interfaces

```typescript
// Frontend mocks
interface MockDataSource extends Partial<DataSource> {
  query: jest.MockedFunction<DataSource['query']>;
  testDatasource: jest.MockedFunction<DataSource['testDatasource']>;
  getResource: jest.MockedFunction<DataSource['getResource']>;
}

function createMockDataSource(): MockDataSource;
```

```go
// Backend mocks
type MockDatadogAPI struct {
    responses map[string]interface{}
    errors    map[string]error
}

func (m *MockDatadogAPI) QueryMetrics(ctx context.Context, query string) (interface{}, error)
func (m *MockDatadogAPI) QueryLogs(ctx context.Context, query string) (interface{}, error)
```

## Configuration API

### Datasource Configuration

```typescript
interface ConfigEditorProps {
  options: DataSourcePluginOptionsEditorProps<MyDataSourceOptions>;
  onOptionsChange: (options: DataSourcePluginOptionsEditorProps<MyDataSourceOptions>) => void;
}

interface DataSourceSettings<T extends DataSourceJsonData = DataSourceJsonData, S = {}> {
  id: number;
  uid: string;
  orgId: number;
  name: string;
  type: string;
  access: string;
  url: string;
  password: string;
  user: string;
  database: string;
  basicAuth: boolean;
  basicAuthUser: string;
  basicAuthPassword: string;
  withCredentials: boolean;
  isDefault: boolean;
  jsonData: T;
  secureJsonData?: S;
  secureJsonFields: KeyValue<boolean>;
  readOnly: boolean;
}
```

## Performance Monitoring API

### Metrics Collection

```go
// Performance metrics
type QueryMetrics struct {
    Duration    time.Duration
    CacheHit    bool
    QueryType   string
    ErrorCount  int
    RequestSize int64
}

func (d *Datasource) recordQueryMetrics(metrics QueryMetrics)
```

### Health Check API

```go
type HealthCheckResult struct {
    Status      backend.HealthStatus
    Message     string
    JSONDetails []byte
}

func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error)
```

## Rate Limiting API

### Concurrency Control

```go
// Rate limiting configuration
const (
    MaxConcurrentRequests = 5
    RequestTimeout       = 30 * time.Second
    CacheCleanupInterval = 5 * time.Minute
)

// Semaphore for request limiting
type RequestLimiter struct {
    semaphore chan struct{}
}

func (r *RequestLimiter) Acquire(ctx context.Context) error
func (r *RequestLimiter) Release()
```

## Debugging API

### Debug Logging

```go
// Structured logging
func (d *Datasource) logRequest(ctx context.Context, method, endpoint string, duration time.Duration) {
    logger.Info("API request completed",
        "method", method,
        "endpoint", endpoint,
        "duration", duration,
        "traceID", getTraceID(ctx),
    )
}
```

### Query Inspector Support

```typescript
interface QueryInspectorData {
  request: any;
  response: any;
  error?: any;
  stats: {
    duration: number;
    cacheHit: boolean;
    requestSize: number;
    responseSize: number;
  };
}
```

This API reference provides comprehensive documentation for developers working with or extending the Datadog datasource plugin. All interfaces and methods are designed to be type-safe, well-documented, and follow Grafana's plugin development best practices.