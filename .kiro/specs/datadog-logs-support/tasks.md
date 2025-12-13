# Implementation Plan: Datadog Logs Support

## Overview

This implementation plan converts the datadog-logs-support design into actionable coding tasks. Each task builds incrementally on previous tasks, ensuring working functionality at every step. The plan leverages existing plugin infrastructure while adding logs-specific capabilities.

## Tasks

- [x] 1. Set up logs query type detection and routing
  - Extend the QueryModel struct in Go backend to include logs query fields
  - Add query type detection logic in datasource.ts QueryData method
  - Create basic routing between logs and metrics queries
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 2. Implement Datadog Logs API integration
  - Create pkg/plugin/logs.go with Datadog Logs Search API v2 integration
  - Implement LogsSearchRequest struct matching Datadog's exact API format
  - Add queryLogs method that reuses existing authentication patterns
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2.1 Write property test for API integration consistency
  - **Property 1: Logs API Integration Consistency**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 10.2, 10.3, 10.5, 12.1, 12.4, 12.5**

- [x] 2.2 Add logs query parameter translation
  - Implement translation from Grafana query format to Datadog's logs search syntax
  - Handle time range conversion using existing patterns
  - Support basic search terms and facet filters
  - _Requirements: 1.1, 1.3, 1.4, 4.1, 4.2_

- [ ]* 2.3 Write property test for query parameter handling
  - **Property 4: Logs Query Parameter Handling**
  - **Validates: Requirements 1.1, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 3. Create logs data frame structure
  - Implement log entry to Grafana data frame conversion
  - Create proper field structure (timestamp, message, level, service, source)
  - Set appropriate metadata for Grafana's logs panel recognition
  - _Requirements: 1.2, 5.1, 5.2, 5.3, 5.4_

- [ ]* 3.1 Write property test for data frame structure
  - **Property 3: Logs Data Frame Structure**
  - **Validates: Requirements 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 13.1**

- [x] 4. Implement logs query editor frontend component
  - Create src/LogsQueryEditor.tsx using existing CodeEditor component
  - Add logs query interface with text input for search queries
  - Integrate with existing theme system using useTheme2()
  - _Requirements: 3.1, 3.2_

- [x] 4.1 Add query type detection to main QueryEditor
  - Extend src/QueryEditor.tsx to detect panel context
  - Add conditional rendering for logs vs metrics editors
  - Maintain backward compatibility with existing metrics queries
  - _Requirements: 2.1, 2.2_

- [ ]* 4.2 Write property test for query type detection
  - **Property 2: Query Type Detection and Routing**
  - **Validates: Requirements 2.1, 2.2, 2.5**

- [ ]* 4.3 Write property test for UI component reuse
  - **Property 10: UI Component Reuse**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 5. Extend autocomplete system for logs
  - Extend src/hooks/useQueryAutocomplete.ts for logs-specific suggestions
  - Add logs facet suggestions (service, source, level)
  - Reuse existing debouncing and caching patterns
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 5.1 Add backend autocomplete resource handlers
  - Extend CallResource method in datasource.go for logs autocomplete endpoints
  - Implement /autocomplete/logs/services and /autocomplete/logs/sources handlers
  - Reuse existing concurrency limiting and timeout patterns
  - _Requirements: 11.2, 11.3, 11.5_

- [ ]* 5.2 Write property test for autocomplete system extension
  - **Property 6: Autocomplete System Extension**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

- [x] 6. Implement log level and service filtering
  - Add support for level filters (status:ERROR, status:(ERROR OR WARN))
  - Add support for service filters (service:api-gateway)
  - Include filtered fields in data frame output
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ]* 6.1 Write property test for filtering logic
  - **Property 7: Log Level and Service Filtering**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5**

- [ ] 7. Add variable interpolation support for logs
  - Extend applyTemplateVariables method in datasource.ts for logs queries
  - Reuse existing variableInterpolationService patterns
  - Add safety measures for logs query injection prevention
  - _Requirements: 9.1, 9.2, 9.3_

- [ ]* 7.1 Write property test for variable interpolation consistency
  - **Property 5: Variable Interpolation Consistency**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 8. Implement pagination and caching for logs
  - Add pagination support using Datadog's cursor-based system
  - Extend existing AutocompleteCache system for logs results
  - Implement 30-second cache TTL and concurrency limiting
  - _Requirements: 10.1, 10.4_

- [ ]* 8.1 Write property test for pagination and caching consistency
  - **Property 8: Pagination and Caching Consistency**
  - **Validates: Requirements 10.1, 10.4**

- [ ] 9. Extend error handling for logs
  - Extend parseDatadogError function for logs-specific errors
  - Add logs permission scope messages (logs_read_data)
  - Reuse existing error message formatting patterns
  - _Requirements: 12.1, 12.2, 12.3_

- [ ]* 9.1 Write property test for error handling pattern reuse
  - **Property 9: Error handling Pattern Reuse**
  - **Validates: Requirements 12.2, 12.3**

- [ ] 10. Add query validation and help system
  - Extend existing QueryEditorHelp component for logs syntax
  - Add logs-specific validation in filterQuery method
  - Provide contextual help for Datadog logs search syntax
  - _Requirements: 3.3, 3.4, 3.5_

- [ ]* 10.1 Write unit tests for logs query validation
  - Test logs query syntax validation
  - Test help system integration
  - Test error message display
  - _Requirements: 3.3, 3.4, 3.5_

- [ ] 11. Implement boolean operators and advanced search
  - Add support for AND, OR, NOT operators in logs queries
  - Add wildcard pattern support (error*)
  - Integrate with Grafana's time range picker
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ]* 11.1 Write unit tests for advanced search features
  - Test boolean operator parsing
  - Test wildcard pattern handling
  - Test time range integration
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 12. Add logs visualization metadata
  - Set appropriate DataFrame metadata for logs panel recognition
  - Configure preferred visualization type as "logs"
  - Ensure compatibility with table and mixed panels
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 12.1 Write unit tests for visualization support
  - Test DataFrame metadata configuration
  - Test logs panel compatibility
  - Test mixed panel scenarios
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Add comprehensive integration testing
  - Create end-to-end tests for logs query flow
  - Test logs query editor integration with Grafana panels
  - Verify logs data display in various panel types
  - _Requirements: All requirements integration_

- [ ]* 14.1 Write integration tests for complete logs workflow
  - Test complete query-to-display pipeline
  - Test error scenarios and recovery
  - Test performance under load
  - _Requirements: All requirements integration_

- [ ] 15. Final optimization and cleanup
  - Optimize logs query performance and memory usage
  - Clean up any unused code or temporary implementations
  - Ensure all error messages are user-friendly
  - _Requirements: Performance and usability requirements_

- [ ] 16. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.