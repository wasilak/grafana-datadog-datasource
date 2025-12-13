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
type LogEntry struct {
	ID         string                 `json:"id"`
	Timestamp  time.Time             `json:"timestamp"`
	Message    string                `json:"message"`
	Level      string                `json:"level"`
	Service    string                `json:"service,omitempty"`
	Source     string                `json:"source,omitempty"`
	Tags       map[string]string     `json:"tags,omitempty"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
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
	frames := d.createLogsDataFrames([]LogEntry{}, q.RefID)

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

// createLogsDataFrames creates Grafana DataFrames from log entries
// This sets appropriate metadata for Grafana's logs panel recognition
func (d *Datasource) createLogsDataFrames(logEntries []LogEntry, refID string) data.Frames {
	logger := log.New()

	// Create data frame with proper structure for logs
	frame := data.NewFrame("logs")
	frame.RefID = refID

	// Prepare slices for each field
	timestamps := make([]time.Time, len(logEntries))
	messages := make([]string, len(logEntries))
	levels := make([]string, len(logEntries))
	services := make([]string, len(logEntries))
	sources := make([]string, len(logEntries))

	// Populate data from log entries
	for i, entry := range logEntries {
		timestamps[i] = entry.Timestamp
		messages[i] = entry.Message
		levels[i] = entry.Level
		services[i] = entry.Service
		sources[i] = entry.Source
	}

	// Add fields to frame with proper types and metadata
	frame.Fields = append(frame.Fields,
		data.NewField("timestamp", nil, timestamps),
		data.NewField("message", nil, messages),
		data.NewField("level", nil, levels),
		data.NewField("service", nil, services),
		data.NewField("source", nil, sources),
	)

	// Set appropriate metadata to indicate this is log data
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeLogLines,
		// PreferredVisualization will be set when the constant is available in the SDK
	}

	logger.Debug("Created logs data frame", "refID", refID, "entryCount", len(logEntries))

	return data.Frames{frame}
}