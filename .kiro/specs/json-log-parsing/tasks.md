# Implementation Plan

- [ ] 1. Frontend UI Components


- [x] 1.1 Add JSON parsing configuration to query model
  - Extend MyQuery interface in types.ts to include jsonParsing configuration
  - Add JSONParsingConfig interface with enabled, targetField, and options
  - Update DEFAULT_QUERY to include default JSON parsing settings
  - _Requirements: 1.3, 1.5_

- [x] 1.2 Create JSON parsing configuration panel in LogsQueryEditor
  - Add toggle switch for enabling/disabling JSON parsing
  - Create field selector dropdown with options: "whole_log", "message", "data", "attributes"
  - Add tooltips explaining each field option
  - Position panel below the main query editor
  - _Requirements: 1.1, 1.2, 7.1, 7.2_

- [x] 1.3 Implement field selector component
  - Create reusable FieldSelector component with dropdown functionality
  - Add validation to ensure field is selected when JSON parsing is enabled
  - Provide visual feedback for configuration changes
  - _Requirements: 1.2, 7.3, 7.5_

- [ ]* 1.4 Write unit tests for UI components
  - Test JSON parsing configuration panel rendering and interaction
  - Test field selector dropdown behavior and validation
  - Test query model updates when configuration changes
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Backend JSON Parser Implementation

- [x] 2.1 Create JSON parsing configuration struct in Go
  - Define JSONParsingConfig struct with JSON tags
  - Add parsing configuration to query request handling
  - Implement configuration validation and defaults
  - _Requirements: 2.1, 8.4_

- [x] 2.2 Implement core JSON parser using interface{}
  - Create JSONParser struct with ParseJSONField method
  - Use json.Unmarshal with interface{} for dynamic JSON parsing
  - Add error handling for invalid JSON with detailed logging
  - Implement size and timeout limits for parsing operations
  - _Requirements: 2.2, 2.3, 5.1, 5.2, 6.4, 6.5_

- [x] 2.3 Add JSON field flattening functionality
  - Implement FlattenObject method to handle nested JSON structures
  - Use dot notation for nested field names (e.g., "user.name")
  - Handle arrays by serializing them as JSON strings
  - Implement depth limiting to prevent performance issues
  - _Requirements: 3.1, 3.2, 3.3, 6.3_

- [ ]* 2.4 Write property test for JSON parsing success
  - **Property 1: JSON Parsing Success**
  - **Validates: Requirements 2.2, 4.1, 4.2, 4.3**

- [ ]* 2.5 Write property test for field structure consistency
  - **Property 2: Field Structure Consistency**
  - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ]* 2.6 Write property test for error handling
  - **Property 3: Error Handling Preservation**
  - **Validates: Requirements 5.1, 5.3, 5.4, 5.5**

- [x] 3. Integration with Logs Response Parser

- [x] 3.1 Extend LogEntry struct for parsed fields
  - Add ParsedFields map[string]interface{} to LogEntry struct
  - Add ParseErrors []string for tracking parsing issues
  - Update JSON tags for proper serialization
  - _Requirements: 2.5, 5.2_

- [x] 3.2 Integrate JSON parser into logs response processing
  - Modify convertDataArrayToLogEntries to check for JSON parsing config
  - Apply JSON parsing to specified fields during log entry conversion
  - Handle field name conflicts by prefixing with "parsed_"
  - Preserve original field values alongside parsed versions
  - _Requirements: 2.1, 2.4, 3.4, 3.5_

- [x] 3.3 Update data frame creation for parsed fields
  - Modify createLogsDataFrames to include parsed fields as separate columns
  - Handle dynamic field creation based on parsed JSON content
  - Ensure proper field types and configurations for Grafana display
  - _Requirements: 2.5, 3.1_

- [ ]* 3.4 Write property test for field conflict resolution
  - **Property 5: Field Conflict Resolution**
  - **Validates: Requirements 3.4**

- [ ]* 3.5 Write property test for original data preservation
  - **Property 6: Original Data Preservation**
  - **Validates: Requirements 3.5**

- [x] 4. Error Handling and Edge Cases

- [x] 4.1 Implement comprehensive error handling
  - Handle invalid JSON syntax gracefully without failing entire query
  - Log detailed error information for debugging purposes
  - Continue processing other log entries when parsing fails
  - Implement partial parsing for mixed valid/invalid content
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 4.2 Add performance safeguards
  - Implement JSON size limits to prevent memory issues
  - Add parsing timeouts to prevent query blocking
  - Limit nesting depth for deeply nested JSON structures
  - Skip parsing logic entirely when JSON parsing is disabled
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 4.3 Write property test for depth and size limiting
  - **Property 7: Depth and Size Limiting**
  - **Validates: Requirements 6.3, 6.4**

- [ ]* 4.4 Write property test for parsing mode consistency
  - **Property 8: Parsing Mode Consistency**
  - **Validates: Requirements 2.1, 2.4**

- [-] 5. Frontend Integration and Validation

- [x] 5.1 Add query validation for JSON parsing configuration
  - Validate that field is selected when JSON parsing is enabled
  - Provide clear error messages for invalid configurations
  - Prevent query execution with incomplete JSON parsing setup
  - _Requirements: 7.3_

- [x] 5.2 Implement configuration persistence
  - Ensure JSON parsing configuration is saved with queries
  - Test configuration persistence across browser sessions
  - Handle configuration migration for existing queries
  - _Requirements: 1.5_

- [ ]* 5.3 Write property test for validation enforcement
  - **Property 9: Validation Enforcement**
  - **Validates: Requirements 7.3**

- [ ]* 5.4 Write property test for configuration state management
  - **Property 10: Configuration State Management**
  - **Validates: Requirements 7.5**

- [ ] 6. Testing and Documentation

- [ ] 6.1 Create comprehensive unit tests
  - Test JSON parsing with various valid and invalid JSON structures
  - Test field flattening with nested objects and arrays
  - Test error handling with malformed JSON and edge cases
  - Test performance with large JSON objects and deep nesting
  - _Requirements: 9.1, 9.2, 9.5_

- [ ]* 6.2 Write integration tests
  - Test end-to-end functionality from UI configuration to data frame creation
  - Test compatibility with existing log processing pipeline
  - Test performance impact with large datasets
  - _Requirements: 9.4_

- [x] 6.3 Add feature documentation
  - Document JSON parsing configuration options
  - Provide examples of common use cases and field patterns
  - Document performance considerations and limitations
  - Explain error handling and troubleshooting steps
  - _Requirements: 8.5_

- [ ] 7. Final Integration and Testing

- [ ] 7.1 Ensure all tests pass
  - Run all unit tests and property-based tests
  - Verify integration tests pass with various log formats
  - Test performance with realistic datasets
  - Ask the user if questions arise.

- [ ] 7.2 Manual testing with real Datadog logs
  - Test with various JSON structures from different applications
  - Verify field extraction and flattening works correctly
  - Test error handling with malformed JSON in production logs
  - Validate performance with large log volumes