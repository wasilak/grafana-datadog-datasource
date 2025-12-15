# Implementation Plan: Datadog Logs Support (CORRECTED ARCHITECTURE)

## Critical Update: Architectural Fixes Required

After reviewing the official Grafana logs data source tutorial, we've identified that our pagination caching issues are symptoms of **fundamental architectural problems**. Grafana doesn't properly recognize our data as logs due to incorrect field structure.

**Root Cause**: Wrong field names (`message` vs `body`, `level` vs `severity`) and structure (separate fields vs single `labels` JSON field).

## Phase 1: Critical Architectural Fixes

- [x] 1. Fix Plugin Configuration
  - ✅ COMPLETED: Updated plugin.json to include `"logs": true` and `"streaming": true`
  - Verify Grafana recognizes the plugin as a logs data source
  - _Requirements: 2.1, 2.2_

- [x] 2. Rewrite Data Frame Structure (CRITICAL)
- [x] 2.1 Completely rewrite createLogsDataFrames function
  - Change field names: `message` → `body`, `level` → `severity`
  - Implement single `labels` field with JSON structure containing service, source, host, env, tags, attributes
  - Remove separate service, source, host, env fields
  - Use correct `PreferredVisualization: "logs"` metadata (not in custom object)
  - _Requirements: 1.2, 5.1, 5.2, 5.3, 5.4, 13.1_

- [ ]* 2.2 Write property test for data frame structure
  - **Property 3: Logs Data Frame Structure**
  - **Validates: Requirements 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 13.1**

- [x] 2.3 Update LogEntry model in Go backend
  - Change struct fields: `Message` → `Body`, `Level` → `Severity`
  - Add `Labels json.RawMessage` field
  - Remove separate Service, Source, Host, Env fields from main struct
  - Create helper LogLabels struct for JSON marshaling
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Remove Complex Frontend Caching System
- [x] 3.1 Simplify LogsQueryEditor pagination
  - Remove complex frontend cache management (pageCache, createCacheKey, etc.)
  - Remove loading state complexity (requestInFlight, queryExecutionId)
  - Remove shouldMakeXHRRequest logic
  - Rely on Grafana's built-in logs handling and backend caching only
  - _Requirements: 10.1, 10.4_

- [x] 3.2 Test basic pagination without frontend cache
  - Verify pagination works with correct data structure
  - Confirm no stale data issues remain
  - Test that Grafana properly handles logs navigation
  - _Requirements: 10.1_

## Phase 2: Advanced Architecture Patterns (Based on OpenSearch Analysis)

- [x] 4. Implement Query Handler Architecture Pattern
- [x] 4.1 Create common QueryHandler interface
  - Define interface with processQuery() and executeQueries() methods
  - Follow OpenSearch's clean handler separation pattern
  - Enable proper query type routing and processing
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 4.2 Implement MetricsHandler and LogsHandler classes
  - Refactor existing metrics logic into MetricsHandler
  - Create new LogsHandler for logs-specific processing
  - Ensure both handlers implement common interface
  - Add proper error handling and validation in each handler
  - _Requirements: 1.1, 6.1, 6.2_

- [ ]* 4.3 Write property test for query handler routing
  - **Property 2: Query Type Detection and Routing**
  - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 5. Implement Request Builder Pattern
- [x] 5.1 Create DatadogLogsRequestBuilder class
  - Abstract Datadog Logs API request construction
  - Handle authentication headers (DD-API-KEY, DD-APPLICATION-KEY)
  - Manage request formatting and validation
  - Follow OpenSearch's builder pattern for maintainability
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 5.2 Create DatadogMetricsRequestBuilder class
  - Refactor existing metrics request logic into builder
  - Ensure consistent patterns between logs and metrics
  - Share common authentication and header logic
  - _Requirements: 6.2, 6.3_

- [ ]* 5.3 Write property test for request builder consistency
  - **Property 1: Logs API Integration Consistency**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 10.2, 10.3, 10.5, 12.1, 12.4, 12.5**

- [x] 6. Implement Response Parser Pattern
- [x] 6.1 Create LogsResponseParser class
  - ✅ COMPLETED: Handle conversion from Datadog Logs API response to Grafana data frames
  - ✅ COMPLETED: Implement proper field mapping (body, severity, labels structure)
  - ✅ COMPLETED: Add comprehensive error handling and validation
  - ✅ COMPLETED: Follow OpenSearch's separation of concerns pattern
  - _Requirements: 1.2, 5.1, 5.2, 5.3, 5.4_

- [x] 6.2 Create MetricsResponseParser class
  - ✅ COMPLETED: Refactor existing metrics response logic into parser
  - ✅ COMPLETED: Ensure consistent error handling patterns
  - ✅ COMPLETED: Share common data frame construction utilities
  - _Requirements: 5.1, 5.2_

- [ ]* 6.3 Write property test for response parser data frame structure
  - **Property 3: Logs Data Frame Structure**
  - **Validates: Requirements 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 13.1**

- [x] 7. Enhance Autocomplete System Architecture
- [x] 7.1 Implement context-aware completion providers
  - Create LogsCompletionItemProvider similar to OpenSearch's PPLCompletionItemProvider
  - Add cursor position analysis for context-aware suggestions
  - Implement field name vs field value suggestion logic
  - Follow OpenSearch's sophisticated completion patterns
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 7.2 Add backend-driven field and value suggestions
  - Extend resource handlers to provide available log fields
  - Add endpoints for service names, source names, and log levels
  - Implement caching for suggestion data with appropriate TTL
  - Follow OpenSearch's backend suggestion patterns
  - _Requirements: 11.2, 11.3, 11.5_

- [ ]* 7.3 Write property test for autocomplete system extension
  - **Property 6: Autocomplete System Extension**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

## Phase 3: Enhanced Logs Features (Based on Official Tutorial)

- [x] 8. Implement Search Word Highlighting
- [x] 8.1 Extract search terms from logs query
  - Parse Datadog query syntax to identify search terms (not facet filters)
  - Add `searchWords` array to frame metadata
  - Enable Grafana's automatic word highlighting in log messages
  - _Requirements: 4.1, 4.2_

- [ ]* 8.2 Write property test for search term extraction
  - **Property 4: Logs Query Parameter Handling**
  - **Validates: Requirements 1.1, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 9. Implement Log Filtering Support
- [x] 9.1 Add modifyQuery method to datasource
  - Support `ADD_FILTER` and `ADD_FILTER_OUT` operations
  - Handle click-to-filter functionality in Grafana logs panel
  - Allow users to click log values to add/remove filters
  - _Requirements: 4.2, 4.3_

- [x] 9.2 Integrate filtering with existing query translation
  - Extend translateLogsQuery to handle filter operations
  - Maintain existing facet filter support (service:, status:, etc.)
  - _Requirements: 7.1, 7.2, 8.1, 8.2_

- [ ]* 9.3 Write property test for log filtering
  - **Property 7: Log Level and Service Filtering**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 10. Add Trace Linking Support
- [x] 10.1 Extract trace IDs from Datadog log attributes
  - ✅ COMPLETED: Identify trace ID fields in log data (dd.trace_id, trace_id, etc.)
  - ✅ COMPLETED: Create data links for trace navigation
  - ✅ COMPLETED: Add trace fields to labels JSON structure
  - _Requirements: 5.2, 5.3_

- [x] 10.2 Configure trace data links
  - ✅ COMPLETED: Set up links to Datadog trace UI
  - ✅ COMPLETED: Handle different trace ID formats (hex, decimal)
  - ✅ COMPLETED: Add data links to appropriate fields in data frame
  - _Requirements: 13.4_

## Phase 4: Advanced Features

- [ ] 11. Implement Live Tailing (Streaming)
- [ ] 11.1 Add streaming query support
  - Implement real-time log updates using streaming endpoints
  - Handle WebSocket or Server-Sent Events for live data
  - Integrate with Grafana's streaming capabilities
  - _Requirements: 15.1, 15.2, 15.3_

- [ ]* 11.2 Write property test for streaming functionality
  - **Property 1: Logs API Integration Consistency**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 10.2, 10.3, 10.5, 12.1, 12.4, 12.5**

- [-] 12. Enhanced Error Handling
- [x] 12.1 Extend error parsing for logs-specific errors
  - Add logs context to error messages
  - Handle logs API permission errors (logs_read_data scope)
  - Improve error messages for common logs query issues
  - _Requirements: 12.1, 12.2, 12.3_

- [ ]* 12.2 Write property test for error handling
  - **Property 9: Error Handling Pattern Reuse**
  - **Validates: Requirements 12.2, 12.3**

## Phase 5: Testing and Validation

- [ ] 13. Comprehensive Testing
- [ ] 13.1 Test with real Datadog logs data
  - Verify field structure works with Grafana logs panel
  - Test pagination without caching issues
  - Validate search highlighting and filtering work correctly
  - Confirm no more stale data problems
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 13.2 Performance testing
  - Test with large log datasets
  - Verify no memory leaks or performance issues
  - Confirm backend caching works efficiently
  - _Requirements: 10.1, 10.2, 10.3_

- [ ]* 13.3 Write integration tests
  - Test complete logs query flow
  - Verify UI component integration
  - Test logs panel recognition and display
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 14. Implement Logs Volume Histogram Support (Using Grafana's Supplementary Queries)
- [x] 14.1 Implement DataSourceWithSupplementaryQueriesSupport interface
  - Extend DataSource class to implement DataSourceWithSupplementaryQueriesSupport
  - Add getSupportedSupplementaryQueryTypes() method returning [SupplementaryQueryType.LogsVolume]
  - Implement getSupplementaryQuery() method to generate logs volume queries from logs queries
  - Implement getSupplementaryRequest() method to handle logs volume data requests
  - _Requirements: 18.1, 18.4_

- [x] 14.2 Add Datadog Logs Aggregation API integration
  - Implement POST /api/v2/logs/aggregate endpoint support in backend
  - Support timeseries aggregation with date_histogram grouping
  - Handle automatic bucket size calculation based on time range
  - Add queryLogsVolume method to handle logs-volume query type
  - _Requirements: 18.1, 18.2_

- [x] 14.3 Create logs volume data frame generation
  - Generate data frame with Time and Count fields for histogram visualization
  - Set proper metadata (preferredVisualisationType: 'graph')
  - Use refId prefix 'log-volume-' to match Grafana conventions
  - Handle bucket size calculation (1m, 5m, 15m, 1h, 4h based on time range)
  - _Requirements: 18.2, 18.3_

- [ ]* 14.4 Write property test for logs volume data frame generation
  - **Property 10: Logs Volume Data Frame Structure**
  - **Validates: Requirements 18.1, 18.2, 18.3**

- [x] 14.5 Add logs volume query type detection and routing
  - Extend QueryData method to handle 'logs-volume' query type
  - Route logs volume queries to Datadog Logs Aggregation API
  - Ensure logs volume queries use same authentication and error handling as logs queries
  - Handle logs volume query failures gracefully (logs still work without histogram)
  - _Requirements: 18.4, 18.5_

- [ ]* 14.6 Write property test for supplementary queries integration
  - **Property 11: Logs Volume Supplementary Query Generation**
  - **Validates: Requirements 18.4, 18.5**

- [ ] 15. Final Checkpoint - Verify All Requirements
  - Ensure all tests pass, ask the user if questions arise
  - Confirm pagination issues are completely resolved
  - Validate Grafana properly recognizes logs data AND histogram data
  - Test that logs appear correctly in logs panels, table panels, etc.
  - Verify histogram visualization works in Grafana logs panels

## Previously Completed Tasks (May Need Revision)

The following tasks were completed with the old architecture and may need updates:

- [x] ~~1. Set up logs query type detection and routing~~ ✅ GOOD - No changes needed
- [x] ~~2. Implement Datadog Logs API integration~~ ✅ GOOD - API integration is correct
- [x] ~~4. Implement logs query editor frontend component~~ ⚠️ NEEDS UPDATE - Remove complex caching
- [x] ~~5. Extend autocomplete system for logs~~ ✅ GOOD - No changes needed
- [x] ~~6. Implement log level and service filtering~~ ✅ GOOD - No changes needed
- [x] ~~7. Add variable interpolation support for logs~~ ✅ GOOD - No changes needed
- [x] ~~8. Implement pagination and caching for logs~~ ⚠️ NEEDS UPDATE - Simplify frontend
- [x] ~~9. Extend error handling for logs~~ ✅ GOOD - No changes needed

## Key Insight

The complex frontend caching system we built is likely unnecessary. Once we fix the data frame structure to match Grafana's expectations, Grafana should handle logs properly, and the pagination issues should resolve themselves.

**We've been treating symptoms (pagination caching) instead of the disease (incorrect logs data structure).**