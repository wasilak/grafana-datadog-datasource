# Tasks: Query Editor Autocomplete

## Task 0: Install official Datadog API client dependency

- [x] 0. Add @datadog/datadog-api-client dependency to package.json
  - File: package.json (modify)
  - Add @datadog/datadog-api-client to dependencies
  - Run yarn install to verify
  - Purpose: Make official client available for implementation
  - _Leverage: Existing package.json
  - _Requirements: All tasks requiring API integration (tasks 4+)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: DevOps engineer | Task: Add @datadog/datadog-api-client to package.json dependencies, run yarn install, verify dependency resolves without conflicts | Restrictions: Use latest stable version compatible with Node.js >=14 | _Leverage: package.json, yarn ecosystem | _Requirements: All tasks | Success: Dependency added, yarn.lock updated, no version conflicts, ready for subsequent tasks

## Task 1: Set up core types and interfaces

- [x] 1. Define autocomplete types in src/types.ts
  - File: src/types.ts
  - Add QueryContext, AutocompleteState, and CompletionItem interfaces
  - Purpose: Establish type safety for autocomplete feature
  - _Leverage: Existing types.ts, Grafana @grafana/data CompletionItem
  - _Requirements: All requirements use these types as foundation
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript developer specializing in Grafana plugin development | Task: Add comprehensive TypeScript interfaces to src/types.ts for the autocomplete feature (QueryContext, AutocompleteState, CompletionCache) based on the design document, extending Grafana's CompletionItem type for consistency | Restrictions: Do not modify existing interfaces, maintain backward compatibility with current query types | _Leverage: src/types.ts (existing), @grafana/data CompletionItem | _Requirements: Design section "Data Models" and "Components and Interfaces" | Success: All three interfaces compile without errors, properly typed with strict null checks, used throughout autocomplete implementation

## Task 2: Create suggestion utilities (parser, suggestions, api)

- [x] 2. Create src/utils/autocomplete/parser.ts
  - File: src/utils/autocomplete/parser.ts (new)
  - Implement parseQuery function to detect cursor context
  - Identify metric, aggregation, tag, and tag_value contexts
  - Purpose: Analyze query structure for context-aware suggestions
  - _Leverage: Pure functions, no external dependencies
  - _Requirements: Requirement 2, 3, 4 (tag, aggregation, metric suggestions)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript developer specializing in string parsing and query analysis | Task: Create src/utils/autocomplete/parser.ts with parseQuery function that analyzes Datadog query syntax, detects cursor position context (metric/aggregation/tag/tag_value), extracts metric name and existing tags based on design document structure | Restrictions: Keep function pure (no side effects), handle edge cases (empty queries, special characters, cursor at boundaries), performance target <10ms per parse | _Leverage: Design "Query Parsing" section, QueryContext interface from task 1 | _Requirements: Requirements 2, 3, 4 (context detection for suggestions) | Success: parseQuery correctly identifies all context types, handles edge cases, executes under 10ms, unit tests cover all branches

- [x] 3. Create src/utils/autocomplete/suggestions.ts
  - File: src/utils/autocomplete/suggestions.ts (new)
  - Implement generateSuggestions function
  - Create static aggregation list and filter logic
  - Purpose: Transform parsed context and API data into CompletionItems
  - _Leverage: Pure functions, CompletionItem type
  - _Requirements: Requirement 3 (aggregations), Requirement 2 (metrics), Requirement 4 (tags)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript developer specializing in suggestion algorithms | Task: Create src/utils/autocomplete/suggestions.ts with generateSuggestions function that converts parsed QueryContext and fetched data into Grafana CompletionItem array, including metric names, aggregation functions (avg, sum, min, max, count, etc.), and tag suggestions with proper filtering and sorting | Restrictions: Keep function pure, avoid duplicates in suggestions, limit to 100 items max, filter out already-used tags | _Leverage: QueryContext and CompletionItem types from task 1, parser.ts from task 2, design "Suggestion Utilities" section | _Requirements: Requirements 2, 3, 4 (all suggestion types) | Success: Suggestions are properly typed, duplicates removed, performance acceptable, all context types generate appropriate suggestions, unit tests verify filtering logic

- [x] 4. Create src/utils/autocomplete/api.ts
  - File: src/utils/autocomplete/api.ts (new)
  - Import and configure official @datadog/datadog-api-client
  - Implement fetchMetricsFromDatadog and fetchTagsForMetric functions
  - Add error handling and caching logic
  - Purpose: Fetch suggestion data from Datadog API using official client
  - _Leverage: @datadog/datadog-api-client package, AutocompleteCache interface
  - _Requirements: All suggestions require API data (Requirements 2, 3, 4)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Backend developer with Datadog API expertise | Task: Create src/utils/autocomplete/api.ts using official @datadog/datadog-api-client package (v1 MetricsApi, TagsApi) to fetch metric names and tags with 2-second timeout, implement 30-second TTL cache, handle 401/403 auth errors gracefully, and cancel in-flight requests on unmount | Restrictions: Must use official client not HTTP calls, timeout must be enforced with AbortController, cache TTL exactly 30 seconds | _Leverage: @datadog/datadog-api-client (MetricsApi.listMetrics, TagsApi.listHostTags), datasource configuration for auth, design "Datadog API Integration" section | _Requirements: Requirements 2, 3, 4 (metric, aggregation, tag data fetching), Requirement 1 (debounce triggers these calls) | Success: Official client properly configured with timeouts, caching works correctly with TTL, auth errors handled gracefully, all functions typed and tested

## Task 3: Implement useQueryAutocomplete hook

- [x] 5. Create src/hooks/useQueryAutocomplete.ts
  - File: src/hooks/useQueryAutocomplete.ts (new)
  - Implement React hook with debounce, state management, API orchestration
  - Handle keyboard navigation (arrow up/down, escape, enter, tab)
  - Purpose: Manage autocomplete state, debouncing, and UI interactions
  - _Leverage: React hooks (useState, useEffect, useCallback, useRef), debounce utilities
  - _Requirements: Requirement 1 (debounce), Requirements 2-4 (data fetching), Requirement 6 (keyboard navigation)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React developer specializing in custom hooks and state management | Task: Create src/hooks/useQueryAutocomplete.ts hook managing debounced autocomplete with 300-500ms delay, handling useState for suggestions/loading/errors, implementing keyboard navigation (arrow up/down cycles through items, Enter/Tab selects, Escape closes), canceling in-flight requests on debounce reschedule, and integrating parser/suggestions/api utilities from previous tasks | Restrictions: Debounce duration 300-500ms exactly as per design, max 5 concurrent requests, handle race conditions from multiple API calls | _Leverage: useQueryAutocomplete interface from design, parser.ts, suggestions.ts, api.ts from tasks 2-4, useCallback/useRef for debounce | _Requirements: Requirements 1, 2, 3, 4, 6 (debounce, all suggestions, keyboard nav) | Success: Debounce works reliably (tested with keystroke sequences), keyboard navigation responsive and intuitive, loading states display correctly, race conditions handled, hook integrates all utilities seamlessly

## Task 4: Refactor QueryEditor component to functional hooks

- [x] 6. Refactor src/components/QueryEditor.tsx
  - File: src/components/QueryEditor.tsx (modify existing)
  - Convert PureComponent class to functional component with hooks
  - Integrate useQueryAutocomplete hook
  - Add autocomplete UI rendering with Grafana components
  - Purpose: Display query input with integrated autocomplete dialog
  - _Leverage: @grafana/ui (CodeEditor component if available, or custom input), useQueryAutocomplete hook, Grafana autocomplete dialog patterns
  - _Requirements: Requirement 7 (Grafana-native UI), all suggestion requirements
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React developer specializing in Grafana plugin UI components | Task: Refactor src/components/QueryEditor.tsx from PureComponent class to functional component using hooks, integrate useQueryAutocomplete from task 5, render Grafana-native autocomplete dialog showing suggestions on debounce trigger, display loading spinner during API calls, handle suggestion selection and insertion into query at cursor position, maintain backward compatibility with existing QueryEditorProps | Restrictions: Must use @grafana/ui components (CodeEditor, popover, or similar), preserve existing onChange/onRunQuery callbacks, don't break existing dashboard integrations | _Leverage: src/hooks/useQueryAutocomplete.ts from task 5, @grafana/ui autocomplete patterns, existing QueryEditor logic | _Requirements: Requirements 1-7 (all functionality integrated visually) | Success: Component renders with hooks pattern, autocomplete dialog appears after debounce, suggestions insert correctly, loading state displays, keyboard navigation works, all tests pass

## Task 5: Add query validation with debounce

- [x] 7. Create src/utils/queryValidator.ts
  - File: src/utils/queryValidator.ts (new)
  - Implement validateQuery function for syntax and semantic validation
  - Return validation errors with helpful messages
  - Purpose: Provide real-time query validation feedback
  - _Leverage: Parser utilities, query structure knowledge
  - _Requirements: Requirement 5 (query validation)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript developer specializing in validation logic | Task: Create src/utils/queryValidator.ts with validateQuery function that checks Datadog query syntax (metric must exist, aggregation required if metric present, valid tag format), returns ValidationResult with errors array and isValid boolean, suggesting fixes for common issues | Restrictions: Validation must be synchronous and fast (<100ms), provide actionable error messages for users | _Leverage: parser.ts from task 2, parser output to understand query structure | _Requirements: Requirement 5 (validation with feedback) | Success: All query edge cases validated correctly, error messages are clear and helpful, performance meets <100ms target, unit tests cover success and failure scenarios

- [x] 8. Integrate validation into useQueryAutocomplete hook
  - File: src/hooks/useQueryAutocomplete.ts (modify from task 5)
  - Add validation on debounce expiry
  - Display validation state in autocomplete UI
  - Purpose: Show validation results alongside autocomplete suggestions
  - _Leverage: queryValidator.ts from task 7, existing hook state
  - _Requirements: Requirement 5 (validation feedback)
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React developer | Task: Modify src/hooks/useQueryAutocomplete.ts to call validateQuery function on debounce expiry, add validationState to hook return type, display validation errors as red X or error message in autocomplete UI, show green checkmark when query is valid | Restrictions: Validation errors should not prevent running query, just inform user | _Leverage: queryValidator.ts from task 7, useQueryAutocomplete hook structure | _Requirements: Requirement 5 | Success: Validation displays correctly alongside suggestions, errors clear when user fixes issues, visual indicators obvious

## Task 6: Unit and integration tests

- [x] 9. Create parser.ts unit tests
  - File: tests/utils/autocomplete/parser.test.ts (new)
  - Test parseQuery with various cursor positions
  - Test context type detection
  - Test edge cases
  - Purpose: Verify parser reliability
  - _Leverage: Jest, parser.ts from task 2
  - _Requirements: Design "Testing Strategy" unit testing section
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA engineer specializing in unit testing | Task: Create comprehensive unit tests for src/utils/autocomplete/parser.ts testing all context types (metric, aggregation, tag, tag_value), cursor position variations, empty queries, special characters, and boundary conditions | Restrictions: Tests must be isolated, use Jest, achieve >90% code coverage | _Leverage: Jest testing framework, parser.ts | _Requirements: Design "Testing Strategy" unit testing | Success: All test cases pass, coverage >90%, edge cases thoroughly tested

- [x] 10. Create suggestions.ts unit tests
  - File: tests/utils/autocomplete/suggestions.test.ts (new)
  - Test generateSuggestions with mock data
  - Test filtering and sorting
  - Test duplicate removal
  - Purpose: Verify suggestion generation
  - _Leverage: Jest, suggestions.ts from task 3
  - _Requirements: Design "Testing Strategy"
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA engineer | Task: Create unit tests for src/utils/autocomplete/suggestions.ts testing suggestion generation for all context types, filtering of duplicates, limiting to 100 items, filtering used tags | Restrictions: Use mocked data, Jest, >90% coverage | _Leverage: Jest, suggestions.ts | _Requirements: Design "Testing Strategy" | Success: All test cases pass, filtering logic verified, >90% coverage

- [x] 11. Create api.ts unit tests
  - File: tests/utils/autocomplete/api.test.ts (new)
  - Mock Datadog API client
  - Test successful responses
  - Test error handling and timeout
  - Test caching
  - Purpose: Verify API integration
  - _Leverage: Jest, api.ts from task 4, mock-datadog-client
  - _Requirements: Design "Testing Strategy"
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA engineer with API testing expertise | Task: Create unit tests for src/utils/autocomplete/api.ts mocking @datadog/datadog-api-client, testing successful metric/tag fetches, 2-second timeout scenarios, 401/403 auth errors, and 30-second cache TTL | Restrictions: Mock official client completely, test promise rejection, Jest | _Leverage: Jest with mocking, api.ts | _Requirements: Design "Testing Strategy" | Success: Mock setup works, all scenarios tested, caching TTL verified, >90% coverage

- [x] 12. Create hook integration tests
  - File: tests/hooks/useQueryAutocomplete.test.ts (new)
  - Test debounce behavior
  - Test state transitions
  - Test keyboard navigation
  - Test suggestion selection
  - Purpose: Verify hook functionality
  - _Leverage: Jest, React Testing Library, useQueryAutocomplete from task 5
  - _Requirements: Design "Testing Strategy"
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA engineer specializing in React testing | Task: Create tests for src/hooks/useQueryAutocomplete.ts using React Testing Library, testing debounce timing (300-500ms), state updates, keyboard navigation (arrow/escape/enter/tab), suggestion selection and insertion, error handling | Restrictions: Use React Testing Library best practices, mock API calls, Jest | _Leverage: React Testing Library, useQueryAutocomplete | _Requirements: Design "Testing Strategy" integration testing | Success: All interactions tested, debounce timing verified, >90% coverage, tests reflect user behavior

- [x] 13. Create QueryEditor component integration tests
  - File: tests/components/QueryEditor.test.tsx (new)
  - Test autocomplete appears after debounce
  - Test suggestion insertion updates query
  - Test keyboard and mouse interaction
  - Purpose: Verify component integration with hook
  - _Leverage: Jest, React Testing Library, QueryEditor from task 6
  - _Requirements: Design "Testing Strategy" integration testing
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA engineer | Task: Create integration tests for src/components/QueryEditor.tsx testing autocomplete appearance after debounce, suggestion selection updates query correctly, keyboard navigation works, loading state displays | Restrictions: Use React Testing Library, mock useQueryAutocomplete, >90% coverage | _Leverage: React Testing Library, QueryEditor | _Requirements: Design "Testing Strategy" integration testing | Success: Component tests pass, user workflows verified, >90% coverage

## Phase 2: Backend Infrastructure (Tasks 16-20) - ARCHITECTURAL SHIFT

**CRITICAL**: This phase implements Go backend plugin for secure data fetching. Frontend cannot access credentials or call Datadog API directly - backend proxy is required.

**Why Backend is Required**:
```
Frontend Problem: Cannot access secureJsonData (API keys are backend-only)
CORS Issue: Browser cannot make direct calls to external APIs
Solution: Go backend plugin with resource handlers
```

**Architecture Change**:
- **Remove**: `routes` section from plugin.json (HTTP proxy no longer needed)
- **Add**: Backend Go plugin implementing QueryDataHandler (for query execution) and CallResourceHandler (for autocomplete)
- **Data Flow**: Frontend → getBackendSrv() → Grafana Backend → Go Plugin → Datadog API

---

### Task 16: Initialize Go Backend Plugin Structure

- [x] 16. Set up Go backend with required infrastructure
   - Files to create:
     - `pkg/main.go` - Plugin entry point
     - `pkg/plugin/datasource.go` - Main plugin struct
     - `go.mod` - Go module dependencies
     - `Magefile.go` - Build automation
   - Purpose: Establish Go backend foundation for subsequent tasks
   - _Leverage: Grafana Plugin SDK for Go, existing TypeScript datasource logic
   - _Requirements: All backend tasks (17-20)
   
   **_Prompt**: 
   Role: Go backend engineer with Grafana plugin experience
   
   Task: Initialize Go backend plugin infrastructure:
   1. Create `go.mod` with:
      - module github.com/wasilak/grafana-datadog-datasource
      - grafana-plugin-sdk-go v0.200+
      - datadog-api-client-go/v2 for Datadog SDK
      - github.com/grafana/grafana-plugin-sdk-go/go.sum dependencies
   
   2. Create `pkg/main.go`:
      - Package main
      - func main() calling serve.Serve() with plugin instance
      - Handle serve.Serve error appropriately
   
   3. Create `pkg/plugin/datasource.go`:
      - Type Datasource struct with:
        - InstanceSettings *backend.DataSourceInstanceSettings
        - JSONData *MyDataSourceOptions
        - SecureJSONData map[string]string (API key, app key)
      - Implement backend.QueryDataHandler interface (QueryData method)
      - Implement backend.CallResourceHandler interface (CallResource method)
      - Implement backend.HealthChecker interface (CheckHealth method)
      - New() factory function
   
   4. Create `Magefile.go`:
      - build:backend target compiling to dist/gpx_wasilak_datadog_datasource_linux_x64
      - build:backend-windows for Windows
      - build:backend-darwin for macOS
   
   Restrictions: 
   - Go 1.18+ only
   - Follow Grafana plugin SDK conventions exactly
   - No external HTTP libraries (use official SDK)
   - Support Grafana 12.3+
   
   _Leverage: 
   - Grafana Plugin SDK docs (github.com/grafana/grafana-plugin-sdk-go)
   - Existing TypeScript datasource.ts structure as reference
   - datadog-api-client-go/v2 examples
   
   Success Criteria:
   - go mod tidy succeeds without conflicts
   - go build ./pkg compiles without errors
   - mage build:backend creates binary in dist/
   - Binary size <50MB (indicates successful compilation)
   - All imports resolve correctly

---

### Task 17: Implement QueryData Handler for Main Data Fetching

- [x] 17. Implement backend query execution and data frame conversion
    - File: `pkg/plugin/datasource.go` (extend from task 16)
    - Purpose: Move all metric query execution from frontend proxy to backend
    - _Leverage: Grafana SDK backend.QueryData interface, datadog-api-client-go
    - _Requirements: Task 16 (backend setup), existing TypeScript doRequest logic
   
   **_Prompt**:
   Role: Go backend developer with Datadog API expertise
   
   Task: Implement QueryData handler in `pkg/plugin/datasource.go`:
   
   1. Method Signature:
      ```
      func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
      ```
   
   2. Implementation steps:
      - Extract SecureJsonData from InstanceSettings (API key, app key)
      - Initialize datadog-api-client with credentials
      - Loop through req.Queries (multiple queries per request)
      - For each query:
        a) Unmarshal query JSON into Go struct with fields: QueryText, Label
        b) Extract query parameters from QueryText using regex (metric, aggregation, tags)
        c) Build Datadog query using official SDK
        d) Call Datadog MetricsApi.QueryMetrics() with context timeout
        e) Process response into Grafana DataFrame with:
           - Time field (from response timestamps)
           - Value field (from response points)
           - Labels (from tag_set)
        f) Handle errors by returning error in DataFrame
        g) Add to response
      - Return complete response with all DataFrames
   
   3. Error handling:
      - 401/403 auth errors → return "Invalid Datadog API credentials" message
      - Timeout errors → return "Query timeout (context exceeded)"
      - Datadog API errors → return wrapped error message
      - Never panic - always return error in response
   
   4. Performance:
      - Respect request context timeout (from Grafana)
      - Cancel API calls if context done signal received
      - Support multiple queries in single request (parallel if possible)
   
   Restrictions:
   - Use official datadog-api-client-go only
   - Do NOT make HTTP calls directly
   - Handle context.WithTimeout properly
   - Support existing query format from TypeScript
   - Return proper error DataFrames (not panic)
   
   _Leverage:
   - Existing TypeScript doRequest() method logic
   - datadog-api-client-go v2 QueryMetrics documentation
   - Grafana SDK backend.DataResponse and data.Frame types
   
   Success Criteria:
   - QueryData compiles without errors
   - Returns properly formatted DataFrames
   - Respects context timeout
   - Handles errors gracefully
   - TypeScript frontend receives query results
   - All aggregations (avg, sum, min, max, etc.) work
   - Tag filtering works correctly

---

### Task 18: Implement CallResource Handler for Autocomplete Endpoints

- [x] 18. Create secure backend endpoints for metric and tag suggestions
   - File: `pkg/plugin/autocomplete.go` (new)
   - Purpose: Provide metrics and tags from Datadog without exposing credentials
   - _Leverage: Grafana SDK backend.CallResourceHandler, datadog-api-client-go
   - _Requirements: Task 16 (backend setup)
   
   **_Prompt**:
   Role: Go backend developer with API caching experience
   
   Task: Implement CallResource handler in `pkg/plugin/datasource.go`:
   
   1. Method Signature:
      ```
      func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error
      ```
   
   2. Routing:
      - Route GET /autocomplete/metrics → MetricsHandler()
      - Route GET /autocomplete/tags/{metric} → TagsHandler()
      - Unknown routes → return 404 with error message
   
   3. MetricsHandler Implementation:
      - Check cache: key = "metrics", if exists and TTL valid → return cached
      - Initialize Datadog client with credentials
      - Call MetricsApi.ListMetrics() with context.WithTimeout(ctx, 2*time.Second)
      - Parse response into []string of metric names
      - Cache result with timestamp
      - Return JSON array: ["metric.name1", "metric.name2", ...]
      - Handle timeout: return empty array with error message
   
   4. TagsHandler Implementation:
      - Extract metric name from URL path
      - Check cache: key = "tags:" + metric, if exists and TTL valid → return cached
      - Initialize Datadog client with credentials
      - Call TagsApi.ListHostTags() or equivalent with metric filter
      - Parse response into []string of tags (format: "key:value")
      - Cache result with timestamp
      - Return JSON array: ["tag1:value1", "tag2:value2", ...]
      - Handle timeout: return empty array with error message
   
   5. Caching Implementation:
      - Use in-memory map[string]CacheEntry
      - CacheEntry struct: Data []string, Timestamp time.Time
      - TTL: exactly 30 seconds
      - Check: if time.Since(entry.Timestamp) > 30*time.Second → invalidate
      - Cleanup: Remove expired entries on each request
      - Thread safety: Use sync.Mutex for concurrent access
   
   6. Auth Error Handling:
      - 401/403 from Datadog → return 401 with "Invalid Datadog credentials"
      - Return user-friendly message in response body
   
   7. Concurrent Request Limiting:
      - Allow max 5 simultaneous requests to Datadog
      - Use sync.Semaphore or channel to enforce
      - Excess requests wait for slot (don't reject)
   
   Restrictions:
   - Timeout MUST be 2 seconds (not configurable)
   - Cache TTL MUST be 30 seconds (not configurable)
   - Max 5 concurrent requests (enforced)
   - Use Go context for timeout, not time.Sleep()
   - Return proper HTTP status codes (200, 401, 404, 500)
   
   _Leverage:
   - datadog-api-client-go v2 MetricsApi, TagsApi
   - sync.Mutex for thread safety
   - http.Handler patterns in Grafana SDK
   - existing TypeScript fetchMetricNames() logic as reference
   
   Success Criteria:
   - GET /autocomplete/metrics returns real metrics (200 with JSON array)
   - GET /autocomplete/tags/{metric} returns real tags (200 with JSON array)
   - 2-second timeout enforced (doesn't hang)
   - 30-second cache working (second call returns cached result)
   - 401 auth errors return proper error message
   - Concurrent request limit prevents overwhelming Datadog
   - All endpoint calls return valid JSON

---

### Task 19: Update Frontend Hook to Call Backend Endpoints

- [x] 19. Connect frontend autocomplete to secure backend endpoints
   - File: `src/hooks/useQueryAutocomplete.ts` (modify)
   - Purpose: Replace direct API calls with backend resource handler calls
   - _Leverage: Grafana getBackendSrv() API, datasource UID
   - _Requirements: Task 18 (backend endpoints)
   
   **_Prompt**:
   Role: React/TypeScript developer
   
   Task: Modify `src/hooks/useQueryAutocomplete.ts`:
   
   1. Change fetchAndUpdateSuggestions() function:
      - Add datasourceUid parameter (get from datasource.uid prop in QueryEditor)
      - Replace direct API calls with backend calls:
      
      OLD:
      ```
      const metrics = await datasource.fetchMetricNames(...)
      const tags = await fetchTagsForMetric(...)
      ```
      
      NEW:
      ```
      const response = await getBackendSrv().fetch({
        url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/metrics`,
        method: 'GET',
        signal: abortController.signal,
      })
      const metrics = response.data as string[]
      
      const tagsResponse = await getBackendSrv().fetch({
        url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/tags/${metric}`,
        method: 'GET',
        signal: abortController.signal,
      })
      const tags = tagsResponse.data as string[]
      ```
   
   2. Implement AbortController for 2-second timeout:
      ```
      const abortController = new AbortController()
      const timeout = setTimeout(() => abortController.abort(), 2000)
      try {
        // fetch calls
      } finally {
        clearTimeout(timeout)
      }
      ```
   
   3. Error handling:
      - 401 errors → "Datadog credentials invalid"
      - 404 errors → "Endpoint not found (backend not available)"
      - Timeout errors → "Suggestions request timeout"
      - Network errors → "Failed to fetch suggestions"
      - Display error in AutocompleteState.error field
   
   4. Update QueryEditor to pass datasource.uid:
      - Extract datasourceUid from datasource prop in QueryEditor
      - Pass to useQueryAutocomplete as option
   
   Restrictions:
   - ONLY use getBackendSrv() (never direct HTTP)
   - NEVER expose API keys or app keys
   - 2-second timeout via AbortController
   - Match existing error display pattern
   - Keep existing loading/error states
   
   _Leverage:
   - getBackendSrv() from @grafana/runtime
   - datasource.uid available in QueryEditor props
   - existing error handling pattern
   
   Success Criteria:
   - Frontend calls backend instead of direct Datadog API
   - Metrics and tags load from backend
   - Auth handled securely by Grafana
   - Errors display properly in autocomplete UI
   - Loading states work as before
   - TypeScript compiles without errors

---

### Task 20: Update plugin.json for Backend-First Architecture

- [x] 20. Configure plugin for backend execution
   - File: `src/plugin.json` (modify)
   - Purpose: Tell Grafana to load and use backend plugin
   - _Leverage: Grafana plugin.json schema
   - _Requirements: Task 16 (backend binary created)
   
   **_Prompt**:
   Role: DevOps/Configuration specialist
   
   Task: Update `src/plugin.json`:
   
   1. Remove the `routes` section entirely:
      ```
      DELETE:
      "routes": [
        {
          "path": "wasilak-datadog-datasource",
          "method": "GET",
          "url": "https://api.{{ .JsonData.site }}",
          ...
        }
      ]
      ```
   
   2. Add at root level (after "id" field):
      ```
      "backend": true,
      "executable": "gpx_wasilak_datadog_datasource_linux_x64",
      ```
   
   3. Update dependencies:
      - Ensure "grafanaDependency": ">=12.3.0"
      - No changes to other dependency fields
   
   4. Keep unchanged:
      - "type": "datasource"
      - "name", "id", "metrics", "category"
      - "info", "keywords", "screenshots", "logos"
      - "links", "version", "updated"
   
   5. Verify JSON structure:
      - No trailing commas
      - All quotes properly closed
      - Valid JSON (use online validator)
   
   Restrictions:
   - Executable name must match Magefile build output
   - Keep ALL other fields exactly as-is
   - No breaking changes to existing configuration
   - Maintain backward compatibility
   
   _Leverage:
   - Grafana plugin.json reference docs
   - Existing plugin.json structure
   - Task 16 build output name
   
   Success Criteria:
   - plugin.json validates as JSON
   - Grafana recognizes backend plugin
   - Backend binary loads when plugin starts
   - No configuration errors in Grafana logs
   - Plugin appears in datasource list
   - Can create datasource instances

## Task 9: Documentation and finalization

- [x] 14. Create autocomplete documentation
  - File: docs/autocomplete.md (new)
  - Document API usage, architecture, configuration options
  - Add examples and troubleshooting
  - Purpose: Help users and developers understand feature
  - _Leverage: Design document, code comments
  - _Requirements: All requirements
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Technical writer | Task: Create comprehensive documentation in docs/autocomplete.md explaining autocomplete feature, architecture, how parser detects context, configuration of debounce timing and cache TTL, troubleshooting common issues | Restrictions: Clear and accessible language | _Leverage: Design document, actual implementation | _Requirements: All | Success: Documentation is clear, complete, and helpful to developers

- [x] 15. Final code review and cleanup
  - Review all code for quality, consistency, types
  - Ensure all tests pass
  - Clean up any debug code
  - Update CHANGELOG.md
  - Purpose: Ensure production-ready implementation
  - _Leverage: ESLint, TypeScript compiler, existing code style
  - _Requirements: All
  - _Prompt: Implement the task for spec query-editor-autocomplete, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Senior developer | Task: Review all autocomplete code for TypeScript strictness, consistency with project patterns, remove debug code, run full test suite, update CHANGELOG.md with new feature, ensure code follows project style | Restrictions: No breaking changes, maintain backward compatibility, all tests must pass | _Leverage: Existing linting/TypeScript config, project conventions | _Requirements: All | Success: Code review complete, all tests pass, linting clean, CHANGELOG updated, ready for release
