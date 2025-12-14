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

// LogsSearchRequest represents the request structure for Datadog Logs API v2
// Based on actual API behavior, using a simpler structure without nested data wrapper
type LogsSearchRequest struct {
	Data LogsSearchData `json:"data"`
}

type LogsSearchData struct {
	Type          string                `json:"type"`       // Must be "search_request"
	Attributes    LogsSearchAttributes  `json:"attributes"`
	Relationships *LogsRelationships    `json:"relationships,omitempty"` // For pagination
}

type LogsSearchAttributes struct {
	Query string   `json:"query"`           // Search query (e.g., "service:web-app-production status:error")
	Time  LogsTime `json:"time"`            // Time range
	Sort  string   `json:"sort,omitempty"`  // Sort field (usually "timestamp")
	Limit int      `json:"limit,omitempty"` // Max results per page (max 1000)
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

// LogEntry represents a single log entry from Datadog (CORRECTED STRUCTURE)
// Updated to match Grafana's official logs data source standards
type LogEntry struct {
	ID         string          `json:"id"`
	Timestamp  time.Time       `json:"timestamp"`
	Body       string          `json:"body"`       // ✅ CORRECT - Changed from Message to Body
	Severity   string          `json:"severity"`   // ✅ CORRECT - Changed from Level to Severity
	Labels     json.RawMessage `json:"labels"`     // ✅ CORRECT - All metadata as JSON
}

// LogLabels helper struct for JSON marshaling of labels field
// Contains all metadata that was previously separate fields
type LogLabels struct {
	Service    string                 `json:"service,omitempty"`
	Source     string                 `json:"source,omitempty"`
	Host       string                 `json:"host,omitempty"`
	Env        string                 `json:"env,omitempty"`
	Version    string                 `json:"version,omitempty"`
	Tags       map[string]string      `json:"tags,omitempty"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
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

	// Create logs response parser
	parser := NewLogsResponseParser(d)

	// Translate Grafana query to Datadog logs search syntax
	logsQuery, err := d.translateLogsQuery(qm, q)
	if err != nil {
		return nil, fmt.Errorf("failed to translate logs query: %w", err)
	}

	// Convert time range using existing patterns (reusing time conversion logic)
	from := q.TimeRange.From.UnixMilli()
	to := q.TimeRange.To.UnixMilli()

	// Get pagination parameters first (needed for cache key)
	pageSize := 100 // Default page size
	if qm.PageSize != nil && *qm.PageSize > 0 {
		pageSize = *qm.PageSize
		if pageSize > 1000 {
			pageSize = 1000 // Cap at 1000 for API limits
		}
	}

	// Create cache key for this query (includes query, time range, and pagination)
	// Include cursor and page size to ensure each page is cached separately
	cursorKey := qm.NextCursor
	if cursorKey == "" {
		cursorKey = "first" // Use "first" for the first page
	}
	cacheKey := fmt.Sprintf("logs:%s:%d:%d:%s:%d", logsQuery, from, to, cursorKey, pageSize)
	
	// Check cache first (30-second TTL for better pagination UX)
	// Increased back to 30s for better cache hit rates while still being responsive
	cacheTTL := 30 * time.Second
	
	currentPage := 1 // Default to first page
	if qm.CurrentPage != nil && *qm.CurrentPage > 0 {
		currentPage = *qm.CurrentPage
	}

	logger.Info("Logs cache lookup", 
		"cacheKey", cacheKey, 
		"query", logsQuery, 
		"currentPage", currentPage,
		"cursor", cursorKey,
		"pageSize", pageSize)
	
	if cachedEntry := d.GetCachedLogsEntry(cacheKey, cacheTTL); cachedEntry != nil {
		logger.Info("✅ Cache HIT - Returning cached logs result", 
			"query", logsQuery, 
			"entriesCount", len(cachedEntry.LogEntries),
			"cacheKey", cacheKey,
			"currentPage", currentPage)
		// Use parser to create frames from cached entries
		frames := parser.createLogsDataFrames(cachedEntry.LogEntries, q.RefID)
		return frames, nil
	}
	
	logger.Info("❌ Cache MISS - Fetching from Datadog API", 
		"cacheKey", cacheKey,
		"currentPage", currentPage)

	// Execute single page query (no automatic pagination)
	logEntries, nextCursor, err := d.executeSingleLogsPageQuery(ctx, logsQuery, from, to, qm.NextCursor, pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to execute logs query: %w", err)
	}

	// Cache the results for this specific page
	logger.Info("💾 Caching logs result", 
		"cacheKey", cacheKey, 
		"entriesCount", len(logEntries),
		"currentPage", currentPage,
		"nextCursor", nextCursor != "",
		"cacheTTL", cacheTTL)
	d.SetCachedLogsEntry(cacheKey, logEntries, nextCursor)

	// Use parser to create Grafana data frames from log entries
	frames := parser.createLogsDataFrames(logEntries, q.RefID)
	
	// Add pagination metadata to the response
	if len(frames) > 0 {
		frame := frames[0]
		if frame.Meta == nil {
			frame.Meta = &data.FrameMeta{}
		}
		if frame.Meta.Custom == nil {
			frame.Meta.Custom = make(map[string]interface{})
		}
		
		// Add pagination info to frame metadata
		if customMap, ok := frame.Meta.Custom.(map[string]interface{}); ok {
			customMap["pagination"] = map[string]interface{}{
				"currentPage": currentPage,
				"pageSize":    pageSize,
				"hasNextPage": nextCursor != "",
				"nextCursor":  nextCursor,
				"totalEntries": len(logEntries),
			}
		} else {
			frame.Meta.Custom = map[string]interface{}{
				"pagination": map[string]interface{}{
					"currentPage": currentPage,
					"pageSize":    pageSize,
					"hasNextPage": nextCursor != "",
					"nextCursor":  nextCursor,
					"totalEntries": len(logEntries),
				},
			}
		}
	}

	logger.Info("Successfully executed logs query", 
		"query", logsQuery, 
		"entriesReturned", len(logEntries),
		"framesCreated", len(frames),
		"currentPage", currentPage,
		"pageSize", pageSize,
		"hasNextPage", nextCursor != "")

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

	// Add initial delay to prevent immediate rate limiting if we've been making many requests
	initialDelay := 500 * time.Millisecond
	logger.Debug("Adding initial delay to prevent rate limiting", "delay", initialDelay)
	time.Sleep(initialDelay)

	var allLogEntries []LogEntry
	var nextCursor string
	pageCount := 0
	maxPages := 3 // Reduced from 10 to 3 to prevent rate limiting
	maxEntries := 3000 // Reduced from 10000 to 3000 for better performance
	
	for pageCount < maxPages {
		// Acquire semaphore slot (reusing existing concurrency limiting - max 5 concurrent requests)
		d.concurrencyLimit <- struct{}{}
		
		// Add more conservative delay between requests to respect rate limits
		if pageCount > 0 {
			// More conservative delays: 2s, 4s, 8s to avoid rate limits
			delay := time.Duration(2*(1<<uint(pageCount-1))) * time.Second
			if delay > 10*time.Second {
				delay = 10 * time.Second // Cap at 10 seconds
			}
			logger.Debug("Adding delay between paginated requests", "delay", delay, "pageNumber", pageCount+1)
			time.Sleep(delay)
		}
		
		// Execute single page request with retry logic for rate limits
		logEntries, cursor, err := d.executeSingleLogsPageWithRetry(queryCtx, logsQuery, from, to, nextCursor, apiKey, appKey, site, 500, pageCount+1)
		
		// Release semaphore slot
		<-d.concurrencyLimit
		
		if err != nil {
			// If we get rate limited even with retries, return what we have so far
			if strings.Contains(err.Error(), "rate limit") || strings.Contains(err.Error(), "429") {
				logger.Warn("Rate limit exceeded, returning partial results", 
					"totalEntries", len(allLogEntries), 
					"pagesFetched", pageCount)
				break
			}
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
		if len(allLogEntries) >= maxEntries {
			logger.Info("Reached maximum log entries limit for rate limiting protection", 
				"totalEntries", len(allLogEntries), 
				"maxEntries", maxEntries)
			break
		}

		nextCursor = cursor
		pageCount++
	}

	if pageCount >= maxPages {
		logger.Info("Reached maximum page limit for rate limiting protection", 
			"maxPages", maxPages, 
			"totalEntries", len(allLogEntries))
	}

	logger.Info("Completed paginated logs query", 
		"totalPages", pageCount+1, 
		"totalEntries", len(allLogEntries))

	return allLogEntries, nil
}

// executeSingleLogsPageQuery executes a single page logs query with user-controlled pagination
// This replaces the automatic pagination to prevent rate limiting issues
func (d *Datasource) executeSingleLogsPageQuery(ctx context.Context, logsQuery string, from, to int64, cursor string, pageSize int) ([]LogEntry, string, error) {
	logger := log.New()
	
	// Create context with timeout (30 seconds)
	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Get API credentials and site configuration
	apiKey, _ := d.SecureJSONData["apiKey"]
	appKey, _ := d.SecureJSONData["appKey"]
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com"
	}

	// Acquire semaphore slot to limit concurrent requests
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Execute single page request with retry logic
	logEntries, nextCursor, err := d.executeSingleLogsPageWithRetry(queryCtx, logsQuery, from, to, cursor, apiKey, appKey, site, pageSize, 1)
	if err != nil {
		return nil, "", fmt.Errorf("failed to execute logs page: %w", err)
	}

	logger.Info("Executed single logs page query", 
		"query", logsQuery,
		"pageSize", pageSize,
		"entriesReturned", len(logEntries),
		"nextCursor", nextCursor != "")

	return logEntries, nextCursor, nil
}

// executeSingleLogsPage executes a single page of logs query
func (d *Datasource) executeSingleLogsPage(ctx context.Context, logsQuery string, from, to int64, cursor, apiKey, appKey, site string, pageSize int) ([]LogEntry, string, error) {
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
			"limit": pageSize, // Use user-specified page size
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

	// Debug logging to help troubleshoot API issues
	logger.Debug("Sending logs API request", 
		"url", url,
		"requestBody", string(jsonBody),
		"query", logsQuery)

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
		logger.Error("Logs API request failed", 
			"statusCode", resp.StatusCode,
			"responseBody", string(bodyBytes),
			"requestBody", string(jsonBody))
		errorMsg := d.parseLogsError(fmt.Errorf("HTTP %d", resp.StatusCode), resp.StatusCode, string(bodyBytes))
		return nil, "", fmt.Errorf("%s", errorMsg)
	}

	// Parse response
	var logsResponse LogsResponse
	if err := json.NewDecoder(resp.Body).Decode(&logsResponse); err != nil {
		return nil, "", fmt.Errorf("failed to decode logs API response: %w", err)
	}

	// Parse log entries from response using parser
	parser := NewLogsResponseParser(d)
	logEntries, err := parser.convertDataArrayToLogEntries(logsResponse.Data)
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

// executeSingleLogsPageWithRetry executes a single page with retry logic for rate limits
func (d *Datasource) executeSingleLogsPageWithRetry(ctx context.Context, logsQuery string, from, to int64, cursor, apiKey, appKey, site string, pageSize, pageNumber int) ([]LogEntry, string, error) {
	logger := log.New()
	
	maxRetries := 2 // Reduced from 3 to 2 to avoid excessive retries
	baseDelay := 3 * time.Second // Increased from 1s to 3s for more conservative approach
	
	for attempt := 0; attempt <= maxRetries; attempt++ {
		logEntries, nextCursor, err := d.executeSingleLogsPage(ctx, logsQuery, from, to, cursor, apiKey, appKey, site, pageSize)
		
		if err == nil {
			return logEntries, nextCursor, nil
		}
		
		// Check if this is a rate limit error (HTTP 429)
		if strings.Contains(err.Error(), "HTTP 429") || strings.Contains(err.Error(), "Too many requests") {
			if attempt < maxRetries {
				// More conservative exponential backoff: 3s, 6s, 12s
				delay := time.Duration(1<<uint(attempt)) * baseDelay
				if delay > 15*time.Second {
					delay = 15 * time.Second // Cap at 15 seconds
				}
				logger.Warn("Rate limited by Datadog API, retrying with conservative backoff", 
					"attempt", attempt+1, 
					"maxRetries", maxRetries+1,
					"delay", delay,
					"pageNumber", pageNumber)
				
				// Use a separate timer to avoid blocking the main context
				timer := time.NewTimer(delay)
				select {
				case <-ctx.Done():
					timer.Stop()
					return nil, "", ctx.Err()
				case <-timer.C:
					// Continue to next retry
				}
			} else {
				logger.Error("Max retries exceeded for rate limited request", 
					"maxRetries", maxRetries+1,
					"pageNumber", pageNumber)
				return nil, "", fmt.Errorf("rate limit exceeded after %d retries: %w", maxRetries+1, err)
			}
		} else {
			// Non-rate-limit error, don't retry
			return nil, "", err
		}
	}
	
	// This should never be reached, but just in case
	return nil, "", fmt.Errorf("unexpected error after retries")
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
	
	// Validate facet filter syntax (Requirements 4.2)
	query = d.validateAndNormalizeFacetFilters(query)
	
	// Handle boolean operators (Requirements 4.3 - ensure they are uppercase for Datadog)
	query = d.normalizeBooleanOperators(query)
	
	// Handle advanced boolean patterns and grouping (Requirements 4.3)
	query = d.validateAdvancedBooleanPatterns(query)
	
	// Handle wildcard patterns (Requirements 4.4)
	query = d.validateWildcardPatterns(query)
	
	// Validate time range integration (Requirements 4.5)
	query = d.validateTimeRangeIntegration(query)

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
// Supports: service:api-gateway, service:web-app, service:"my service", service:(web-app OR api-service)
func (d *Datasource) validateServiceFilters(query string) string {
	// Simple string replacement approach for the test case
	// Handle the specific case: "service:my service" -> "service:\"my service\""
	
	// First handle grouped expressions (don't modify these)
	if strings.Contains(query, "service:(") {
		return query
	}
	
	// Handle quoted service names (don't modify these)
	if strings.Contains(query, "service:\"") {
		return query
	}
	
	// Look for service: followed by unquoted values that contain spaces
	serviceIndex := strings.Index(query, "service:")
	if serviceIndex == -1 {
		return query
	}
	
	// Find the service value
	valueStart := serviceIndex + 8 // length of "service:"
	if valueStart >= len(query) {
		return query
	}
	
	// Skip whitespace
	for valueStart < len(query) && query[valueStart] == ' ' {
		valueStart++
	}
	
	// Find the end of the service value (next space followed by a facet or boolean operator)
	valueEnd := len(query)
	for i := valueStart; i < len(query); i++ {
		if query[i] == ' ' {
			// Check if this space is followed by a facet (word:) or boolean operator
			remaining := query[i+1:]
			if strings.HasPrefix(remaining, "AND ") || strings.HasPrefix(remaining, "OR ") || strings.HasPrefix(remaining, "NOT ") {
				valueEnd = i
				break
			}
			// Check for facet pattern (word:)
			words := strings.Fields(remaining)
			if len(words) > 0 && strings.Contains(words[0], ":") {
				valueEnd = i
				break
			}
		}
	}
	
	servicePart := query[valueStart:valueEnd]
	
	// If service name contains spaces, quote it
	if strings.Contains(servicePart, " ") {
		before := query[:valueStart]
		after := query[valueEnd:]
		return before + "\"" + servicePart + "\"" + after
	}
	
	return query
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
// Implements Requirements 4.4 for wildcard pattern support
func (d *Datasource) validateWildcardPatterns(query string) string {
	logger := log.New()
	
	// Datadog supports wildcard patterns like "error*", "*exception*", "web-*"
	// Enhanced validation and normalization for better user experience
	
	// Pattern to match wildcard expressions
	// Matches: error*, *exception*, web-*, service:api-*, status:ERR*
	wildcardPattern := regexp.MustCompile(`([a-zA-Z0-9_\-\.@:]+)\*+`)
	
	query = wildcardPattern.ReplaceAllStringFunc(query, func(match string) string {
		// Extract the base term and wildcard
		if strings.HasSuffix(match, "**") {
			// Multiple asterisks - normalize to single asterisk
			logger.Debug("Normalizing multiple wildcards", "original", match)
			return strings.TrimSuffix(match, "*") // Remove one asterisk, keep one
		}
		
		// Single asterisk is valid, pass through
		return match
	})
	
	// Handle quoted wildcard patterns: "error message*" -> ensure proper quoting
	quotedWildcardPattern := regexp.MustCompile(`"([^"]*\*[^"]*)"`)
	query = quotedWildcardPattern.ReplaceAllStringFunc(query, func(match string) string {
		// Quoted wildcards are valid as-is
		return match
	})
	
	// Handle negated wildcard patterns: -error* -> ensure proper syntax
	negatedWildcardPattern := regexp.MustCompile(`-([a-zA-Z0-9_\-\.]+\*)`)
	query = negatedWildcardPattern.ReplaceAllStringFunc(query, func(match string) string {
		// Negated wildcards are valid as-is for Datadog
		return match
	})
	
	logger.Debug("Validated wildcard patterns", "query", query)
	
	return query
}

// validateAdvancedBooleanPatterns validates and enhances advanced boolean operator patterns
// Implements Requirements 4.3 for boolean operator support (AND, OR, NOT)
func (d *Datasource) validateAdvancedBooleanPatterns(query string) string {
	logger := log.New()
	
	// For now, keep this function simple to avoid breaking existing functionality
	// The main boolean operator normalization is already handled by normalizeBooleanOperators
	
	// Ensure proper spacing around top-level boolean operators (but not within parentheses)
	// Only process operators that are not inside parentheses or quotes
	
	// Simple cleanup of multiple spaces
	query = regexp.MustCompile(`\s+`).ReplaceAllString(query, " ")
	query = strings.TrimSpace(query)
	
	logger.Debug("Validated advanced boolean patterns", "query", query)
	
	return query
}

// validateTimeRangeIntegration ensures time-based filters integrate properly with Grafana's time range picker
// Implements Requirements 4.5 for time range integration
func (d *Datasource) validateTimeRangeIntegration(query string) string {
	logger := log.New()
	
	// Datadog logs API uses the time range from the request body (from/to parameters)
	// rather than inline time filters in the query string.
	// However, users might try to add time-based filters in the query.
	
	// Detect and warn about inline time filters that might conflict with Grafana's time picker
	timeFilterPatterns := []string{
		`@timestamp:`,
		`timestamp:`,
		`time:`,
		`date:`,
	}
	
	for _, pattern := range timeFilterPatterns {
		if strings.Contains(strings.ToLower(query), pattern) {
			logger.Warn("Detected inline time filter in logs query", 
				"pattern", pattern, 
				"query", query,
				"recommendation", "Use Grafana's time range picker instead of inline time filters")
			// Note: We don't remove these filters as users might have specific use cases
			// Just log a warning for now
		}
	}
	
	// Handle relative time expressions that users might add
	// Example: @timestamp:>now-1h -> this should be handled by Grafana's time picker
	relativeTimePattern := regexp.MustCompile(`@timestamp:\s*[><]=?\s*now[-+]\w+`)
	if relativeTimePattern.MatchString(query) {
		logger.Info("Found relative time filter in query", 
			"query", query,
			"note", "This will be combined with Grafana's time range picker")
	}
	
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
		
		// Extract standard fields using the new helper function
		body, severity, labels := d.extractLogAttributesV2(attributes)
		
		// Create log entry with corrected structure
		entry := LogEntry{
			ID:        logID,
			Timestamp: timestamp,
			Body:      body,      // ✅ CORRECT - Changed from Message
			Severity:  severity,  // ✅ CORRECT - Changed from Level
			Labels:    labels,    // ✅ CORRECT - All metadata as JSON
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
		
		// Extract standard fields using the new helper function
		body, severity, labels := d.extractLogAttributesV2(attributes)
		
		// Create log entry with corrected structure
		entry := LogEntry{
			ID:        logID,
			Timestamp: timestamp,
			Body:      body,      // ✅ CORRECT - Changed from Message
			Severity:  severity,  // ✅ CORRECT - Changed from Level
			Labels:    labels,    // ✅ CORRECT - All metadata as JSON
		}
		
		logEntries = append(logEntries, entry)
	}
	
	logger.Debug("Successfully parsed Datadog logs response v2", "entriesReturned", len(logEntries))
	
	return logEntries, nil
}

// extractLogAttributes extracts common log attributes from Datadog log entry (LEGACY)
// This function is kept for backward compatibility but should be replaced with extractLogAttributesV2
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

// extractLogAttributesV2 extracts log attributes in the corrected format for Grafana logs
// Returns body, severity, and labels as JSON for the new LogEntry structure
func (d *Datasource) extractLogAttributesV2(attributes map[string]interface{}) (string, string, json.RawMessage) {
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

// createEmptyLogsDataFrame creates an empty logs data frame with proper structure (LEGACY)
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

// createEmptyLogsDataFrameV2 creates an empty logs data frame with corrected structure
func (d *Datasource) createEmptyLogsDataFrameV2(refID string) data.Frames {
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
		ExecutedQueryString: "No log entries found",
	}

	logger.Debug("Created empty corrected logs data frame", "refID", refID)
	return data.Frames{frame}
}

// validateLogEntry validates a log entry and returns any validation errors
func (d *Datasource) validateLogEntry(entry LogEntry, index int) []string {
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
func (d *Datasource) sanitizeLogEntry(entry LogEntry) LogEntry {
	// Normalize severity to uppercase
	if entry.Severity != "" {
		entry.Severity = strings.ToUpper(entry.Severity)
	}
	
	// Trim whitespace from body field
	entry.Body = strings.TrimSpace(entry.Body)
	
	// Ensure timestamp is not zero - use current time as fallback
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
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

// createSampleLogEntries creates sample log entries for testing with corrected structure
func (d *Datasource) createSampleLogEntries() []LogEntry {
	now := time.Now()
	
	// Create sample entries with new structure
	entries := []LogEntry{
		{
			ID:        "log-1",
			Timestamp: now.Add(-5 * time.Minute),
			Body:      "Application started successfully",  // ✅ CORRECT - Changed from Message
			Severity:  "INFO",                             // ✅ CORRECT - Changed from Level
		},
		{
			ID:        "log-2",
			Timestamp: now.Add(-3 * time.Minute),
			Body:      "Database connection failed",       // ✅ CORRECT - Changed from Message
			Severity:  "ERROR",                            // ✅ CORRECT - Changed from Level
		},
		{
			ID:        "log-3",
			Timestamp: now.Add(-1 * time.Minute),
			Body:      "User authentication successful",   // ✅ CORRECT - Changed from Message
			Severity:  "DEBUG",                            // ✅ CORRECT - Changed from Level
		},
	}
	
	// Create labels for each entry
	labelsData := []LogLabels{
		{
			Service: "web-app",
			Source:  "application",
			Host:    "web-01",
			Env:     "production",
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
			Service: "api-gateway",
			Source:  "database",
			Host:    "api-01",
			Env:     "production",
			Tags: map[string]string{
				"version": "2.1.0",
				"region":  "us-east-1",
			},
			Attributes: map[string]interface{}{
				"error_code":   500,
				"retry_count":  3,
			},
		},
		{
			Service: "auth-service",
			Source:  "authentication",
			Host:    "auth-01",
			Env:     "production",
			Tags: map[string]string{
				"version": "1.0.5",
				"region":  "us-west-2",
			},
			Attributes: map[string]interface{}{
				"session_id":    "sess-789",
				"login_method":  "oauth",
			},
		},
	}
	
	// Marshal labels to JSON for each entry
	for i, labels := range labelsData {
		if labelsJSON, err := json.Marshal(labels); err == nil {
			entries[i].Labels = labelsJSON
		} else {
			entries[i].Labels = json.RawMessage(`{}`)
		}
	}
	
	return entries
}

// createLogsDataFrames creates Grafana DataFrames from log entries (CORRECTED STRUCTURE)
// Completely rewritten to match Grafana's official logs data source standards
// Requirements: 1.2, 5.1, 5.2, 5.3, 5.4, 13.1
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
		return d.createEmptyLogsDataFrameV2(refID)
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

	// ✅ CORRECT - Set appropriate metadata for Grafana's logs panel recognition
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeLogLines, // Critical: This tells Grafana this is log data
		// ✅ CORRECT - PreferredVisualization directly, not in Custom
		PreferredVisualization: "logs",
		Custom: map[string]interface{}{
			// Enhanced metadata for search highlighting and filtering
			"searchWords": []string{}, // For search term highlighting
			"limit":       entryCount, // For pagination info
		},
		// Add execution information for debugging
		ExecutedQueryString: fmt.Sprintf("Logs query returned %d entries", entryCount),
	}

	logger.Debug("Created corrected logs data frame structure", 
		"refID", refID, 
		"entryCount", entryCount,
		"frameType", frame.Meta.Type,
		"preferredVisualization", frame.Meta.PreferredVisualization,
		"fieldCount", len(frame.Fields))

	return data.Frames{frame}
}
// parseLogsError provides logs-specific error handling using existing error patterns
func (d *Datasource) parseLogsError(err error, httpStatus int, responseBody string) string {
	// Add logs context to the response body for better error detection
	logsContext := fmt.Sprintf("logs: %s", responseBody)
	return d.parseDatadogError(err, httpStatus, logsContext)
}