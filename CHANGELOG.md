## [0.7.1] - 2026-10-15

### 🐛 Bug Fixes

- Use setTimeout return type for debounce timer ref
- Stop logging API and App key prefixes
- Stop logging resource request headers and bodies

### 🚜 Refactor

- Replace deprecated rxjs, theme and DataQuery APIs
- Replace deprecated Select with Combobox
- Move variable editor to CustomVariableSupport

### 📚 Documentation

- Publish missing logs docs and fix broken links

### ⚙️ Miscellaneous Tasks

- *(backend)* Fix golangci-lint findings and gofmt
## [0.7.0] - 2026-10-14

### 🐛 Bug Fixes

- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.292.1 (#715)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.62.0 (#749)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.294.0 (#750)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.295.0 (#767)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.296.0 (#769)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.296.1 (#770)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.63.0 (#773)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.296.2 (#778)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.64.0 (#782)
- *(deps)* Update module github.com/stretchr/testify to v1.12.0 (#785)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.296.3 (#787)
- *(deps)* Update module github.com/stretchr/testify to v1.12.1 (#789)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.296.4 (#799)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.65.0 (#810)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.296.5 (#833)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.66.0 (#847)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.297.0 (#861)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.67.0 (#877)
- Resolve type check and lint errors

### ⚙️ Miscellaneous Tasks

- Fix release packaging and add PR checks
## [0.6.3] - 2026-05-17

### 🚀 Features

- *(ci)* Create GitHub release with auto-generated notes on tag push
## [0.6.1] - 2026-05-17

### 🐛 Bug Fixes

- Resolve security vulnerabilities in Go and JS dependencies
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.57.0 (#638)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.58.0 (#655)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.59.0 (#664)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.60.0 (#697)
- *(ci)* Restore complete release workflow and fix YAML syntax error
- *(ci)* Install all deps (not just production) for frontend build

### ⚙️ Miscellaneous Tasks

- Update build-plugin action to v1.2.0
- Add diagnostics and increase timeout to investigate runner disconnects
- Install production deps and prune node_modules golang folders to avoid go-manifest errors
## [0.6.0] - 2026-03-27

### 🐛 Bug Fixes

- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.285.0 (#516)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.54.0 (#519)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.286.0 (#530)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.287.0 (#553)
- *(deps)* Update module github.com/grafana/grafana-plugin-sdk-go to v0.288.0 (#563)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.55.0 (#576)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.56.0 (#607)
- Stability improvements, singleton API client, bounded LRU cache, and build fixes
## [0.5.2] - 2026-01-12

### 🐛 Bug Fixes

- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.52.0 (#492)
- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.53.0 (#506)
- Remove broken semaphore causing plugin deadlock and restarts
- Resolve security vulnerability and fix broken documentation links
## [0.5.1] - 2025-12-15

### 📚 Documentation

- Update spec tasks to reflect completed automatic field parsing
- Make plugin comparison table more factual and accurate
- Simplify plugin comparison to focus on key benefit
## [0.5.0] - 2025-12-15

### 🚀 Features

- Implement logs query type detection and routing
- Implement Datadog Logs API integration
- Implement logs data frame structure
- Enhance logs data frame structure with validation and testing
- Implement logs query editor frontend component
- Extend autocomplete system for logs
- Add query type selector to enable logs query mode
- Implement log level and service filtering
- Implement variable interpolation support for logs queries
- Implement pagination and caching for logs
- Extend error handling for logs-specific errors
- Implement logs query validation and help system
- Add debug logging for Datadog Logs API requests
- Implement rate limiting and retry logic for Datadog Logs API
- Update task completion status for logs implementation
- Implement boolean operators and advanced search for logs queries
- Add logs visualization metadata for enhanced panel support
- Implement user-controlled pagination for logs queries
- Complete task 13 checkpoint - all tests passing
- Add loading indicators and improve pagination cursor management
- Improve loading indicator visual design
- Implement frontend page cache to eliminate stale data
- Add visual cache indicator for pagination
- Fix plugin configuration for logs support
- Rewrite LogEntry model and createLogsDataFrames for Grafana logs standards
- Simplify LogsQueryEditor pagination by removing complex frontend caching
- Implement Query Handler Architecture Pattern
- Implement Request Builder Pattern for Datadog APIs
- Implement response parser pattern for logs and metrics
- Enhance autocomplete system architecture for logs
- Implement real Datadog Logs API calls for autocomplete
- Fix logs autocomplete issues
- Add host and env field values autocomplete support
- Implement logs tags VALUES autocomplete support
- Implement search word highlighting for logs queries
- Implement log filtering support with modifyQuery method
- Implement trace linking support for logs
- Enhance error parsing for logs-specific errors
- Implement makeDatadogAPIRequest method for logs aggregation API
- Implement logs volume data frame generation
- Complete logs volume query type detection and routing
- Add search term extraction for logs highlighting
- Complete logs volume histogram implementation
- Calculate logs volume histogram from log entries
- Add JSON parsing configuration to query model
- Implement JSON parsing configuration panel in LogsQueryEditor
- Implement reusable FieldSelector component with validation
- Implement JSON parsing configuration struct in Go
- Implement core JSON parser with interface{} and field flattening
- Extend LogEntry struct for JSON parsing support
- Integrate JSON parser into logs response processing
- Update data frame creation for parsed fields
- Implement comprehensive error handling and performance safeguards for JSON parsing
- Implement comprehensive JSON parsing validation
- Implement JSON parsing configuration persistence
- Add comprehensive JSON log parsing documentation
- Create individual columns for attributes and tags to enable Grafana UI filtering/aggregation
- Remove JSON parsing UI and make field flattening automatic
- Remove JSON parsing UI and make field flattening automatic

### 🐛 Bug Fixes

- Critical fixes for logs autocomplete integration
- Implement actual Datadog Logs API integration and fix compilation errors
- Update logs API implementation to use GET with query parameters
- Correct Datadog logs search syntax to match official documentation
- Update logs syntax help and autocomplete to use correct Datadog syntax
- Correct Datadog Logs API v2 request format
- Use ISO timestamp format for Datadog Logs API
- Improve rate limiting protection for logs pagination
- Improve pagination UI for logs query editor
- Improve logs pagination caching to prevent stale data
- Improve logs pagination cache debugging and reduce TTL
- Improve loading state management for pagination
- Improve pagination caching and loading indicators
- Remove all mock data from autocomplete handlers
- Provide basic facet suggestions even without backend data
- Resolve host field values autocomplete issues
- Correct logs search API response parsing for tags autocomplete
- Make logs field value extraction dynamic and more robust
- Ensure autocomplete endpoints always return arrays instead of null
- Correct logs test expectations to match implementation
- Use logs search API for volume data instead of aggregation endpoint
- Correct logs volume handler API response parsing
- Increase logs volume query limit from 1 to 1000
- Ensure all log timestamps are in UTC for Grafana
- Align logs volume frame structure with Grafana expectations
- Use cached log entries for volume histogram - no extra API calls
- Remove all API calls from LogsVolumeHandler - use cache only
- Sort logs by timestamp descending (newest first)
- Include volume histogram frame directly in logs response
- Separate logs and volume frames, remove dead code
- Improve cache consistency and increase TTL to reduce rate limiting
- Explicitly handle logs-volume query type in queryLogs
- Disable streaming in plugin.json to prevent repeated queries
- Extract individual attributes and tags directly to LogEntry for proper Grafana field detection
- Implement proper field flattening with dot notation for nested JSON structures
- Restore absolute GitHub URLs in README for Grafana plugin validation

### 💼 Other

- Add comprehensive logging to diagnose empty autocomplete results
- Add logging to supplementary queries for logs volume

### 🚜 Refactor

- Remove limit field from logs query, use Grafana's MaxDataPoints
- Simplify JSON parsing to always parse attributes/tags, optional message parsing

### 📚 Documentation

- Improve README with proper links and feature status table

### 🧪 Testing

- Implement logs API integration consistency property test
- Add comprehensive tests for logs volume handler

### ◀️ Revert

- Remove tracing implementation - focus on logs and metrics
## [0.4.3] - 2025-12-12

### 🚀 Features

- Add main query method to DataSource class
- Implement native Grafana styling with collapsible Options section
- Improve Variable Examples button placement
- Add Grafana to Datadog formula conversion
- Complete frontend support for Grafana expressions
- Add interval override option to query editor

### 🐛 Bug Fixes

- Add legend fields to Go backend QueryModel struct
- Remove custom query method causing 404 errors
- Improve Variable Examples button positioning and styling
- Resolve pointer type mismatch in processTimeseriesResponse call
- Apply proper legend formatting in processTimeseriesResponse
- Ignore legacy label fields in auto legend mode
- Convert relative links to absolute URLs for Grafana plugin catalog

### 🚜 Refactor

- Remove deprecated label field completely

### 📚 Documentation

- Restructure and enhance documentation

### 🎨 Styling

- Apply autofix formatting to QueryEditor.tsx

### 🧪 Testing

- Update test files to use new legend fields instead of deprecated label field
## [0.4.2] - 2025-12-11

### 🚀 Features

- Implement backend resource handlers for variables
- Enhance logging and error handling for variable operations
- Extend data models with variable support
- Implement variable interpolation service
- Mark variable interpolation task as complete
- Implement VariableQueryEditor component for Grafana variables
- Enhance VariableQueryEditor with autocomplete and improved UX
- Use '*' wildcard convention for "all" in variable queries
- Remove restrictive validation and make metrics/tags independent
- Add comprehensive organization-wide tags API endpoint
- Implement proper pagination for Datadog v2/metrics API
- Add regex support for variable query filtering
- Allow empty fields in variable query editor with validation warnings
- Fetch real tag values from Datadog API when metricName is "*"
- Remove all hardcoded mock data from variable handlers
- Working variable support with wildcard queries
- Enhance DataSource class with complete variable support
- Implement QueryEditorHelp component with variable examples
- Extend QueryEditor with Explore mode support
- Implement panel label variable support
- Integrate variable support with existing query system
- Complete plugin configuration and registration for variable support

### 🐛 Bug Fixes

- *(deps)* Update module github.com/datadog/datadog-api-client-go/v2 to v2.51.0 (#467)
- Add .yarnrc to ignore engine compatibility checks
- Correct mage target names in Makefile
- Correct variable resource handler routing paths
- Resolve TypeScript compilation errors
- Implement smart whitespace trimming for regex patterns
- Handle regex patterns in tag keys variable queries
- Comprehensive regex pattern support for all variable endpoints
- Handle wildcard metric name in tag values variable queries
- Remove ALL hardcoded mock data from variable handlers
- Force clear ALL cache entries to remove old mock data
- Implement proper tag keys fetching for wildcard queries
- Check both Metric and MetricTagConfiguration fields in tag keys handler
- Apply same field order fix to tag values wildcard handler
- Resolve TypeScript error in Explore mode visualization type
- Remove unused getTemplateSrv import
- Resolve tablewriter version conflict for backend build

### 💼 Other

- Add critical debugging to track mock data source
- Add plugin loading verification and annotations support
- Add debugging to VariableTagKeysHandler

### 🚜 Refactor

- Implement smart single-field regex support
- Comprehensive cleanup and optimization of variable handlers

### 📚 Documentation

- Mark Task 3 as completed
## [0.4.1] - 2025-12-10

### 🚀 Features

- Modernize GitHub Actions workflows with official Grafana plugin actions
- Add private plugin signing step to GitHub Actions
- Add complete GitHub release workflow with artifact upload
- Update all configuration files to match official Grafana plugin structure

### 🐛 Bug Fixes

- Remove unnecessary NODE_ENV from docker-compose
- Correct plugin installation instructions and add troubleshooting
- Remove Grafana Cloud token dependency from plugin signing
- Correct Go version from 1.25 to 1.21 in go.mod
- Configure GitHub Actions to use Go 1.25 to match local environment
- Use go-version parameter in grafana/plugin-actions instead of separate setup
- Add mock coverage target for GitHub Actions compatibility
- Add plugin signing configuration with rootUrls
- Remove unsupported signing parameters and policy_token
- Use correct rootUrls format for plugin signing
- Use package-plugin action directly to avoid validation issues
- Add Go plugin build manifest generation
- Add conditional plugin signing with GRAFANA_ACCESS_POLICY_TOKEN
- Sign plugin for production domain
- Update release workflow to use Go 1.25 and disable signing
- Update release workflow to use Node.js 22

### 🚜 Refactor

- Adopt official Grafana plugin SDK build system

### 📚 Documentation

- Add comprehensive usage instructions and fix docker-compose
- Update installation instructions for v0.4.1 release
- Fix plugin validation issues and improve documentation

### ⚙️ Miscellaneous Tasks

- Bump version to 0.4.1 for properly signed release
- Remove CI workflow to reduce complexity
## [0.4.0] - 2025-12-10

### 🚀 Features

- Migrate to Grafana CodeEditor with syntax highlighting
- Add mouse interaction support to autocomplete
- Implement Cmd+Enter popup dismissal
- Implement theme-aware styling using Grafana useTheme2 hook
- Add grouping utility function for autocomplete suggestions
- Update useQueryAutocomplete to use grouped suggestions
- Update QueryEditor to render grouped suggestions
- Add autocomplete support for grouping tags in 'by {}' clause
- Implement grouping tag autocomplete and fix query execution
- Add ddqp library and create integration tasks
- Improve autocomplete with grouping tag support (WIP)
- Implement backend-driven autocomplete completion
- Add filter_tag_key context detection to parser
- Add filter tag key suggestions generator
- Add filter_tag_key completion handler to backend
- Add backend endpoint for tag values
- Update parser to detect filter tag value context
- Update suggestions generator for filter tag values
- Update backend completion handler for filter tag values
- Support boolean operators in filter autocomplete
- Complete filter tag autocomplete implementation
- Add Cmd+Enter support for query execution in label input field
- Add comprehensive multi-platform build support

### 🐛 Bug Fixes

- Remove unused variables in QueryEditor
- Use onMouseDown instead of onClick for autocomplete selection
- Keyboard navigation in autocomplete popup
- Use ref to track autocomplete state for keyboard navigation
- Prevent default immediately for autocomplete keyboard events
- Add closure-free navigation methods for autocomplete
- Correct query validator to handle 'by' grouping clause
- ENTER key now uses backend completion like mouse click
- Autocomplete triggers after comma without space + debug logging
- Autocomplete now works correctly with ENTER key and comma triggers
- Suppress validation error when typing tag value
- Detect filter tag value context when cursor at closing brace
- Prevent double colon when completing filter tag key
- Remove colon from frontend tag key insertText
- Remove unused variables to fix TypeScript errors
- Trigger tag value autocomplete after '(' for IN operator
- IN operator comma-separated values trigger VALUE autocomplete
- Validator now supports boolean operators in filter section
- Prevent duplicate series for boolean operator queries
- Use series index instead of queryIndex for values array
- Improve series processing debug logging and fix min function issue
- Remove non-existent coverage target from GitHub Actions
- Remove coverage target from CI workflow as well

### 💼 Other

- Add filter autocomplete tasks for tag key:value pairs
- Add logging to understand Datadog API response
- Remove provisioning files with credentials and improve README
- Complete removal of provisioning directory

### 📚 Documentation

- Add steering rule for modern CLI tools (fd and ripgrep)

### ⚙️ Miscellaneous Tasks

- Mark task 3 as completed in tasks.md
- Bump version to 0.4.0 and add comprehensive changelog
## [0.1.0] - 2021-09-15
