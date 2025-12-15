# JSON Log Parsing Feature Design

## Overview

This feature adds JSON parsing capabilities to the Datadog Grafana datasource, enabling users to parse structured JSON data from log fields and access individual properties as separate data frame columns. The implementation provides a UI configuration option to specify which field should be parsed as JSON, with the parsing logic handling the conversion from JSON strings to structured data.

The feature addresses the common use case where applications log structured data as JSON strings, but users need to access individual fields for filtering, visualization, and analysis in Grafana's logs panel.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Logs Query    │    │   Query Model    │    │   Datadog API   │
│   Editor UI     │───▶│   with JSON      │───▶│   Request       │
│                 │    │   Config         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Grafana       │    │   Data Frame     │    │  Backend JSON   │
│   Logs Panel    │◀───│   with Parsed    │◀───│  Parser (Go)    │
│                 │    │   Fields         │    │  interface{}    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         ▲
                                                         │
                                               ┌─────────────────┐
                                               │  Logs Response  │
                                               │  Parser         │
                                               │                 │
                                               └─────────────────┘
```

### Component Interaction

1. **UI Configuration**: User selects JSON parsing options in the query editor
2. **Query Model**: Stores JSON parsing configuration alongside query parameters  
3. **Datadog API Request**: Sends query with JSON parsing config to backend
4. **Backend JSON Parser**: Uses Go's `json.Unmarshal` with `interface{}` to parse specified fields
5. **Logs Response Parser**: Integrates parsed JSON fields into log entries during conversion
6. **Data Frame Creation**: Creates Grafana data frames with both original and parsed fields as columns

### Frontend vs Backend Parsing Decision

Based on the analysis of trade-offs and Go's excellent support for dynamic JSON handling:

**Backend Parsing (Recommended)**:
- **Pros**: 
  - Server-side processing reduces client load
  - Go's `json.Unmarshal` with `interface{}` handles any JSON structure elegantly
  - Standard library solution - no third-party dependencies
  - Automatic type mapping (objects→map[string]interface{}, arrays→[]interface{}, etc.)
  - Better performance for large datasets
  - Cleaner separation of concerns
- **Cons**: Requires backend changes to log response parser
- **Implementation**: Use `json.Unmarshal([]byte(jsonString), &interface{})` in the logs response parser

**Frontend Parsing (Alternative)**:
- **Pros**: No backend changes required, flexible JavaScript JSON parsing
- **Cons**: Client-side processing overhead, potential memory usage with large datasets
- **Implementation**: Parse JSON in the response processing pipeline before creating data frames

**Decision**: Implement backend parsing using Go's standard `encoding/json` with `interface{}`. This approach is idiomatic Go, handles arbitrary JSON structures perfectly, and provides better performance by processing on the server side.

**Technical Approach**:
```go
// In the logs response parser
func parseJSONField(jsonString string) (interface{}, error) {
    var data interface{}
    err := json.Unmarshal([]byte(jsonString), &data)
    if err != nil {
        return nil, fmt.Errorf("error unmarshaling JSON: %w", err)
    }
    return data, nil
}
```

## Components and Interfaces

### UI Components

#### JSON Parsing Configuration Panel
```typescript
interface JSONParsingConfig {
  enabled: boolean;
  targetField: 'whole_log' | 'message' | 'data' | 'attributes' | string;
  maxDepth?: number;
  maxSize?: number;
  preserveOriginal?: boolean;
}

interface LogsQueryEditorProps {
  query: MyQuery & { jsonParsing?: JSONParsingConfig };
  onChange: (query: MyQuery) => void;
  // ... other props
}
```

#### Field Selector Component
```typescript
interface FieldSelectorProps {
  value: string;
  onChange: (field: string) => void;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
}
```

### Backend Interfaces

#### Go JSON Parser (Backend)
```go
// JSONParsingConfig represents the parsing configuration from frontend
type JSONParsingConfig struct {
    Enabled         bool   `json:"enabled"`
    TargetField     string `json:"targetField"`
    MaxDepth        int    `json:"maxDepth,omitempty"`
    MaxSize         int    `json:"maxSize,omitempty"`
    PreserveOriginal bool   `json:"preserveOriginal,omitempty"`
}

// JSONParser handles dynamic JSON parsing using interface{}
type JSONParser struct {
    config JSONParsingConfig
}

func (p *JSONParser) ParseJSONField(jsonString string) (interface{}, error) {
    var data interface{}
    err := json.Unmarshal([]byte(jsonString), &data)
    return data, err
}

func (p *JSONParser) FlattenObject(obj interface{}, prefix string, maxDepth int) map[string]interface{} {
    // Recursively flatten nested objects using interface{} type assertions
}
```

#### Extended Log Entry (Backend)
```go
type LogEntry struct {
    // ... existing fields
    ParsedFields map[string]interface{} `json:"parsedFields,omitempty"`
    ParseErrors  []string               `json:"parseErrors,omitempty"`
}
```

#### Configuration Interface
```typescript
interface JSONParsingOptions {
  enabled: boolean;
  targetField: string;
  flattenNested: boolean;
  maxDepth: number;
  maxSize: number;
  preserveOriginal: boolean;
  errorHandling: 'preserve' | 'skip' | 'fail';
}
```

## Data Models

### Dynamic Schema Handling

A critical aspect of this design is handling the completely unpredictable nature of Datadog log structures. Unlike traditional database schemas, log JSON can contain:

- **Arbitrary nesting levels**: From flat objects to deeply nested structures
- **Variable field types**: Same field name might be string, number, object, or array across different logs
- **Application-specific schemas**: E-commerce, API gateways, databases, microservices all log different structures
- **Evolving schemas**: Applications change their logging format over time
- **Mixed content**: Some logs JSON, others plain text, within the same query

This variability makes static type definitions impossible and requires a fully dynamic parsing approach.

### Extended Query Model
```typescript
interface MyQuery extends DataQuery {
  // ... existing fields
  jsonParsing?: {
    enabled: boolean;
    targetField: string;
    options?: {
      maxDepth?: number;
      maxSize?: number;
      preserveOriginal?: boolean;
      flattenNested?: boolean;
    };
  };
}
```

### Log Entry Extensions
```typescript
interface LogEntry {
  // ... existing fields
  parsedFields?: Record<string, any>;
  parseErrors?: string[];
  originalFields?: Record<string, string>; // Backup of original values
}
```

### Data Frame Field Structure
```typescript
// Original fields remain unchanged
interface OriginalLogFields {
  timestamp: time.Time[];
  body: string[];
  severity: string[];
  id: string[];
  labels: json.RawMessage[];
}

// Additional parsed fields are added dynamically based on actual JSON content
// Structure is completely unpredictable and varies per application/use case
interface ParsedFields {
  [key: string]: any[]; // Completely dynamic fields from JSON parsing
  // Examples (will vary widely per use case):
  // 'parsed_user_name': string[];           // E-commerce app
  // 'parsed_request_method': string[];      // API gateway logs  
  // 'parsed_sql_query': string[];           // Database logs
  // 'parsed_error_code': number[];          // Error tracking
  // 'parsed_customer_tier': string[];       // Business logic
  // 'parsed_geo_location': string[];        // Location services
  // ... infinite possibilities based on application logging
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all properties identified in the prework, several can be consolidated:
- Properties 2.2, 4.1, 4.2, 4.3 all test JSON parsing success and can be combined into a comprehensive parsing property
- Properties 3.1, 3.2, 3.3 all test field creation and can be combined into a field structure property
- Properties 5.1, 5.3, 5.4 all test error handling and can be combined into an error handling property

### Core Properties

**Property 1: JSON Parsing Success**
*For any* log entry with valid JSON in the specified field, parsing should successfully extract the JSON structure and make it available as parsed fields
**Validates: Requirements 2.2, 4.1, 4.2, 4.3**

**Property 2: Field Structure Consistency**
*For any* successfully parsed JSON object, the resulting data frame should contain separate fields for each top-level property, with nested objects flattened using dot notation and arrays serialized as JSON strings
**Validates: Requirements 3.1, 3.2, 3.3**

**Property 3: Error Handling Preservation**
*For any* log entry with invalid JSON or parsing errors, the original field value should be preserved and processing should continue without interruption
**Validates: Requirements 5.1, 5.3, 5.4, 5.5**

**Property 4: Configuration Persistence**
*For any* JSON parsing configuration, enabling and then saving the configuration should result in the same configuration being available when the query is reloaded
**Validates: Requirements 1.3, 1.5**

**Property 5: Field Conflict Resolution**
*For any* parsed JSON that would create field names conflicting with existing fields, the parsed fields should be prefixed with "parsed_" to avoid collisions
**Validates: Requirements 3.4**

**Property 6: Original Data Preservation**
*For any* field that undergoes JSON parsing, both the original and parsed versions should be available in the resulting data frame
**Validates: Requirements 3.5**

**Property 7: Depth and Size Limiting**
*For any* JSON parsing operation, deeply nested objects should be limited to the configured maximum depth and large objects should be rejected if they exceed size limits
**Validates: Requirements 6.3, 6.4**

**Property 8: Parsing Mode Consistency**
*For any* parsing configuration, the system should consistently apply the same parsing logic to all log entries with the same field structure
**Validates: Requirements 2.1, 2.4**

**Property 9: Validation Enforcement**
*For any* query execution attempt, if field selection is required but not provided, the system should prevent execution and provide validation feedback
**Validates: Requirements 7.3**

**Property 10: Configuration State Management**
*For any* JSON parsing configuration change, the system should immediately update the query model and provide visual feedback about the change
**Validates: Requirements 7.5**

## Error Handling

### JSON Parsing Errors
- **Invalid JSON Syntax**: Preserve original field value, log warning, continue processing
- **Parsing Timeout**: Abort parsing for the entry, preserve original, continue with next entry
- **Memory Limits**: Reject oversized JSON, preserve original field, log size limit error
- **Depth Limits**: Stop parsing at max depth, preserve partially parsed structure

### Configuration Errors
- **Missing Field Selection**: Show validation error, prevent query execution
- **Invalid Field Name**: Show warning, suggest valid alternatives
- **Configuration Conflicts**: Auto-resolve with sensible defaults, notify user

### Runtime Errors
- **Field Name Conflicts**: Auto-prefix with "parsed_", log resolution
- **Type Conversion Errors**: Convert to string representation, log conversion issue
- **Data Frame Creation Errors**: Fall back to original structure, log error details

## Testing Strategy

### Dual Testing Approach

The implementation will use both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests**:
- Specific JSON parsing scenarios (valid/invalid JSON)
- UI component behavior (dropdown selection, configuration changes)
- Error handling edge cases (malformed JSON, empty fields, null values)
- Integration points between components

**Property-Based Tests**:
- Universal properties that should hold across all inputs
- JSON parsing correctness across randomly generated JSON structures
- Field creation consistency with various object shapes
- Error handling behavior with randomly generated invalid inputs
- Configuration persistence across different query structures

**Property-Based Testing Framework**: Use `fast-check` for JavaScript property-based testing, configured to run a minimum of 100 iterations per property test.

**Property Test Tagging**: Each property-based test will be tagged with comments referencing the design document property:
- Format: `**Feature: json-log-parsing, Property {number}: {property_text}**`
- Example: `**Feature: json-log-parsing, Property 1: JSON Parsing Success**`

### Test Categories

1. **JSON Parsing Logic Tests**
   - Valid JSON parsing across different structures
   - Invalid JSON handling and error recovery
   - Nested object flattening with dot notation
   - Array serialization behavior
   - Size and depth limit enforcement

2. **UI Component Tests**
   - Configuration panel rendering and interaction
   - Field selector dropdown behavior
   - Validation feedback display
   - Configuration persistence in query model

3. **Integration Tests**
   - End-to-end parsing from UI configuration to data frame creation
   - Error propagation through the processing pipeline
   - Performance with large datasets
   - Compatibility with existing log processing

4. **Property-Based Tests**
   - Parsing consistency across random JSON inputs
   - Field structure invariants
   - Error handling properties
   - Configuration round-trip properties

### Performance Testing

- **Large Dataset Testing**: Validate parsing performance with 10,000+ log entries
- **Memory Usage Testing**: Monitor memory consumption during JSON parsing
- **Timeout Testing**: Verify parsing timeouts work correctly with complex JSON
- **Comparison Testing**: Measure performance impact when JSON parsing is enabled vs disabled