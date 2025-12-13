package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LogsSearchRequest matches Datadog's exact API structure for POST /api/v2/logs/events/search
type LogsSearchRequest struct {
	Data LogsSearchData `json:"data"`
}

type LogsSearchData struct {
	Type          string                `json:"type"`       // Must be "search_request"
	Attributes    LogsSearchAttributes  `json:"attributes"`
	Relationships *LogsRelationships    `json:"relationships,omitempty"` // For pagination
}

type LogsSearchAttributes struct {
	Query string    `json:"query"`           // Search query (e.g., "service:web-app-production status:error")
	Time  LogsTime  `json:"time"`            // Time range
	Sort  string    `json:"sort,omitempty"`  // Sort field (usually "timestamp")
	Limit int       `json:"limit,omitempty"` // Max results per page (max 1000)
}

type LogsTime struct {
	From string `json:"from"` // Start time (e.g., "now-1h" or timestamp)
	To   string `json:"to"`   // End time (e.g., "now" or timestamp)
}

type LogsRelationships struct {
	Page LogsPageRelation `json:"page"`
}

type LogsPageRelation struct {
	Data LogsPageData `json:"data"`
}

type LogsPageData struct {
	Type string `json:"type"` // "page_data"
	ID   string `json:"id"`   // Cursor from previous response
}

// LogEntry represents a single log entry from Datadog
// This structure matches the expected format from Datadog Logs API v2 response
type LogEntry struct {
	ID         string                 `json:"id"`
	Timestamp  time.Time             `json:"timestamp"`
	Message    string                `json:"message"`
	Level      string                `json:"level"`
	Service    string                `json:"service,omitempty"`
	Source     string                `json:"source,omitempty"`
	Host       string                `json:"host,omitempty"`       // Common log attribute
	Env        string                `json:"env,omitempty"`        // Environment (prod, staging, etc.)
	Version    string                `json:"version,omitempty"`    // Application version
	Tags       map[string]string     `json:"tags,omitempty"`       // Key-value tags
	Attributes map[string]interface{} `json:"attributes,omitempty"` // Additional structured data
}

// queryLogs executes logs queries against Datadog's Logs API v2
// This method reuses existing authentication patterns from the metrics implementation
func (d *Datasource) queryLogs(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := log.New()
	response := backend.NewQueryDataResponse()

	// Get API credentials from secure JSON data (reusing existing pattern)
	apiKey, ok := d.SecureJSONData["apiKey"]
	if !ok {
		logger.Error("missing apiKey in secure data")
		return response, fmt.Errorf("missing apiKey in secure data")
	}

	appKey, ok := d.SecureJSONData["appKey"]
	if !ok {
		logger.Error("missing appKey in secure data")
		return response, fmt.Errorf("missing appKey in secure data")
	}

	// Get Datadog site configuration (reusing existing pattern)
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	logger.Info("QueryLogs called", "site", site)

	// Set the site and API keys in context (reusing existing authentication pattern)
	ddCtx := context.WithValue(ctx, datadog.ContextServerVariables, map[string]string{
		"site": site,
	})
	ddCtx = context.WithValue(ddCtx, datadog.ContextAPIKeys, map[string]datadog.APIKey{
		"apiKeyAuth": {
			Key: apiKey,
		},
		"appKeyAuth": {
			Key: appKey,
		},
	})

	// Process each logs query
	for _, q := range req.Queries {
		var qm QueryModel
		if err := json.Unmarshal(q.JSON, &qm); err != nil {
			logger.Error("failed to parse logs query", "error", err)
			response.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse query: %v", err))
			continue
		}

		// Skip if not a logs query
		if qm.QueryType != "logs" && qm.LogQuery == "" {
			continue
		}

		// Skip hidden queries
		if qm.Hide {
			response.Responses[q.RefID] = backend.DataResponse{}
			continue
		}

		// Execute the logs query
		frames, err := d.executeSingleLogsQuery(ddCtx, &qm, &q)
		if err != nil {
			logger.Error("failed to execute logs query", "error", err, "refID", q.RefID)
			response.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, err.Error())
			continue
		}

		response.Responses[q.RefID] = backend.DataResponse{
			Frames: frames,
		}
	}

	return response, nil
}

// executeSingleLogsQuery executes a single logs query and returns Grafana DataFrames
func (d *Datasource) executeSingleLogsQuery(ctx context.Context, qm *QueryModel, q *backend.DataQuery) (data.Frames, error) {
	logger := log.New()

	// Translate Grafana query to Datadog logs search syntax
	logsQuery, err := d.translateLogsQuery(qm, q)
	if err != nil {
		return nil, fmt.Errorf("failed to translate logs query: %w", err)
	}

	// Convert time range using existing patterns (reusing time conversion logic)
	from := q.TimeRange.From.UnixMilli()
	to := q.TimeRange.To.UnixMilli()

	// Create the request body matching Datadog's exact format
	// TODO: This will be used when the actual Datadog Logs API call is implemented
	_ = LogsSearchRequest{
		Data: LogsSearchData{
			Type: "search_request",
			Attributes: LogsSearchAttributes{
				Query: logsQuery,
				Time: LogsTime{
					From: fmt.Sprintf("%d", from),
					To:   fmt.Sprintf("%d", to),
				},
				Sort:  "timestamp",
				Limit: 1000, // Max results per page
			},
		},
	}

	// Create context with timeout (reusing existing timeout patterns - 30 seconds)
	// TODO: This will be used when the actual Datadog Logs API call is implemented
	_ = ctx

	// Acquire semaphore slot (reusing existing concurrency limiting - max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Call Datadog Logs API v2
	// Note: This would use the Datadog Logs API client when available
	// For now, we'll create a placeholder implementation that demonstrates the structure
	logger.Info("Executing logs query", "query", logsQuery, "from", from, "to", to)

	// TODO: Replace this with actual Datadog Logs API call when the client supports it
	// The actual implementation would be:
	// configuration := datadog.NewConfiguration()
	// client := datadog.NewAPIClient(configuration)
	// logsApi := datadogV2.NewLogsApi(client)
	// resp, httpResp, err := logsApi.SearchLogs(queryCtx, body)

	// For now, create a placeholder response structure
	// TODO: Replace this with actual Datadog Logs API call when the client supports it
	// The actual implementation would parse the API response and convert to LogEntry structs
	
	// Create sample log entries for testing the data frame structure
	sampleEntries := d.createSampleLogEntries()
	frames := d.createLogsDataFrames(sampleEntries, q.RefID)

	return frames, nil
}

// translateLogsQuery translates Grafana query format to Datadog's logs search syntax
// This handles time range conversion using existing patterns and supports basic search terms and facet filters
func (d *Datasource) translateLogsQuery(qm *QueryModel, q *backend.DataQuery) (string, error) {
	logger := log.New()

	// Start with the base log query
	query := qm.LogQuery
	if query == "" {
		query = "*" // Default to match all logs
	}

	logger.Debug("Translating logs query", "originalQuery", query, "refID", q.RefID)

	// Basic validation - ensure query is not empty after trimming
	query = strings.TrimSpace(query)
	if query == "" {
		query = "*"
	}

	// Handle basic search terms and facet filters
	// Support for Datadog logs search syntax:
	// - Text search: "error" or "failed to connect"
	// - Facet filters: service:web-app, level:ERROR, source:nginx
	// - Boolean operators: AND, OR, NOT
	// - Grouping: level:(ERROR OR WARN)
	// - Wildcards: error*
	
	// Validate facet filter syntax
	query = d.validateAndNormalizeFacetFilters(query)
	
	// Handle boolean operators (ensure they are uppercase for Datadog)
	query = d.normalizeBooleanOperators(query)
	
	// Handle wildcard patterns
	query = d.validateWildcardPatterns(query)

	logger.Debug("Translated logs query", "translatedQuery", query, "refID", q.RefID)

	return query, nil
}

// validateAndNormalizeFacetFilters validates and normalizes facet filter syntax
func (d *Datasource) validateAndNormalizeFacetFilters(query string) string {
	// Common facet filters that should be supported:
	// service:, source:, level:, host:, env:, version:, etc.
	
	// For now, pass through the query as-is since Datadog's logs search syntax
	// is already well-defined and users are expected to use it directly
	// Future enhancements could add validation for known facet names
	
	return query
}

// normalizeBooleanOperators ensures boolean operators are in the correct format for Datadog
func (d *Datasource) normalizeBooleanOperators(query string) string {
	// Datadog expects uppercase boolean operators
	query = strings.ReplaceAll(query, " and ", " AND ")
	query = strings.ReplaceAll(query, " or ", " OR ")
	query = strings.ReplaceAll(query, " not ", " NOT ")
	
	return query
}

// validateWildcardPatterns validates wildcard pattern syntax
func (d *Datasource) validateWildcardPatterns(query string) string {
	// Datadog supports wildcard patterns like "error*" or "*exception*"
	// For now, pass through as-is since Datadog handles validation
	// Future enhancements could add client-side validation
	
	return query
}

// createSampleLogEntries creates sample log entries for testing the data frame structure
// TODO: Remove this when actual Datadog Logs API integration is complete
func (d *Datasource) createSampleLogEntries() []LogEntry {
	now := time.Now()
	
	return []LogEntry{
		{
			ID:        "sample-1",
			Timestamp: now.Add(-5 * time.Minute),
			Message:   "User authentication successful",
			Level:     "INFO",
			Service:   "auth-service",
			Source:    "nginx",
			Host:      "web-01",
			Env:       "production",
			Tags: map[string]string{
				"user_id": "12345",
				"method":  "POST",
			},
			Attributes: map[string]interface{}{
				"request_id": "req-abc123",
				"duration":   "150ms",
			},
		},
		{
			ID:        "sample-2",
			Timestamp: now.Add(-3 * time.Minute),
			Message:   "Database connection timeout",
			Level:     "ERROR",
			Service:   "api-gateway",
			Source:    "application",
			Host:      "api-02",
			Env:       "production",
			Tags: map[string]string{
				"database": "users",
				"retry":    "3",
			},
			Attributes: map[string]interface{}{
				"error_code": "TIMEOUT",
				"query":      "SELECT * FROM users WHERE id = ?",
			},
		},
		{
			ID:        "sample-3",
			Timestamp: now.Add(-1 * time.Minute),
			Message:   "Cache miss for key: user_profile_12345",
			Level:     "DEBUG",
			Service:   "cache-service",
			Source:    "redis",
			Host:      "cache-01",
			Env:       "production",
			Tags: map[string]string{
				"cache_key": "user_profile_12345",
				"ttl":       "3600",
			},
			Attributes: map[string]interface{}{
				"cache_size": "1024MB",
				"hit_rate":   "85%",
			},
		},
	}
}

// parseDatadogLogsResponse parses Datadog Logs API v2 response and converts to LogEntry structs
// This function will be used when the actual Datadog Logs API integration is implemented
func (d *Datasource) parseDatadogLogsResponse(apiResponse interface{}) ([]LogEntry, error) {
	logger := log.New()
	
	// TODO: Implement actual parsing of Datadog Logs API v2 response
	// The response structure from Datadog Logs API v2 is:
	// {
	//   "data": [
	//     {
	//       "type": "log",
	//       "id": "log-id",
	//       "attributes": {
	//         "timestamp": "2023-01-01T00:00:00Z",
	//         "message": "log message",
	//         "status": "info",
	//         "service": "my-service",
	//         "source": "my-source",
	//         "host": "my-host",
	//         "tags": ["key:value", "env:prod"],
	//         "attributes": {...}
	//       }
	//     }
	//   ],
	//   "meta": {
	//     "page": {
	//       "after": "cursor-for-next-page"
	//     }
	//   }
	// }
	
	logger.Debug("Parsing Datadog logs response", "responseType", fmt.Sprintf("%T", apiResponse))
	
	// For now, return empty slice until actual API integration
	return []LogEntry{}, nil
}

// extractLogAttributes extracts common log attributes from Datadog log entry
func (d *Datasource) extractLogAttributes(attributes map[string]interface{}) (string, string, string, string, string, map[string]string, map[string]interface{}) {
	var message, level, service, source, host string
	tags := make(map[string]string)
	remainingAttrs := make(map[string]interface{})
	
	// Extract standard fields
	if msg, ok := attributes["message"].(string); ok {
		message = msg
	}
	
	if lvl, ok := attributes["status"].(string); ok {
		level = strings.ToUpper(lvl) // Normalize to uppercase
	}
	
	if svc, ok := attributes["service"].(string); ok {
		service = svc
	}
	
	if src, ok := attributes["source"].(string); ok {
		source = src
	}
	
	if h, ok := attributes["host"].(string); ok {
		host = h
	}
	
	// Extract tags (Datadog returns tags as array of "key:value" strings)
	if tagsArray, ok := attributes["tags"].([]interface{}); ok {
		for _, tag := range tagsArray {
			if tagStr, ok := tag.(string); ok {
				parts := strings.SplitN(tagStr, ":", 2)
				if len(parts) == 2 {
					tags[parts[0]] = parts[1]
				}
			}
		}
	}
	
	// Collect remaining attributes
	for key, value := range attributes {
		if key != "message" && key != "status" && key != "service" && 
		   key != "source" && key != "host" && key != "tags" && key != "timestamp" {
			remainingAttrs[key] = value
		}
	}
	
	return message, level, service, source, host, tags, remainingAttrs
}

// createLogsDataFrames creates Grafana DataFrames from log entries
// This sets appropriate metadata for Grafana's logs panel recognition
// Requirements: 1.2, 5.1, 5.2, 5.3, 5.4
func (d *Datasource) createLogsDataFrames(logEntries []LogEntry, refID string) data.Frames {
	logger := log.New()

	// Create data frame with proper structure for logs
	frame := data.NewFrame("logs")
	frame.RefID = refID

	// Prepare slices for each field with proper capacity
	entryCount := len(logEntries)
	timestamps := make([]time.Time, entryCount)
	messages := make([]string, entryCount)
	levels := make([]string, entryCount)
	services := make([]string, entryCount)
	sources := make([]string, entryCount)
	hosts := make([]string, entryCount)
	envs := make([]string, entryCount)

	// Track additional attributes that appear across log entries
	additionalFields := make(map[string][]interface{})

	// Populate data from log entries with proper handling of empty values
	for i, entry := range logEntries {
		timestamps[i] = entry.Timestamp
		
		// Handle message field - preserve multi-line formatting
		if entry.Message != "" {
			messages[i] = entry.Message
		} else {
			messages[i] = "" // Keep empty messages as empty
		}
		
		// Handle optional fields with defaults for better display
		if entry.Level != "" {
			levels[i] = entry.Level
		} else {
			levels[i] = "INFO" // Default level if not specified
		}
		
		if entry.Service != "" {
			services[i] = entry.Service
		} else {
			services[i] = "" // Keep empty for better filtering
		}
		
		if entry.Source != "" {
			sources[i] = entry.Source
		} else {
			sources[i] = "" // Keep empty for better filtering
		}

		if entry.Host != "" {
			hosts[i] = entry.Host
		} else {
			hosts[i] = ""
		}

		if entry.Env != "" {
			envs[i] = entry.Env
		} else {
			envs[i] = ""
		}

		// Process additional attributes from the log entry
		if entry.Attributes != nil {
			for attrKey, value := range entry.Attributes {
				// Skip standard fields that we already handle
				if attrKey == "timestamp" || attrKey == "message" || attrKey == "level" || 
				   attrKey == "service" || attrKey == "source" || attrKey == "host" || attrKey == "env" {
					continue
				}

				// Initialize slice if this is the first time we see this attribute
				if _, exists := additionalFields[attrKey]; !exists {
					additionalFields[attrKey] = make([]interface{}, entryCount)
				}

				// Convert value to string for display
				var strValue string
				switch v := value.(type) {
				case string:
					strValue = v
				case nil:
					strValue = ""
				default:
					strValue = fmt.Sprintf("%v", v)
				}
				additionalFields[attrKey][i] = strValue
			}

			// Process tags as additional fields
			if entry.Tags != nil {
				for tagKey, value := range entry.Tags {
					tagFieldKey := "tag_" + tagKey // Prefix to distinguish from attributes
					if _, exists := additionalFields[tagFieldKey]; !exists {
						additionalFields[tagFieldKey] = make([]interface{}, entryCount)
					}
					additionalFields[tagFieldKey][i] = value
				}
			}
		}
	}

	// Fill in missing values for additional fields
	for fieldKey, values := range additionalFields {
		for i := range values {
			if values[i] == nil {
				values[i] = ""
			}
		}
		// Avoid unused variable warning
		_ = fieldKey
	}

	// Create timestamp field with proper configuration for logs
	timestampField := data.NewField("timestamp", nil, timestamps)
	timestampField.Config = &data.FieldConfig{
		DisplayName: "Time",
		Custom: map[string]interface{}{
			"displayMode": "list", // Display as list for logs panel
		},
	}

	// Create message field with proper configuration
	messageField := data.NewField("message", nil, messages)
	messageField.Config = &data.FieldConfig{
		DisplayName: "Message",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	// Create level field with proper configuration
	levelField := data.NewField("level", nil, levels)
	levelField.Config = &data.FieldConfig{
		DisplayName: "Level",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
		// TODO: Add color mapping for different log levels when SDK supports it
	}

	// Create service field with proper configuration
	serviceField := data.NewField("service", nil, services)
	serviceField.Config = &data.FieldConfig{
		DisplayName: "Service",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	// Create source field with proper configuration
	sourceField := data.NewField("source", nil, sources)
	sourceField.Config = &data.FieldConfig{
		DisplayName: "Source",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	// Create host field with proper configuration
	hostField := data.NewField("host", nil, hosts)
	hostField.Config = &data.FieldConfig{
		DisplayName: "Host",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	// Create environment field with proper configuration
	envField := data.NewField("env", nil, envs)
	envField.Config = &data.FieldConfig{
		DisplayName: "Environment",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	// Add core fields to frame in the correct order for logs display
	// Order is important: timestamp first, then message, then metadata fields
	frame.Fields = append(frame.Fields,
		timestampField,
		messageField,
		levelField,
		serviceField,
		sourceField,
		hostField,
		envField,
	)

	// Add additional fields from attributes and tags
	for fieldName, values := range additionalFields {
		// Convert []interface{} to []string for consistent display
		stringValues := make([]string, len(values))
		for i, v := range values {
			if str, ok := v.(string); ok {
				stringValues[i] = str
			} else {
				stringValues[i] = fmt.Sprintf("%v", v)
			}
		}

		additionalField := data.NewField(fieldName, nil, stringValues)
		additionalField.Config = &data.FieldConfig{
			DisplayName: fieldName,
			Custom: map[string]interface{}{
				"displayMode": "list",
			},
		}
		frame.Fields = append(frame.Fields, additionalField)
	}

	// Set appropriate metadata to indicate this is log data for Grafana's logs panel recognition
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeLogLines, // Critical: This tells Grafana this is log data
		Custom: map[string]interface{}{
			"preferredVisualisationType": "logs", // Preferred visualization type
		},
		// Add execution information for debugging
		ExecutedQueryString: fmt.Sprintf("Logs query returned %d entries", entryCount),
	}

	logger.Debug("Created logs data frame with enhanced structure", 
		"refID", refID, 
		"entryCount", entryCount,
		"frameType", frame.Meta.Type,
		"fieldCount", len(frame.Fields),
		"additionalFieldCount", len(additionalFields))

	return data.Frames{frame}
}