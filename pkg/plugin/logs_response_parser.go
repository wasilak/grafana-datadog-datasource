package plugin

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LogsResponseParser handles conversion from Datadog Logs API response to Grafana data frames
// Implements proper field mapping (body, severity, labels structure)
// Follows OpenSearch's separation of concerns pattern
// Requirements: 1.2, 5.1, 5.2, 5.3, 5.4
type LogsResponseParser struct {
	datasource *Datasource
}

// NewLogsResponseParser creates a new LogsResponseParser instance
func NewLogsResponseParser(datasource *Datasource) *LogsResponseParser {
	return &LogsResponseParser{
		datasource: datasource,
	}
}

// ParseResponse parses Datadog Logs API response and converts to Grafana data frames
// Handles both structured and unstructured response formats
func (p *LogsResponseParser) ParseResponse(apiResponse interface{}, refID string, query string) (data.Frames, error) {
	logger := log.New()

	// Handle different response formats
	switch resp := apiResponse.(type) {
	case LogsResponse:
		// Structured response format
		return p.parseStructuredResponse(resp, refID, query)
	case map[string]interface{}:
		// Map response format
		return p.parseMapResponse(resp, refID, query)
	case []map[string]interface{}:
		// Direct data array format
		return p.parseDataArray(resp, refID, query)
	default:
		logger.Error("Unsupported response format", "type", fmt.Sprintf("%T", apiResponse))
		return nil, fmt.Errorf("unsupported response format: %T", apiResponse)
	}
}

// parseStructuredResponse parses LogsResponse struct format
func (p *LogsResponseParser) parseStructuredResponse(response LogsResponse, refID string, query string) (data.Frames, error) {
	logger := log.New()
	logger.Debug("Parsing structured logs response", "entryCount", len(response.Data))

	// Convert log entries from response
	logEntries, err := p.convertDataArrayToLogEntries(response.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to convert log entries: %w", err)
	}

	// Create data frames using the corrected structure
	frames := p.createLogsDataFrames(logEntries, refID, query)
	
	// Add pagination metadata if available
	if response.Meta.Page.After != "" {
		p.addPaginationMetadata(frames, response.Meta.Page.After)
	}

	return frames, nil
}

// parseMapResponse parses map[string]interface{} response format
func (p *LogsResponseParser) parseMapResponse(responseMap map[string]interface{}, refID string, query string) (data.Frames, error) {
	logger := log.New()

	// Extract data array from response map
	dataInterface, exists := responseMap["data"]
	if !exists {
		logger.Debug("No data field in response, returning empty results")
		return p.createEmptyLogsDataFrame(refID), nil
	}

	dataArray, ok := dataInterface.([]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid data format: expected array, got %T", dataInterface)
	}

	// Convert to map array format
	mapArray := make([]map[string]interface{}, len(dataArray))
	for i, item := range dataArray {
		if itemMap, ok := item.(map[string]interface{}); ok {
			mapArray[i] = itemMap
		} else {
			logger.Warn("Skipping invalid log entry", "index", i, "type", fmt.Sprintf("%T", item))
			continue
		}
	}

	return p.parseDataArray(mapArray, refID, query)
}

// parseDataArray parses []map[string]interface{} data array format
func (p *LogsResponseParser) parseDataArray(dataArray []map[string]interface{}, refID string, query string) (data.Frames, error) {
	logger := log.New()
	logger.Debug("Parsing logs data array", "entryCount", len(dataArray))

	// Convert log entries from data array
	logEntries, err := p.convertDataArrayToLogEntries(dataArray)
	if err != nil {
		return nil, fmt.Errorf("failed to convert log entries: %w", err)
	}

	// Create data frames using the corrected structure
	return p.createLogsDataFrames(logEntries, refID, query), nil
}

// convertDataArrayToLogEntries converts Datadog API data array to LogEntry structs
func (p *LogsResponseParser) convertDataArrayToLogEntries(dataArray []map[string]interface{}) ([]LogEntry, error) {
	logger := log.New()
	var logEntries []LogEntry

	for i, item := range dataArray {
		// Extract log ID
		logID := ""
		if id, exists := item["id"]; exists {
			if idStr, ok := id.(string); ok {
				logID = idStr
			}
		}

		// Extract attributes
		attributesInterface, exists := item["attributes"]
		if !exists {
			logger.Warn("Skipping log entry without attributes", "index", i, "id", logID)
			continue
		}

		attributes, ok := attributesInterface.(map[string]interface{})
		if !ok {
			logger.Warn("Skipping log entry with invalid attributes", "index", i, "id", logID)
			continue
		}

		// Parse timestamp
		timestamp, err := p.parseTimestamp(attributes)
		if err != nil {
			logger.Warn("Failed to parse timestamp, using current time", "index", i, "id", logID, "error", err)
			timestamp = time.Now()
		}

		// Extract standard fields using the corrected structure
		body, severity, labels := p.extractLogAttributes(attributes)

		// Create log entry with corrected structure
		entry := LogEntry{
			ID:        logID,
			Timestamp: timestamp,
			Body:      body,     // ✅ CORRECT - Changed from Message
			Severity:  severity, // ✅ CORRECT - Changed from Level
			Labels:    labels,   // ✅ CORRECT - All metadata as JSON
		}

		logEntries = append(logEntries, entry)
	}

	logger.Debug("Successfully converted log entries", "entriesReturned", len(logEntries))
	return logEntries, nil
}

// parseTimestamp parses timestamp from log attributes and ensures UTC timezone
// Grafana expects all timestamps in UTC for proper display
func (p *LogsResponseParser) parseTimestamp(attributes map[string]interface{}) (time.Time, error) {
	timestampInterface, exists := attributes["timestamp"]
	if !exists {
		return time.Time{}, fmt.Errorf("timestamp field not found")
	}

	var parsedTime time.Time
	var err error

	switch ts := timestampInterface.(type) {
	case string:
		// Try RFC3339 format first (Datadog standard)
		if parsedTime, err = time.Parse(time.RFC3339, ts); err == nil {
			return parsedTime.UTC(), nil
		}
		// Try RFC3339Nano format
		if parsedTime, err = time.Parse(time.RFC3339Nano, ts); err == nil {
			return parsedTime.UTC(), nil
		}
		// Try other common formats
		formats := []string{
			"2006-01-02T15:04:05.000Z",
			"2006-01-02T15:04:05Z",
			"2006-01-02 15:04:05",
		}
		for _, format := range formats {
			if parsedTime, err = time.Parse(format, ts); err == nil {
				return parsedTime.UTC(), nil
			}
		}
		return time.Time{}, fmt.Errorf("unable to parse timestamp string: %s", ts)
	case float64:
		// Unix timestamp in seconds - already UTC
		return time.Unix(int64(ts), 0).UTC(), nil
	case int64:
		// Unix timestamp in seconds or milliseconds - already UTC
		if ts > 1e12 { // Likely milliseconds
			return time.UnixMilli(ts).UTC(), nil
		}
		return time.Unix(ts, 0).UTC(), nil
	default:
		return time.Time{}, fmt.Errorf("unsupported timestamp type: %T", ts)
	}
}

// extractLogAttributes extracts log attributes in the corrected format for Grafana logs
// Returns body, severity, and labels as JSON for the new LogEntry structure
func (p *LogsResponseParser) extractLogAttributes(attributes map[string]interface{}) (string, string, json.RawMessage) {
	var body, severity string

	// Extract body (message content)
	if msg, ok := attributes["message"].(string); ok {
		body = msg
	}

	// Extract severity (log level)
	if lvl, ok := attributes["status"].(string); ok {
		severity = strings.ToUpper(lvl) // Normalize to uppercase
	}

	// Build labels structure containing all metadata
	labels := LogLabels{}

	// Extract service
	if svc, ok := attributes["service"].(string); ok {
		labels.Service = svc
	}

	// Extract source
	if src, ok := attributes["source"].(string); ok {
		labels.Source = src
	}

	// Extract host
	if h, ok := attributes["host"].(string); ok {
		labels.Host = h
	}

	// Extract environment
	if env, ok := attributes["env"].(string); ok {
		labels.Env = env
	}

	// Extract version
	if version, ok := attributes["version"].(string); ok {
		labels.Version = version
	}

	// Extract tags (Datadog returns tags as array of "key:value" strings)
	if tagsArray, ok := attributes["tags"].([]interface{}); ok {
		labels.Tags = make(map[string]string)
		for _, tag := range tagsArray {
			if tagStr, ok := tag.(string); ok {
				parts := strings.SplitN(tagStr, ":", 2)
				if len(parts) == 2 {
					labels.Tags[parts[0]] = parts[1]
				}
			}
		}
	}

	// Collect remaining attributes
	labels.Attributes = make(map[string]interface{})
	for key, value := range attributes {
		if key != "message" && key != "status" && key != "service" &&
			key != "source" && key != "host" && key != "tags" && key != "timestamp" &&
			key != "env" && key != "version" {
			labels.Attributes[key] = value
		}
	}

	// Marshal labels to JSON
	labelsJSON, err := json.Marshal(labels)
	if err != nil {
		// If marshaling fails, create minimal JSON
		labelsJSON = json.RawMessage(`{}`)
	}

	return body, severity, labelsJSON
}

// createLogsDataFrames creates Grafana DataFrames from log entries using corrected structure
// Requirements: 1.2, 5.1, 5.2, 5.3, 5.4, 13.1
func (p *LogsResponseParser) createLogsDataFrames(logEntries []LogEntry, refID string, query string, timeRange ...backend.TimeRange) data.Frames {
	logger := log.New()

	// Validate input parameters
	if refID == "" {
		logger.Warn("Empty refID provided for logs data frame")
		refID = "logs" // Default refID
	}

	// Handle empty log entries case
	if len(logEntries) == 0 {
		logger.Debug("No log entries provided, creating empty logs data frame", "refID", refID)
		return p.createEmptyLogsDataFrame(refID)
	}

	// Create data frame with proper structure for logs
	frame := data.NewFrame("logs")
	frame.RefID = refID

	// Prepare slices for each field with proper capacity
	entryCount := len(logEntries)
	timestamps := make([]time.Time, entryCount)
	bodies := make([]string, entryCount)           // ✅ CORRECT - Changed from messages
	severities := make([]string, entryCount)       // ✅ CORRECT - Changed from levels
	ids := make([]string, entryCount)              // ✅ CORRECT - Added ID field
	labels := make([]json.RawMessage, entryCount)  // ✅ CORRECT - Single labels field with JSON

	// Validate and sanitize log entries
	var validationErrors []string
	sanitizedEntries := make([]LogEntry, entryCount)

	for i, entry := range logEntries {
		// Validate entry
		if errors := p.validateLogEntry(entry, i); len(errors) > 0 {
			validationErrors = append(validationErrors, errors...)
		}

		// Sanitize entry
		sanitizedEntries[i] = p.sanitizeLogEntry(entry)
	}

	// Log validation errors but continue processing
	if len(validationErrors) > 0 {
		logger.Warn("Log entry validation errors found",
			"errorCount", len(validationErrors),
			"errors", validationErrors)
	}

	// Populate data from sanitized log entries using corrected field structure
	for i, entry := range sanitizedEntries {
		timestamps[i] = entry.Timestamp

		// ✅ CORRECT - Use Body field instead of Message
		bodies[i] = entry.Body // Can be empty after sanitization

		// ✅ CORRECT - Use Severity field instead of Level, with default
		if entry.Severity != "" {
			severities[i] = entry.Severity
		} else {
			severities[i] = "INFO" // Default severity if not specified
		}

		// ✅ CORRECT - Include ID field
		ids[i] = entry.ID

		// ✅ CORRECT - Use Labels field as JSON
		if len(entry.Labels) > 0 {
			labels[i] = entry.Labels
		} else {
			labels[i] = json.RawMessage(`{}`) // Empty JSON object if no labels
		}
	}

	// ✅ CORRECT - Create timestamp field (standard name)
	timestampField := data.NewField("timestamp", nil, timestamps)
	timestampField.Config = &data.FieldConfig{
		DisplayName: "Time",
		Unit:        "time:YYYY-MM-DD HH:mm:ss",
	}

	// ✅ CORRECT - Create body field (changed from message)
	bodyField := data.NewField("body", nil, bodies)
	bodyField.Config = &data.FieldConfig{
		DisplayName: "Message", // Display name can still be "Message" for UI
	}

	// ✅ CORRECT - Create severity field (changed from level)
	severityField := data.NewField("severity", nil, severities)
	severityField.Config = &data.FieldConfig{
		DisplayName: "Level", // Display name can still be "Level" for UI
	}

	// ✅ CORRECT - Create ID field
	idField := data.NewField("id", nil, ids)
	idField.Config = &data.FieldConfig{
		DisplayName: "ID",
	}

	// ✅ CORRECT - Create labels field with JSON structure
	labelsField := data.NewField("labels", nil, labels)
	labelsField.Config = &data.FieldConfig{
		DisplayName: "Labels",
	}

	// ✅ CORRECT - Add fields in the correct order for Grafana logs recognition
	frame.Fields = append(frame.Fields,
		timestampField,
		bodyField,     // ✅ CORRECT - body instead of message
		severityField, // ✅ CORRECT - severity instead of level
		idField,       // ✅ CORRECT - id field
		labelsField,   // ✅ CORRECT - labels as JSON
	)

	// Extract search terms from the query for highlighting
	searchWords := p.extractSearchTerms(query)

	// ✅ CORRECT - Set appropriate metadata for Grafana's logs panel recognition
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeLogLines, // Critical: This tells Grafana this is log data
		// ✅ CORRECT - PreferredVisualization directly, not in Custom
		PreferredVisualization: "logs",
		Custom: map[string]interface{}{
			// Enhanced metadata for search highlighting and filtering
			"searchWords": searchWords,  // For search term highlighting
			"limit":       entryCount,   // For pagination info
		},
		// Add execution information for debugging
		ExecutedQueryString: fmt.Sprintf("Logs query returned %d entries", entryCount),
	}

	logger.Debug("Created corrected logs data frame structure",
		"refID", refID,
		"entryCount", entryCount,
		"frameType", frame.Meta.Type,
		"preferredVisualization", frame.Meta.PreferredVisualization,
		"fieldCount", len(frame.Fields),
		"searchWords", searchWords)

	// Return only the logs frame - volume histogram is returned separately
	// via supplementary queries (logs-volume query type)
	return data.Frames{frame}
}

// createEmptyLogsDataFrame creates an empty logs data frame with corrected structure
func (p *LogsResponseParser) createEmptyLogsDataFrame(refID string) data.Frames {
	logger := log.New()

	// Create data frame with corrected structure for logs
	frame := data.NewFrame("logs")
	frame.RefID = refID

	// ✅ CORRECT - Create empty fields with corrected names and types
	timestampField := data.NewField("timestamp", nil, []time.Time{})
	timestampField.Config = &data.FieldConfig{
		DisplayName: "Time",
	}

	bodyField := data.NewField("body", nil, []string{}) // ✅ CORRECT - Changed from message
	bodyField.Config = &data.FieldConfig{
		DisplayName: "Message", // Display name can still be "Message" for UI
	}

	severityField := data.NewField("severity", nil, []string{}) // ✅ CORRECT - Changed from level
	severityField.Config = &data.FieldConfig{
		DisplayName: "Level", // Display name can still be "Level" for UI
	}

	idField := data.NewField("id", nil, []string{}) // ✅ CORRECT - Added ID field
	idField.Config = &data.FieldConfig{
		DisplayName: "ID",
	}

	labelsField := data.NewField("labels", nil, []json.RawMessage{}) // ✅ CORRECT - Labels as JSON
	labelsField.Config = &data.FieldConfig{
		DisplayName: "Labels",
	}

	// ✅ CORRECT - Add fields in the correct order
	frame.Fields = append(frame.Fields,
		timestampField,
		bodyField,     // ✅ CORRECT - body instead of message
		severityField, // ✅ CORRECT - severity instead of level
		idField,       // ✅ CORRECT - id field
		labelsField,   // ✅ CORRECT - labels as JSON
	)

	// ✅ CORRECT - Set appropriate metadata for empty logs data frame
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeLogLines,
		// ✅ CORRECT - PreferredVisualization directly, not in Custom
		PreferredVisualization: "logs",
		ExecutedQueryString:    "No log entries found",
	}

	logger.Debug("Created empty corrected logs data frame", "refID", refID)
	
	return data.Frames{frame}
}

// addPaginationMetadata adds pagination information to data frames
func (p *LogsResponseParser) addPaginationMetadata(frames data.Frames, nextCursor string) {
	if len(frames) == 0 {
		return
	}

	frame := frames[0]
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	if frame.Meta.Custom == nil {
		frame.Meta.Custom = make(map[string]interface{})
	}

	// Add pagination info to frame metadata
	if customMap, ok := frame.Meta.Custom.(map[string]interface{}); ok {
		if pagination, exists := customMap["pagination"]; exists {
			if paginationMap, ok := pagination.(map[string]interface{}); ok {
				paginationMap["nextCursor"] = nextCursor
				paginationMap["hasNextPage"] = nextCursor != ""
			}
		} else {
			customMap["pagination"] = map[string]interface{}{
				"nextCursor":  nextCursor,
				"hasNextPage": nextCursor != "",
			}
		}
	}
}

// validateLogEntry validates a log entry and returns any validation errors
func (p *LogsResponseParser) validateLogEntry(entry LogEntry, index int) []string {
	var errors []string

	// Check for required fields
	if entry.Timestamp.IsZero() {
		errors = append(errors, fmt.Sprintf("Entry %d: missing or invalid timestamp", index))
	}

	// Body can be empty, but we should log it for debugging
	if entry.Body == "" {
		// This is not an error, just a debug note
	}

	// Validate severity if present
	if entry.Severity != "" {
		validLevels := map[string]bool{
			"DEBUG": true, "INFO": true, "WARN": true,
			"ERROR": true, "FATAL": true, "TRACE": true,
		}
		if !validLevels[strings.ToUpper(entry.Severity)] {
			errors = append(errors, fmt.Sprintf("Entry %d: invalid log severity '%s'", index, entry.Severity))
		}
	}

	// Validate labels JSON if present
	if len(entry.Labels) > 0 {
		var labels LogLabels
		if err := json.Unmarshal(entry.Labels, &labels); err != nil {
			errors = append(errors, fmt.Sprintf("Entry %d: invalid labels JSON: %v", index, err))
		}
	}

	return errors
}

// sanitizeLogEntry cleans and normalizes a log entry
func (p *LogsResponseParser) sanitizeLogEntry(entry LogEntry) LogEntry {
	// Normalize severity to uppercase
	if entry.Severity != "" {
		entry.Severity = strings.ToUpper(entry.Severity)
	}

	// Trim whitespace from body field
	entry.Body = strings.TrimSpace(entry.Body)

	// Ensure timestamp is not zero - use current time as fallback
	// Always convert to UTC for Grafana compatibility
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	} else {
		entry.Timestamp = entry.Timestamp.UTC()
	}

	// Sanitize labels JSON if present
	if len(entry.Labels) > 0 {
		var labels LogLabels
		if err := json.Unmarshal(entry.Labels, &labels); err == nil {
			// Clean up string fields in labels
			labels.Service = strings.TrimSpace(labels.Service)
			labels.Source = strings.TrimSpace(labels.Source)
			labels.Host = strings.TrimSpace(labels.Host)
			labels.Env = strings.TrimSpace(labels.Env)
			labels.Version = strings.TrimSpace(labels.Version)

			// Re-marshal cleaned labels
			if cleanedLabels, err := json.Marshal(labels); err == nil {
				entry.Labels = cleanedLabels
			}
		}
	}

	return entry
}
// extractSearchTerms extracts search terms from a Datadog logs query for highlighting purposes.
// This function identifies text search terms while excluding facet filters.
func (p *LogsResponseParser) extractSearchTerms(query string) []string {
	if query == "" {
		return []string{}
	}

	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return []string{}
	}

	searchTerms := []string{}

	// Remove facet filters (service:, source:, status:, host:, env:, etc.)
	// Facet pattern: word followed by colon and value (with optional quotes)
	facetPattern := regexp.MustCompile(`\b\w+:\s*(?:"[^"]*"|[^\s]+)`)
	queryWithoutFacets := facetPattern.ReplaceAllString(trimmedQuery, "")

	// Remove boolean operators (AND, OR, NOT) as they're not search terms
	booleanPattern := regexp.MustCompile(`(?i)\b(AND|OR|NOT)\b`)
	queryWithoutFacets = booleanPattern.ReplaceAllString(queryWithoutFacets, " ")

	// Remove parentheses used for grouping
	queryWithoutFacets = strings.ReplaceAll(queryWithoutFacets, "(", " ")
	queryWithoutFacets = strings.ReplaceAll(queryWithoutFacets, ")", " ")

	// Extract quoted strings first (preserve spaces within quotes)
	quotedPattern := regexp.MustCompile(`"([^"]*)"`)
	quotedMatches := quotedPattern.FindAllStringSubmatch(queryWithoutFacets, -1)
	for _, match := range quotedMatches {
		if len(match) > 1 && strings.TrimSpace(match[1]) != "" {
			searchTerms = append(searchTerms, strings.TrimSpace(match[1]))
		}
	}

	// Remove quoted strings from the query to process remaining words
	queryWithoutQuotes := quotedPattern.ReplaceAllString(queryWithoutFacets, " ")

	// Split remaining words by whitespace and filter out empty strings
	words := strings.Fields(queryWithoutQuotes)

	// Process individual words
	for _, word := range words {
		// Clean up the word by removing quotes and special characters at boundaries
		cleanWord := strings.Trim(word, `"'`)

		// Skip if the word is empty after cleaning
		if cleanWord == "" {
			continue
		}

		// Handle wildcard patterns - extract the base term without wildcards
		if strings.Contains(cleanWord, "*") {
			// For patterns like "error*" or "*error*", extract "error"
			baseWord := strings.ReplaceAll(cleanWord, "*", "")
			if baseWord != "" {
				searchTerms = append(searchTerms, baseWord)
			}
		} else {
			// Regular search term
			searchTerms = append(searchTerms, cleanWord)
		}
	}

	// Remove duplicates
	seen := make(map[string]bool)
	uniqueTerms := []string{}
	for _, term := range searchTerms {
		if !seen[term] {
			seen[term] = true
			uniqueTerms = append(uniqueTerms, term)
		}
	}

	return uniqueTerms
}


// createLogsVolumeFrame creates a histogram data frame from log entries
// This calculates volume data points by counting logs in time buckets
// The frame structure follows Grafana's logs volume conventions used by Loki/OpenSearch
// Requirements: 18.2, 18.3
func (p *LogsResponseParser) createLogsVolumeFrame(logEntries []LogEntry, refID string, timeRange backend.TimeRange) *data.Frame {
	logger := log.New()

	// Handle empty log entries
	if len(logEntries) == 0 {
		logger.Debug("No log entries for volume calculation", "refID", refID)
		return p.createEmptyVolumeFrame(refID)
	}

	// Use the query time range for bucket calculation
	minTime := timeRange.From.UTC()
	maxTime := timeRange.To.UTC()

	// Calculate appropriate bucket size based on time range
	duration := maxTime.Sub(minTime)
	bucketDuration := p.calculateBucketDuration(duration)

	// Create time buckets and count logs in each
	buckets := make(map[time.Time]int)
	
	// Align bucket start to bucket boundaries
	bucketStart := minTime.Truncate(bucketDuration)
	
	// Initialize all buckets in the range with 0
	for t := bucketStart; !t.After(maxTime); t = t.Add(bucketDuration) {
		buckets[t] = 0
	}

	// Count logs in each bucket - use UTC timestamps for consistency
	for _, entry := range logEntries {
		entryTime := entry.Timestamp.UTC()
		bucketTime := entryTime.Truncate(bucketDuration)
		if !bucketTime.Before(bucketStart) && !bucketTime.After(maxTime) {
			buckets[bucketTime]++
		}
	}

	// Convert map to sorted slices using proper sorting
	sortedTimes := make([]time.Time, 0, len(buckets))
	for t := range buckets {
		sortedTimes = append(sortedTimes, t)
	}
	
	// Sort by time (bubble sort for simplicity, small dataset)
	for i := 0; i < len(sortedTimes)-1; i++ {
		for j := i + 1; j < len(sortedTimes); j++ {
			if sortedTimes[j].Before(sortedTimes[i]) {
				sortedTimes[i], sortedTimes[j] = sortedTimes[j], sortedTimes[i]
			}
		}
	}

	// Build time and count slices
	timeValues := make([]*time.Time, len(sortedTimes))
	countValues := make([]*float64, len(sortedTimes))
	for i, t := range sortedTimes {
		ts := t
		count := float64(buckets[t])
		timeValues[i] = &ts
		countValues[i] = &count
	}

	// Create frame with standard time series field names
	// Using pointer types and standard field names like OpenSearch does
	frame := data.NewFrame("",
		data.NewField(data.TimeSeriesTimeFieldName, nil, timeValues),
		data.NewField(data.TimeSeriesValueFieldName, data.Labels{"level": "logs"}, countValues),
	)
	
	// Set frame metadata - just TimeSeriesMulti type, no PreferredVisualization
	// This matches how OpenSearch creates histogram frames
	frame.RefID = fmt.Sprintf("log-volume-%s", refID)
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesMulti,
	}

	logger.Debug("Created logs volume frame",
		"refID", frame.RefID,
		"bucketCount", len(timeValues),
		"totalLogs", len(logEntries),
		"bucketDuration", bucketDuration.String())

	return frame
}

// createEmptyVolumeFrame creates an empty volume frame
func (p *LogsResponseParser) createEmptyVolumeFrame(refID string) *data.Frame {
	frame := data.NewFrame("",
		data.NewField(data.TimeSeriesTimeFieldName, nil, []*time.Time{}),
		data.NewField(data.TimeSeriesValueFieldName, data.Labels{"level": "logs"}, []*float64{}),
	)
	
	frame.RefID = fmt.Sprintf("log-volume-%s", refID)
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesMulti,
	}

	return frame
}

// calculateBucketDuration determines appropriate bucket size based on time range
func (p *LogsResponseParser) calculateBucketDuration(duration time.Duration) time.Duration {
	switch {
	case duration <= 5*time.Minute:
		return 10 * time.Second
	case duration <= 15*time.Minute:
		return 30 * time.Second
	case duration <= time.Hour:
		return time.Minute
	case duration <= 6*time.Hour:
		return 5 * time.Minute
	case duration <= 24*time.Hour:
		return 15 * time.Minute
	case duration <= 7*24*time.Hour:
		return time.Hour
	default:
		return 4 * time.Hour
	}
}
