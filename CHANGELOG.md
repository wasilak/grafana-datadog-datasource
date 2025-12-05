# Changelog

## 0.4.0

### Features

- **Query Editor Autocomplete**: Context-aware autocomplete suggestions while writing Datadog queries
  - Real-time metric and tag suggestions
  - Aggregation function suggestions
  - Query syntax validation with helpful error messages
  - Keyboard navigation (arrow keys, Enter, Tab, Escape)
  - 30-second TTL caching to reduce API load
  - 400ms debounce for responsive interaction
  
### Backend Improvements

- Go backend plugin for secure data fetching
  - CallResourceHandler for autocomplete endpoints
  - Concurrent request limiting (max 5 simultaneous)
  - 2-second timeout on Datadog API calls
  - Thread-safe in-memory caching
  - Proper error handling for auth failures

### Documentation

- Comprehensive autocomplete documentation with:
  - Architecture overview
  - Configuration options
  - Usage examples
  - API reference
  - Troubleshooting guide
  - Developer notes

### Testing

- Hook integration tests for autocomplete state management
- QueryEditor component integration tests
- Test coverage for debounce, validation, and error handling

## 0.3.3

- fixed query URI encoding

## 0.3.2

- Query field
  - auto-sizing
  - support for comments: lines starting with `#` + toggling using `cmd+/` or `ctrl+/`
- bumped deps

## 0.3.1

- bumped deps

## 0.3.0

- Code cleanup
- Fixed Explore table data model
- Fixed label templating

## 0.2.0

- Upgraded to current grafana plugin development tooling.
- Fixed support for tags queries and dashboard variable support

## 0.1.0

Initial release.
