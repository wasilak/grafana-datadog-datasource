package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LogsSearchRequest represents the simplified request structure for Datadog Logs API v2
// Based on actual API behavior, using a simpler structure without nested data wrapper

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

// LogsCacheEntry stores cached logs data with timestamp for TTL validation
type LogsCacheEntry struct {
	LogEntries []LogEntry
	Timestamp  time.Time
	NextCursor string // For pagination
}

// LogsPaginationState tracks pagination state for logs queries
type LogsPaginationState struct {
	Query      string
	TimeRange  string
	Cursor     string
	HasMore    bool
	TotalFetched int
}

// LogsResponse represents the response from Datadog Logs API v2
type LogsResponse struct {
	Data []map[string]interface{} `json:"data"`
	Meta LogsResponseMeta         `json:"meta,omitempty"`
}

// LogsResponseMeta contains pagination information from Datadog Logs API
type LogsResponseMeta struct {
	Page LogsPageMeta `json:"page,omitempty"`
}

// LogsPageMeta contains pagination cursor information
type LogsPageMeta struct {
	After string `json:"after,omitempty"` // Cursor for next page
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
			// Use existing error handling patterns for consistent error messages
			errorMsg := err.Error()
			if strings.Contains(errorMsg, "HTTP") || strings.Contains(errorMsg, "API") {
				// Error already processed by parseDatadogError, use as-is
				response.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, errorMsg)
			} else {
				// Generic error, format consistently
				response.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("Logs query error: %s", errorMsg))
			}
			continue
		}

		response.Responses[q.RefID] = backend.DataResponse{
			Frames: frames,
		}
	}

	return response, nil
}

// executeSingleLogsQuery executes a single logs query with pagination and caching support
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

	// Create cache key for this query (includes query, time range)
	cacheKey := fmt.Sprintf("logs:%s:%d:%d", logsQuery, from, to)
	
	// Check cache first (30-second TTL as per requirements)
	cacheTTL := 30 * time.Second
	if cachedEntry := d.GetCachedLogsEntry(cacheKey, cacheTTL); cachedEntry != nil {
		logger.Debug("Returning cached logs result", "query", logsQuery, "entriesCount", len(cachedEntry.LogEntries))
		frames := d.createLogsDataFrames(cachedEntry.LogEntries, q.RefID)
		return frames, nil
	}

	// Execute query with pagination support
	allLogEntries, err := d.executeLogsQueryWithPagination(ctx, logsQuery, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to execute logs query with pagination: %w", err)
	}

	// Cache the results
	d.SetCachedLogsEntry(cacheKey, allLogEntries, "")

	// Create Grafana data frames from log entries
	frames := d.createLogsDataFrames(allLogEntries, q.RefID)

	logger.Info("Successfully executed logs query with pagination", 
		"query", logsQuery, 
		"entriesReturned", len(allLogEntries),
		"framesCreated", len(frames))

	return frames, nil
}

// executeLogsQueryWithPagination executes a logs query with automatic pagination
// Implements Requirements 10.1, 10.4 for pagination and caching consistency
func (d *Datasource) executeLogsQueryWithPagination(ctx context.Context, logsQuery string, from, to int64) ([]LogEntry, error) {
	logger := log.New()
	
	// Create context with timeout (reusing existing timeout patterns - 30 seconds)
	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Get API credentials and site configuration
	apiKey, _ := d.SecureJSONData["apiKey"]
	appKey, _ := d.SecureJSONData["appKey"]
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com"
	}

	var allLogEntries []LogEntry
	var nextCursor string
	pageCount := 0
	maxPages := 10 // Limit to prevent infinite loops
	
	for pageCount < maxPages {
		// Acquire semaphore slot (reusing existing concurrency limiting - max 5 concurrent requests)
		d.concurrencyLimit <- struct{}{}
		
		// Execute single page request
		logEntries, cursor, err := d.executeSingleLogsPage(queryCtx, logsQuery, from, to, nextCursor, apiKey, appKey, site)
		
		// Release semaphore slot
		<-d.concurrencyLimit
		
		if err != nil {
			return nil, fmt.Errorf("failed to execute logs page %d: %w", pageCount+1, err)
		}

		// Add entries to result
		allLogEntries = append(allLogEntries, logEntries...)
		
		logger.Debug("Fetched logs page", 
			"pageNumber", pageCount+1, 
			"entriesInPage", len(logEntries),
			"totalEntries", len(allLogEntries),
			"nextCursor", cursor)

		// Check if we have more pages
		if cursor == "" || len(logEntries) == 0 {
			break // No more pages
		}
		
		// Check if we've reached a reasonable limit (prevent excessive pagination)
		if len(allLogEntries) >= 10000 {
			logger.Warn("Reached maximum log entries limit", "totalEntries", len(allLogEntries))
			break
		}

		nextCursor = cursor
		pageCount++
	}

	if pageCount >= maxPages {
		logger.Warn("Reached maximum page limit", "maxPages", maxPages, "totalEntries", len(allLogEntries))
	}

	logger.Info("Completed paginated logs query", 
		"totalPages", pageCount+1, 
		"totalEntries", len(allLogEntries))

	return allLogEntries, nil
}

// executeSingleLogsPage executes a single page of logs query
func (d *Datasource) executeSingleLogsPage(ctx context.Context, logsQuery string, from, to int64, cursor, apiKey, appKey, site string) ([]LogEntry, string, error) {
	logger := log.New()

	// Use POST method with JSON body for proper Datadog Logs API v2 integration
	url := fmt.Sprintf("https://api.%s/api/v2/logs/events/search", site)
	
	// Create request body matching Datadog's actual API format
	// Based on the API error, it seems Datadog expects a simpler structure
	// Convert timestamps to ISO format as Datadog might expect that instead of milliseconds
	fromTime := time.UnixMilli(from).UTC().Format(time.RFC3339)
	toTime := time.UnixMilli(to).UTC().Format(time.RFC3339)
	
	requestBody := map[string]interface{}{
		"filter": map[string]interface{}{
			"query": logsQuery,
			"from":  fromTime,
			"to":    toTime,
		},
		"sort": "timestamp",
		"page": map[string]interface{}{
			"limit": 1000,
		},
	}

	// Add pagination cursor if provided
	if cursor != "" {
		requestBody["page"].(map[string]interface{})["cursor"] = cursor
	}

	// Marshal request body
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal logs request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, "", fmt.Errorf("failed to create logs API request: %w", err)
	}

	// Add authentication headers
	req.Header.Set("DD-API-KEY", apiKey)
	req.Header.Set("DD-APPLICATION-KEY", appKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Execute the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// Use existing error handling patterns for timeout and network errors
		errorMsg := d.parseLogsError(err, 0, "")
		return nil, "", fmt.Errorf("%s", errorMsg)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		errorMsg := d.parseLogsError(fmt.Errorf("HTTP %d", resp.StatusCode), resp.StatusCode, string(bodyBytes))
		return nil, "", fmt.Errorf("%s", errorMsg)
	}

	// Parse response
	var logsResponse LogsResponse
	if err := json.NewDecoder(resp.Body).Decode(&logsResponse); err != nil {
		return nil, "", fmt.Errorf("failed to decode logs API response: %w", err)
	}

	// Parse log entries from response
	logEntries, err := d.parseDatadogLogsResponseV2(logsResponse.Data)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse logs response: %w", err)
	}

	// Extract next cursor for pagination
	nextCursor := ""
	if logsResponse.Meta.Page.After != "" {
		nextCursor = logsResponse.Meta.Page.After
	}

	logger.Debug("Executed single logs page", 
		"entriesReturned", len(logEntries),
		"nextCursor", nextCursor)

	return logEntries, nextCursor, nil
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
	// - Reserved attribute filters: service:web-app, status:ERROR, source:nginx, host:web-01
	// - Custom attribute filters: @env:production, @version:1.2.3
	// - Boolean operators: AND, OR, NOT
	// - Grouping: status:(ERROR OR WARN)
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
// Implements Requirements 7.1, 7.2, 7.3, 8.1, 8.2 for log level and service filtering
func (d *Datasource) validateAndNormalizeFacetFilters(query string) string {
	logger := log.New()
	
	// Enhanced facet filter processing for log level and service filtering
	// Support for Datadog reserved attributes and standard syntax:
	// - status:ERROR, status:WARN, status:INFO, status:DEBUG, status:FATAL (correct Datadog syntax)
	// - status:(ERROR OR WARN) - multiple levels with OR logic
	// - service:api-gateway, service:web-app, service:auth-service (reserved attribute)
	// - source:nginx, source:application, source:database (reserved attribute)
	// - host:web-01 (reserved attribute)
	// - @env:production, @version:1.2.3 (custom attributes with @ prefix)
	
	// Normalize log level values to uppercase for consistency
	query = d.normalizeLogLevels(query)
	
	// Validate service filter syntax
	query = d.validateServiceFilters(query)
	
	// Validate source filter syntax  
	query = d.validateSourceFilters(query)
	
	// Validate other common facet filters
	query = d.validateCommonFacets(query)
	
	logger.Debug("Normalized facet filters", "query", query)
	
	return query
}

// normalizeLogLevels normalizes log level facet filters to uppercase
// Supports: status:ERROR, status:(ERROR OR WARN), status:info -> status:INFO
// Also supports legacy level: syntax and converts it to status:
func (d *Datasource) normalizeLogLevels(query string) string {
	// Valid log levels that should be normalized to uppercase
	validLevels := []string{"debug", "info", "warn", "warning", "error", "fatal", "trace"}
	
	// Pattern to match both status: and level: filters with optional grouping
	// Matches: status:error, level:error, status:(error OR warn), etc.
	levelPattern := regexp.MustCompile(`(?i)(status|level):\s*(\([^)]+\)|[^\s\)]+)`)
	
	return levelPattern.ReplaceAllStringFunc(query, func(match string) string {
		// Extract the attribute name and level value(s)
		parts := strings.SplitN(match, ":", 2)
		if len(parts) != 2 {
			return match // Return unchanged if malformed
		}
		
		attributeName := strings.ToLower(strings.TrimSpace(parts[0]))
		levelPart := strings.TrimSpace(parts[1])
		
		// Always use 'status' as the correct Datadog attribute name
		// Convert legacy 'level' to 'status'
		correctAttribute := "status"
		
		// Handle grouped levels: status:(ERROR OR WARN)
		if strings.HasPrefix(levelPart, "(") && strings.HasSuffix(levelPart, ")") {
			// Extract content inside parentheses
			innerContent := levelPart[1 : len(levelPart)-1]
			
			// Normalize each level within the group
			for _, level := range validLevels {
				// Use word boundaries to avoid partial matches
				levelRegex := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(level) + `\b`)
				innerContent = levelRegex.ReplaceAllString(innerContent, strings.ToUpper(level))
			}
			
			return correctAttribute + ":(" + innerContent + ")"
		}
		
		// Handle single level: status:error -> status:ERROR or level:error -> status:ERROR
		for _, level := range validLevels {
			if strings.EqualFold(levelPart, level) {
				return correctAttribute + ":" + strings.ToUpper(level)
			}
		}
		
		// Return with correct attribute name even if level not recognized
		if attributeName == "level" {
			return correctAttribute + ":" + levelPart
		}
		
		return match
	})
}

// validateServiceFilters validates service filter syntax and provides helpful error context
// Supports: service:api-gateway, service:web-app, service:"my service"
func (d *Datasource) validateServiceFilters(query string) string {
	// Pattern to match service: filters
	servicePattern := regexp.MustCompile(`service:\s*("[^"]*"|[^\s\)]+)`)
	
	return servicePattern.ReplaceAllStringFunc(query, func(match string) string {
		// Extract the service value part after "service:"
		parts := strings.SplitN(match, ":", 2)
		if len(parts) != 2 {
			return match
		}
		
		servicePart := strings.TrimSpace(parts[1])
		
		// Validate service name format
		if servicePart == "" {
			// Empty service filter - could be invalid, but let Datadog handle it
			return match
		}
		
		// Handle quoted service names: service:"my service"
		if strings.HasPrefix(servicePart, "\"") && strings.HasSuffix(servicePart, "\"") {
			// Quoted service names are valid as-is
			return match
		}
		
		// Validate unquoted service names (should not contain spaces or special chars)
		if strings.ContainsAny(servicePart, " \t\n\r()[]{}") {
			// Service name contains spaces/special chars but isn't quoted
			// Auto-quote it for better UX
			return "service:\"" + servicePart + "\""
		}
		
		// Valid unquoted service name
		return match
	})
}

// validateSourceFilters validates source filter syntax
// Supports: source:nginx, source:application, source:"log file"
func (d *Datasource) validateSourceFilters(query string) string {
	// Pattern to match source: filters
	sourcePattern := regexp.MustCompile(`source:\s*("[^"]*"|[^\s\)]+)`)
	
	return sourcePattern.ReplaceAllStringFunc(query, func(match string) string {
		// Extract the source value part after "source:"
		parts := strings.SplitN(match, ":", 2)
		if len(parts) != 2 {
			return match
		}
		
		sourcePart := strings.TrimSpace(parts[1])
		
		// Handle quoted source names: source:"log file"
		if strings.HasPrefix(sourcePart, "\"") && strings.HasSuffix(sourcePart, "\"") {
			return match
		}
		
		// Auto-quote source names with spaces or special characters
		if strings.ContainsAny(sourcePart, " \t\n\r()[]{}") {
			return "source:\"" + sourcePart + "\""
		}
		
		return match
	})
}

// validateCommonFacets validates other common facet filters (host, env, version, etc.)
func (d *Datasource) validateCommonFacets(query string) string {
	// Reserved attributes (no @ prefix needed): host
	reservedFacets := []string{"host"}
	
	// Custom attributes (require @ prefix): env, version, container_name, etc.
	customFacets := []string{"env", "version", "container_name", "container_id", "image_name"}
	
	// Handle reserved attributes (no @ prefix)
	for _, facet := range reservedFacets {
		facetPattern := regexp.MustCompile(facet + `:\s*("[^"]*"|[^\s\)]+)`)
		query = facetPattern.ReplaceAllStringFunc(query, func(match string) string {
			parts := strings.SplitN(match, ":", 2)
			if len(parts) != 2 {
				return match
			}
			
			facetPart := strings.TrimSpace(parts[1])
			
			// Handle quoted values
			if strings.HasPrefix(facetPart, "\"") && strings.HasSuffix(facetPart, "\"") {
				return match
			}
			
			// Auto-quote values with spaces or special characters
			if strings.ContainsAny(facetPart, " \t\n\r()[]{}") {
				return facet + ":\"" + facetPart + "\""
			}
			
			return match
		})
	}
	
	// Handle custom attributes (with @ prefix)
	for _, facet := range customFacets {
		// Match both @facet: and facet: patterns, convert to @facet:
		facetPattern := regexp.MustCompile(`(@?` + facet + `):\s*("[^"]*"|[^\s\)]+)`)
		query = facetPattern.ReplaceAllStringFunc(query, func(match string) string {
			parts := strings.SplitN(match, ":", 2)
			if len(parts) != 2 {
				return match
			}
			
			attributePart := strings.TrimSpace(parts[0])
			facetPart := strings.TrimSpace(parts[1])
			
			// Ensure @ prefix for custom attributes
			if !strings.HasPrefix(attributePart, "@") {
				attributePart = "@" + attributePart
			}
			
			// Handle quoted values
			if strings.HasPrefix(facetPart, "\"") && strings.HasSuffix(facetPart, "\"") {
				return attributePart + ":" + facetPart
			}
			
			// Auto-quote values with spaces or special characters
			if strings.ContainsAny(facetPart, " \t\n\r()[]{}") {
				return attributePart + ":\"" + facetPart + "\""
			}
			
			return attributePart + ":" + facetPart
		})
	}
	
	return query
}

// normalizeBooleanOperators ensures boolean operators are in the correct format for Datadog
func (d *Datasource) normalizeBooleanOperators(query string) string {
	// Datadog expects uppercase boolean operators
	// Use case-insensitive replacement for all variations
	
	// Replace AND variations (case-insensitive) - word boundaries to avoid partial matches
	re := regexp.MustCompile(`(?i)\band\b`)
	query = re.ReplaceAllString(query, "AND")
	
	// Replace OR variations (case-insensitive) - word boundaries to avoid partial matches
	re = regexp.MustCompile(`(?i)\bor\b`)
	query = re.ReplaceAllString(query, "OR")
	
	// Replace NOT variations (case-insensitive) - word boundaries to avoid partial matches
	re = regexp.MustCompile(`(?i)\bnot\b`)
	query = re.ReplaceAllString(query, "NOT")
	
	return query
}

// validateWildcardPatterns validates wildcard pattern syntax
func (d *Datasource) validateWildcardPatterns(query string) string {
	// Datadog supports wildcard patterns like "error*" or "*exception*"
	// For now, pass through as-is since Datadog handles validation
	// Future enhancements could add client-side validation
	
	return query
}




// parseDatadogLogsResponse parses Datadog Logs API v2 response and converts to LogEntry structs
func (d *Datasource) parseDatadogLogsResponse(apiResponse interface{}) ([]LogEntry, error) {
	logger := log.New()
	
	// Cast to map for parsing
	responseMap, ok := apiResponse.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format: expected map, got %T", apiResponse)
	}
	
	// Extract data array
	dataInterface, exists := responseMap["data"]
	if !exists {
		logger.Debug("No data field in response, returning empty results")
		return []LogEntry{}, nil
	}
	
	dataArray, ok := dataInterface.([]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid data format: expected array, got %T", dataInterface)
	}
	
	logger.Debug("Parsing Datadog logs response", "entryCount", len(dataArray))
	
	var logEntries []LogEntry
	
	for i, item := range dataArray {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			logger.Warn("Skipping invalid log entry", "index", i, "type", fmt.Sprintf("%T", item))
			continue
		}
		
		// Extract log ID
		logID := ""
		if id, exists := itemMap["id"]; exists {
			if idStr, ok := id.(string); ok {
				logID = idStr
			}
		}
		
		// Extract attributes
		attributesInterface, exists := itemMap["attributes"]
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
		var timestamp time.Time
		if timestampInterface, exists := attributes["timestamp"]; exists {
			if timestampStr, ok := timestampInterface.(string); ok {
				if parsedTime, err := time.Parse(time.RFC3339, timestampStr); err == nil {
					timestamp = parsedTime
				} else {
					logger.Warn("Failed to parse timestamp", "timestamp", timestampStr, "error", err)
					timestamp = time.Now() // Fallback to current time
				}
			}
		}
		
		// Extract standard fields using the helper function
		message, level, service, source, host, tags, remainingAttrs := d.extractLogAttributes(attributes)
		
		// Create log entry
		entry := LogEntry{
			ID:         logID,
			Timestamp:  timestamp,
			Message:    message,
			Level:      level,
			Service:    service,
			Source:     source,
			Host:       host,
			Tags:       tags,
			Attributes: remainingAttrs,
		}
		
		logEntries = append(logEntries, entry)
	}
	
	logger.Debug("Successfully parsed Datadog logs response", "entriesReturned", len(logEntries))
	
	return logEntries, nil
}

// parseDatadogLogsResponseV2 parses structured Datadog Logs API v2 response and converts to LogEntry structs
func (d *Datasource) parseDatadogLogsResponseV2(dataArray []map[string]interface{}) ([]LogEntry, error) {
	logger := log.New()
	
	logger.Debug("Parsing Datadog logs response v2", "entryCount", len(dataArray))
	
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
		var timestamp time.Time
		if timestampInterface, exists := attributes["timestamp"]; exists {
			if timestampStr, ok := timestampInterface.(string); ok {
				if parsedTime, err := time.Parse(time.RFC3339, timestampStr); err == nil {
					timestamp = parsedTime
				} else {
					logger.Warn("Failed to parse timestamp", "timestamp", timestampStr, "error", err)
					timestamp = time.Now() // Fallback to current time
				}
			}
		}
		
		// Extract standard fields using the helper function
		message, level, service, source, host, tags, remainingAttrs := d.extractLogAttributes(attributes)
		
		// Create log entry
		entry := LogEntry{
			ID:         logID,
			Timestamp:  timestamp,
			Message:    message,
			Level:      level,
			Service:    service,
			Source:     source,
			Host:       host,
			Tags:       tags,
			Attributes: remainingAttrs,
		}
		
		logEntries = append(logEntries, entry)
	}
	
	logger.Debug("Successfully parsed Datadog logs response v2", "entriesReturned", len(logEntries))
	
	return logEntries, nil
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

// createEmptyLogsDataFrame creates an empty logs data frame with proper structure
func (d *Datasource) createEmptyLogsDataFrame(refID string) data.Frames {
	logger := log.New()
	
	// Create data frame with proper structure for logs
	frame := data.NewFrame("logs")
	frame.RefID = refID

	// Create empty fields with proper types
	timestampField := data.NewField("timestamp", nil, []time.Time{})
	timestampField.Config = &data.FieldConfig{
		DisplayName: "Time",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	messageField := data.NewField("message", nil, []string{})
	messageField.Config = &data.FieldConfig{
		DisplayName: "Message",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	levelField := data.NewField("level", nil, []string{})
	levelField.Config = &data.FieldConfig{
		DisplayName: "Level",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	serviceField := data.NewField("service", nil, []string{})
	serviceField.Config = &data.FieldConfig{
		DisplayName: "Service",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	sourceField := data.NewField("source", nil, []string{})
	sourceField.Config = &data.FieldConfig{
		DisplayName: "Source",
		Custom: map[string]interface{}{
			"displayMode": "list",
		},
	}

	// Add fields to frame
	frame.Fields = append(frame.Fields,
		timestampField,
		messageField,
		levelField,
		serviceField,
		sourceField,
	)

	// Set appropriate metadata for empty logs data frame
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeLogLines,
		Custom: map[string]interface{}{
			"preferredVisualisationType": "logs",
		},
		ExecutedQueryString: "No log entries found",
	}

	logger.Debug("Created empty logs data frame", "refID", refID)
	return data.Frames{frame}
}

// validateLogEntry validates a log entry and returns any validation errors
func (d *Datasource) validateLogEntry(entry LogEntry, index int) []string {
	var errors []string
	
	// Check for required fields
	if entry.Timestamp.IsZero() {
		errors = append(errors, fmt.Sprintf("Entry %d: missing or invalid timestamp", index))
	}
	
	// Message can be empty, but we should log it for debugging
	if entry.Message == "" {
		// This is not an error, just a debug note
	}
	
	// Validate log level if present
	if entry.Level != "" {
		validLevels := map[string]bool{
			"DEBUG": true, "INFO": true, "WARN": true, 
			"ERROR": true, "FATAL": true, "TRACE": true,
		}
		if !validLevels[strings.ToUpper(entry.Level)] {
			errors = append(errors, fmt.Sprintf("Entry %d: invalid log level '%s'", index, entry.Level))
		}
	}
	
	return errors
}

// sanitizeLogEntry cleans and normalizes a log entry
func (d *Datasource) sanitizeLogEntry(entry LogEntry) LogEntry {
	// Normalize log level to uppercase
	if entry.Level != "" {
		entry.Level = strings.ToUpper(entry.Level)
	}
	
	// Trim whitespace from string fields
	entry.Message = strings.TrimSpace(entry.Message)
	entry.Service = strings.TrimSpace(entry.Service)
	entry.Source = strings.TrimSpace(entry.Source)
	entry.Host = strings.TrimSpace(entry.Host)
	entry.Env = strings.TrimSpace(entry.Env)
	
	// Ensure timestamp is not zero - use current time as fallback
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}
	
	return entry
}

// sanitizeFieldName sanitizes field names for use in Grafana data frames
func (d *Datasource) sanitizeFieldName(name string) string {
	// Remove leading/trailing whitespace
	name = strings.TrimSpace(name)
	
	// Return empty if name is empty or too long
	if name == "" || len(name) > 100 {
		return ""
	}
	
	// Replace invalid characters with underscores
	// Keep alphanumeric, underscore, hyphen, and dot
	var result strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || 
		   (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' {
			result.WriteRune(r)
		} else {
			result.WriteRune('_')
		}
	}
	
	sanitized := result.String()
	
	// Ensure it doesn't start with a number
	if len(sanitized) > 0 && sanitized[0] >= '0' && sanitized[0] <= '9' {
		sanitized = "field_" + sanitized
	}
	
	return sanitized
}

// sanitizeFieldValue sanitizes field values for display in Grafana
func (d *Datasource) sanitizeFieldValue(value interface{}) string {
	if value == nil {
		return ""
	}
	
	var strValue string
	switch v := value.(type) {
	case string:
		strValue = v
	case bool:
		strValue = fmt.Sprintf("%t", v)
	case int, int8, int16, int32, int64:
		strValue = fmt.Sprintf("%d", v)
	case uint, uint8, uint16, uint32, uint64:
		strValue = fmt.Sprintf("%d", v)
	case float32, float64:
		strValue = fmt.Sprintf("%.6g", v)
	default:
		strValue = fmt.Sprintf("%v", v)
	}
	
	// Trim whitespace and limit length
	strValue = strings.TrimSpace(strValue)
	if len(strValue) > 1000 {
		strValue = strValue[:997] + "..."
	}
	
	return strValue
}

// createSampleLogEntries creates sample log entries for testing
func (d *Datasource) createSampleLogEntries() []LogEntry {
	now := time.Now()
	return []LogEntry{
		{
			ID:        "log-1",
			Timestamp: now.Add(-5 * time.Minute),
			Message:   "Application started successfully",
			Level:     "INFO",
			Service:   "web-app",
			Source:    "application",
			Host:      "web-01",
			Env:       "production",
			Tags: map[string]string{
				"version": "1.2.3",
				"region":  "us-east-1",
			},
			Attributes: map[string]interface{}{
				"request_id": "req-123",
				"user_id":    "user-456",
			},
		},
		{
			ID:        "log-2",
			Timestamp: now.Add(-3 * time.Minute),
			Message:   "Database connection failed",
			Level:     "ERROR",
			Service:   "api-gateway",
			Source:    "database",
			Host:      "api-01",
			Env:       "production",
			Tags: map[string]string{
				"version": "2.1.0",
				"region":  "us-east-1",
			},
			Attributes: map[string]interface{}{
				"error_code": 500,
				"retry_count": 3,
			},
		},
		{
			ID:        "log-3",
			Timestamp: now.Add(-1 * time.Minute),
			Message:   "User authentication successful",
			Level:     "DEBUG",
			Service:   "auth-service",
			Source:    "authentication",
			Host:      "auth-01",
			Env:       "production",
			Tags: map[string]string{
				"version": "1.0.5",
				"region":  "us-west-2",
			},
			Attributes: map[string]interface{}{
				"session_id": "sess-789",
				"login_method": "oauth",
			},
		},
	}
}

// createLogsDataFrames creates Grafana DataFrames from log entries
// This sets appropriate metadata for Grafana's logs panel recognition
// Requirements: 1.2, 5.1, 5.2, 5.3, 5.4
func (d *Datasource) createLogsDataFrames(logEntries []LogEntry, refID string) data.Frames {
	logger := log.New()

	// Validate input parameters
	if refID == "" {
		logger.Warn("Empty refID provided for logs data frame")
		refID = "logs" // Default refID
	}

	// Handle empty log entries case
	if len(logEntries) == 0 {
		logger.Debug("No log entries provided, creating empty logs data frame", "refID", refID)
		return d.createEmptyLogsDataFrame(refID)
	}

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

	// Validate and sanitize log entries
	var validationErrors []string
	sanitizedEntries := make([]LogEntry, entryCount)
	
	for i, entry := range logEntries {
		// Validate entry
		if errors := d.validateLogEntry(entry, i); len(errors) > 0 {
			validationErrors = append(validationErrors, errors...)
		}
		
		// Sanitize entry
		sanitizedEntries[i] = d.sanitizeLogEntry(entry)
	}
	
	// Log validation errors but continue processing
	if len(validationErrors) > 0 {
		logger.Warn("Log entry validation errors found", 
			"errorCount", len(validationErrors), 
			"errors", validationErrors)
	}

	// Populate data from sanitized log entries with proper handling of empty values
	for i, entry := range sanitizedEntries {
		timestamps[i] = entry.Timestamp
		
		// Handle message field - preserve multi-line formatting
		messages[i] = entry.Message // Can be empty after sanitization
		
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

		// Process additional attributes from the sanitized log entry
		if entry.Attributes != nil {
			for attrKey, value := range entry.Attributes {
				// Skip standard fields that we already handle
				if attrKey == "timestamp" || attrKey == "message" || attrKey == "level" || 
				   attrKey == "service" || attrKey == "source" || attrKey == "host" || attrKey == "env" {
					continue
				}

				// Sanitize attribute key (remove special characters, make lowercase)
				sanitizedKey := d.sanitizeFieldName(attrKey)
				if sanitizedKey == "" {
					continue // Skip invalid field names
				}

				// Initialize slice if this is the first time we see this attribute
				if _, exists := additionalFields[sanitizedKey]; !exists {
					additionalFields[sanitizedKey] = make([]interface{}, entryCount)
				}

				// Convert value to string for display with proper sanitization
				strValue := d.sanitizeFieldValue(value)
				additionalFields[sanitizedKey][i] = strValue
			}

			// Process tags as additional fields
			if entry.Tags != nil {
				for tagKey, value := range entry.Tags {
					// Sanitize tag key and add prefix
					sanitizedTagKey := d.sanitizeFieldName(tagKey)
					if sanitizedTagKey == "" {
						continue // Skip invalid tag names
					}
					
					tagFieldKey := "tag_" + sanitizedTagKey // Prefix to distinguish from attributes
					if _, exists := additionalFields[tagFieldKey]; !exists {
						additionalFields[tagFieldKey] = make([]interface{}, entryCount)
					}
					
					// Sanitize tag value
					sanitizedValue := d.sanitizeFieldValue(value)
					additionalFields[tagFieldKey][i] = sanitizedValue
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
// parseLogsError provides logs-specific error handling using existing error patterns
func (d *Datasource) parseLogsError(err error, httpStatus int, responseBody string) string {
	// Add logs context to the response body for better error detection
	logsContext := fmt.Sprintf("logs: %s", responseBody)
	return d.parseDatadogError(err, httpStatus, logsContext)
}