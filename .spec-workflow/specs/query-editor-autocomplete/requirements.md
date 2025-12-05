# Requirements Document: Query Editor Autocomplete

## Introduction

This specification defines the requirements for adding intelligent autocomplete functionality to the Grafana Datadog datasource query editor. Currently, users must manually type Datadog metric queries without any assistance or validation. This feature will provide context-aware autocomplete suggestions after a debounce period, showing available aggregations, metric names, and tags from the Datadog API. This will significantly improve the user experience by reducing errors, learning time, and typing effort.

## Alignment with Product Vision

The Grafana Datadog datasource plugin aims to provide seamless integration between Grafana and Datadog. Adding autocomplete aligns with this vision by:
- Making the plugin more user-friendly and discoverable
- Reducing query errors and validation time
- Improving user productivity when building dashboards
- Bringing the plugin closer to feature parity with Grafana's native datasources

## Requirements

### Requirement 1: Debounced Autocomplete Trigger

**User Story:** As a dashboard builder, I want autocomplete suggestions to appear automatically after I pause typing, so that I don't get overwhelmed with suggestions while I'm actively typing.

#### Acceptance Criteria

1. WHEN a user types in the query field THEN the autocomplete trigger SHALL NOT fire immediately
2. WHEN a user pauses typing for 300-500ms AND the cursor is in the query field THEN the system SHALL trigger autocomplete
3. WHEN a user continues typing within the debounce period THEN the previous autocomplete trigger SHALL be cancelled and rescheduled
4. WHEN a user deletes text AND pauses THEN the system SHALL update suggestions based on new query state

### Requirement 2: Metric Name Suggestions

**User Story:** As a dashboard builder, I want to see available metric names from Datadog as I type, so that I can discover and select metrics without memorizing their names.

#### Acceptance Criteria

1. WHEN autocomplete triggers on an empty query THEN the system SHALL suggest the top available metric names from Datadog
2. WHEN a user types a metric name prefix THEN the system SHALL filter and show matching metric names
3. WHEN a user selects a metric from the suggestions THEN the system SHALL insert it into the query at the cursor position
4. WHEN autocomplete retrieves metrics from Datadog API AND the API request takes >2 seconds THEN the system SHALL show a loading state

### Requirement 3: Aggregation Function Suggestions

**User Story:** As a dashboard builder, I want to see available aggregation functions (sum, avg, min, max, etc.), so that I can quickly apply the desired aggregation to metrics.

#### Acceptance Criteria

1. WHEN autocomplete triggers after a metric name THEN the system SHALL suggest available aggregation functions
2. WHEN a user types an aggregation prefix THEN the system SHALL filter and show matching aggregations
3. WHEN a user selects an aggregation from suggestions THEN the system SHALL insert it into the query at the cursor position
4. WHEN a query contains no metric THEN the system SHALL suggest aggregations at appropriate query positions

### Requirement 4: Tag Suggestions

**User Story:** As a dashboard builder, I want to see available tags for the current metric, so that I can filter metrics by relevant tags without manual research.

#### Acceptance Criteria

1. WHEN a user enters a tag filter context (after `{` or after `by `) THEN the system SHALL suggest available tags for the current metric
2. WHEN a user types a tag key prefix THEN the system SHALL filter and show matching tag names
3. WHEN a user selects a tag from suggestions THEN the system SHALL insert it into the query at the cursor position
4. WHEN multiple tags are already in the query THEN the system SHALL only suggest tags not already used

### Requirement 5: Query Validation with Feedback

**User Story:** As a dashboard builder, I want to receive feedback on whether my query is valid, so that I catch errors before executing.

#### Acceptance Criteria

1. WHEN a user completes a query AND the debounce timer expires THEN the system SHALL validate the query syntax
2. IF query validation fails THEN the system SHALL display a clear error message describing what is invalid
3. WHEN validation reveals missing components (e.g., metric without aggregation) THEN the system SHALL provide helpful suggestions
4. WHEN a query is valid THEN the system SHALL show a visual indicator (e.g., green checkmark)

### Requirement 6: Keyboard Navigation

**User Story:** As a power user, I want to navigate and select from autocomplete suggestions using keyboard shortcuts, so that I don't have to use the mouse.

#### Acceptance Criteria

1. WHEN autocomplete dialog is open AND user presses Arrow Up/Down THEN the system SHALL navigate through suggestions
2. WHEN a suggestion is highlighted AND user presses Enter THEN the system SHALL insert the suggestion into the query
3. WHEN autocomplete dialog is open AND user presses Escape THEN the system SHALL close the dialog
4. WHEN user presses Tab THEN the system SHALL accept the highlighted suggestion and move focus appropriately

### Requirement 7: Autocomplete Dialog UI

**User Story:** As a user, I want the autocomplete suggestions to be displayed in a Grafana-standard dialog format, so that the interface feels consistent with the rest of Grafana.

#### Acceptance Criteria

1. WHEN autocomplete triggers THEN the system SHALL display suggestions in a Grafana-native autocomplete dialog
2. WHEN multiple suggestions are available AND more than 10 items THEN the system SHALL show scrollable list
3. WHEN a user moves cursor away from the query field THEN the system SHALL close the autocomplete dialog
4. WHEN suggestions load from API THEN the system SHALL show loading spinner/skeleton state

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility Principle**: Autocomplete logic, suggestion fetching, and UI rendering should be in separate, focused modules
- **Modular Design**: 
  - Create a dedicated `useAutocomplete` hook for debouncing and suggestion state management
  - Separate API call logic into utility functions (e.g., `fetchMetricSuggestions`, `fetchAggregations`, `fetchTagsForMetric`)
  - Extract suggestion parsing logic into helper functions
- **Dependency Management**: 
  - Minimize direct datasource coupling; use dependency injection for API calls
  - Keep suggestion logic independent of UI rendering
- **Clear Interfaces**: Define clear types for suggestion objects, API responses, and hook parameters

### Performance

- **Debounce Duration**: 300-500ms to balance responsiveness and API call volume
- **API Response Time**: Suggestions must load within 2 seconds or show timeout message
- **Cache**: Cache API responses for recently queried metrics (30-second TTL) to reduce redundant calls
- **Query Parsing**: Parsing and matching suggestions must complete in <100ms

### Security

- **No Credentials in Suggestions**: Ensure no API keys, passwords, or secrets appear in autocomplete suggestions
- **XSS Prevention**: Sanitize all suggestion text before rendering
- **CORS**: Ensure autocomplete requests go through Grafana backend proxy (via plugin route)

### Reliability

- **Graceful Degradation**: If autocomplete API calls fail, the editor should remain fully functional
- **Error Handling**: Network errors should not crash the query editor or leave it in an invalid state
- **Fallback Behavior**: If suggestion fetching fails, show helpful message encouraging manual entry

### Usability

- **Clear Suggestion Labels**: Each suggestion should clearly indicate what type it is (metric, aggregation, tag)
- **Keyboard-First**: Full support for keyboard navigation; mouse/click support optional but recommended
- **Smart Context**: Suggestions should change based on cursor position in the query (e.g., different suggestions after `{` vs at query start)
- **Accessibility**: Autocomplete dialog must follow WCAG 2.1 AA standards with proper ARIA labels
