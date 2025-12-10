# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2024-12-10

### Added
- **Query Editor Autocomplete**: Complete autocomplete functionality for Datadog queries
  - Metric name autocomplete with real-time suggestions from Datadog API
  - Tag key autocomplete based on selected metrics
  - Tag value autocomplete with support for filter contexts
  - Boolean operator support (OR, AND, IN, NOT IN) in filter expressions
  - Smart autocomplete triggering based on cursor position and context
- **Multi-platform Build Support**: Comprehensive build system for all major platforms
  - Linux (x86-64 and ARM64)
  - macOS (Intel and Apple Silicon)
  - Windows (x86-64)
  - Automated GitHub Actions workflow for releases
- **Keyboard Shortcuts**: Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux) support for query execution
  - Works in both query editor and label input fields

### Fixed
- **Series Data Bug**: Fixed duplicate series data issue where multiple series showed identical values
- **Parser Improvements**: Enhanced query parsing for complex boolean expressions
- **Validation Errors**: Improved error handling for incomplete queries and boolean operators
- **Autocomplete Triggering**: Fixed autocomplete not triggering in various edge cases
- **Double Colon Bug**: Fixed issue where colons were being inserted twice in tag completions

### Technical Improvements
- Enhanced error handling and logging throughout the codebase
- Improved query validation with better user feedback
- Optimized autocomplete performance with proper debouncing
- Better context detection for different parts of Datadog query syntax
- Comprehensive test coverage for autocomplete functionality

## [0.3.3] - Previous Release
- Initial release with basic Datadog datasource functionality