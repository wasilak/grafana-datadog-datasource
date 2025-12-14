package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	_ backend.QueryDataHandler    = (*Datasource)(nil)
	_ backend.CallResourceHandler = (*Datasource)(nil)
	_ backend.CheckHealthHandler  = (*Datasource)(nil)
	_ instancemgmt.Instance       = (*Datasource)(nil)
)

// Datasource represents the Datadog datasource plugin instance
type Datasource struct {
	InstanceSettings *backend.DataSourceInstanceSettings
	JSONData         *MyDataSourceOptions
	SecureJSONData   map[string]string
	cache            *AutocompleteCache
	logsCache        map[string]*LogsCacheEntry // Separate cache for logs data
	logsCacheMu      sync.Mutex                 // Mutex for logs cache
	concurrencyLimit chan struct{}              // Semaphore for max 5 concurrent requests
}

// MyDataSourceOptions defines the JSON options for the datasource
type MyDataSourceOptions struct {
	Site string `json:"site"`
}

// AutocompleteCache stores cached metric and tag data
type AutocompleteCache struct {
	mu      sync.Mutex
	entries map[string]*CacheEntry
}

// CacheEntry stores cached data with timestamp for TTL validation
type CacheEntry struct {
	Data      []string
	Timestamp time.Time
}

// QueryModel represents a query from the frontend
type QueryModel struct {
	QueryText         string `json:"queryText"`
	LegendMode        string `json:"legendMode"`
	LegendTemplate    string `json:"legendTemplate"`
	InterpolatedLabel string `json:"interpolatedLabel"`
	Hide              bool   `json:"hide"`
	// Expression query fields
	Type              string `json:"type,omitempty"`       // "math" for math expressions
	Expression        string `json:"expression,omitempty"` // Math expression like "$A*100/$B"
	// Query options
	Interval          *int64 `json:"interval,omitempty"`   // Override interval in milliseconds
	// Logs query fields
	QueryType         string `json:"queryType,omitempty"`  // "logs" or "metrics" (defaults to "metrics")
	LogQuery          string `json:"logQuery,omitempty"`   // Logs search query
	Indexes           []string `json:"indexes,omitempty"`  // Target log indexes
	// Pagination fields for logs
	PageSize          *int   `json:"pageSize,omitempty"`   // Number of log entries per page (default: 100)
	CurrentPage       *int   `json:"currentPage,omitempty"` // Current page number (1-based, default: 1)
	TotalPages        *int   `json:"totalPages,omitempty"` // Total number of pages available
	NextCursor        string `json:"nextCursor,omitempty"` // Cursor for next page (from Datadog API)
	// Deprecated: Use LegendMode and LegendTemplate instead
	Label             string `json:"label,omitempty"`
}

// NewDatasource creates a new Datasource factory function
func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.New()

	ds := &Datasource{
		InstanceSettings: &settings,
		cache: &AutocompleteCache{
			entries: make(map[string]*CacheEntry),
		},
		logsCache:        make(map[string]*LogsCacheEntry), // Initialize logs cache
		concurrencyLimit: make(chan struct{}, 5),           // Max 5 concurrent requests to Datadog
	}

	// Parse JSON options
	var opts MyDataSourceOptions
	if err := json.Unmarshal(settings.JSONData, &opts); err != nil {
		logger.Error("failed to parse JSONData", "error", err)
		return nil, fmt.Errorf("failed to parse JSONData: %w", err)
	}
	ds.JSONData = &opts

	// Get secure JSON data (API keys)
	ds.SecureJSONData = settings.DecryptedSecureJSONData

	logger.Error("CRITICAL DEBUG - Datasource initialized successfully", "site", opts.Site, "uid", settings.UID)

	return ds, nil
}

// Dispose disposes of the datasource instance
func (d *Datasource) Dispose() {
	// Cleanup if needed
}

// convertGrafanaFormulaToDatadog converts Grafana formula format ($A, $B) to Datadog format (A, B)
func convertGrafanaFormulaToDatadog(grafanaFormula string) string {
	// Use regex to replace $RefID with RefID
	// This handles cases like: $A, $B, $C1, $AB, etc.
	re := regexp.MustCompile(`\$([A-Za-z][A-Za-z0-9]*)`)
	datadogFormula := re.ReplaceAllString(grafanaFormula, "$1")
	return datadogFormula
}

// QueryData handles data source queries from Grafana
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := log.New()
	response := backend.NewQueryDataResponse()

	// Get API credentials from secure JSON data
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

	// Get Datadog site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	logger.Info("QueryData called", "site", site)
	logger.Info("Using API Key and App Key for authentication", "apiKey", apiKey, "appKey", appKey)

	// Set the site and API keys in context
	// Don't use NewDefaultContext - just set values directly on the context
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

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	// Datadog time range in milliseconds - Get from first query if available
	var from, to int64
	if len(req.Queries) > 0 {
		from = req.Queries[0].TimeRange.From.UnixMilli()
		to = req.Queries[0].TimeRange.To.UnixMilli()
	}

	// Parse all queries and separate logs queries from metrics queries
	var metricsQueries []datadogV2.TimeseriesQuery
	var formulas []datadogV2.QueryFormula
	var queryModels = make(map[string]QueryModel)
	var logsQueryModels = make(map[string]QueryModel)
	var hasFormulas bool
	var hasLogsQueries bool

	// First pass: parse all queries and separate logs from metrics
	for _, q := range req.Queries {
		var qm QueryModel
		if err := json.Unmarshal(q.JSON, &qm); err != nil {
			logger.Error("failed to parse query", "error", err)
			response.Responses[q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse query: %v", err))
			continue
		}

		// Skip hidden queries
		if qm.Hide {
			response.Responses[q.RefID] = backend.DataResponse{}
			continue
		}

		// Detect query type - check explicit queryType field or infer from context
		isLogsQuery := qm.QueryType == "logs" || (qm.QueryType == "" && qm.LogQuery != "")
		
		if isLogsQuery {
			// This is a logs query
			hasLogsQueries = true
			logsQueryModels[q.RefID] = qm
			logger.Debug("Detected logs query", "refID", q.RefID, "logQuery", qm.LogQuery)
		} else {
			// This is a metrics query
			queryModels[q.RefID] = qm
		}

		// Only process metrics queries in this loop
		if !isLogsQuery {
			if qm.Type == "math" && qm.Expression != "" {
				// This is a formula query - convert Grafana format ($A) to Datadog format (A)
				hasFormulas = true
				datadogFormula := convertGrafanaFormulaToDatadog(qm.Expression)
				formulas = append(formulas, datadogV2.QueryFormula{
					Formula: datadogFormula,
				})
			} else if qm.QueryText != "" {
				// This is a regular metrics query - add it to the queries list
				queryText := qm.QueryText
				lowerQuery := strings.ToLower(queryText)
				
				hasGroupByClause := strings.Contains(lowerQuery, " by ")
				hasBooleanOperators := strings.Contains(lowerQuery, " in ") || 
									  strings.Contains(lowerQuery, " or ") || 
									  strings.Contains(lowerQuery, " and ") ||
									  strings.Contains(lowerQuery, " not in ")
				
				if !hasGroupByClause && !hasBooleanOperators {
					queryText = queryText + " by {*}"
					logger.Debug("Added 'by {*}' to query", "original", qm.QueryText, "modified", queryText)
				}

				// Create query with name set to refID for formula referencing
				queryName := q.RefID
				metricsQueries = append(metricsQueries, datadogV2.TimeseriesQuery{
					MetricsTimeseriesQuery: &datadogV2.MetricsTimeseriesQuery{
						DataSource: datadogV2.METRICSDATASOURCE_METRICS,
						Query:      queryText,
						Name:       &queryName,
					},
				})
			} else {
				response.Responses[q.RefID] = backend.DataResponse{}
			}
		}
	}

	// Handle logs queries separately
	if hasLogsQueries {
		logger.Info("Processing logs queries", "logsQueryCount", len(logsQueryModels))
		
		// Create a new request containing only logs queries
		logsReq := &backend.QueryDataRequest{
			PluginContext: req.PluginContext,
			Headers:       req.Headers,
			Queries:       []backend.DataQuery{},
		}
		
		// Add logs queries to the new request
		for _, q := range req.Queries {
			var qm QueryModel
			if err := json.Unmarshal(q.JSON, &qm); err != nil {
				continue
			}
			
			// Check if this is a logs query
			isLogsQuery := qm.QueryType == "logs" || (qm.QueryType == "" && qm.LogQuery != "")
			if isLogsQuery {
				logsReq.Queries = append(logsReq.Queries, q)
			}
		}
		
		// Execute logs queries using the dedicated logs handler
		logsResponse, err := d.queryLogs(ddCtx, logsReq)
		if err != nil {
			logger.Error("Failed to execute logs queries", "error", err)
			// Set error responses for all logs queries
			for refID := range logsQueryModels {
				response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("logs query failed: %v", err))
			}
		} else {
			// Merge logs responses into main response
			for refID, logsResp := range logsResponse.Responses {
				response.Responses[refID] = logsResp
			}
		}
	}

	// Only proceed with metrics API call if we have metrics queries or formulas
	if len(metricsQueries) == 0 && len(formulas) == 0 {
		// If we only have logs queries, we've already handled them above
		return response, nil
	}

	// Create the request body for metrics queries
	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				From:    from,
				To:      to,
				Queries: metricsQueries,
			},
		},
	}

	// Add formulas if we have any
	if hasFormulas {
		body.Data.Attributes.Formulas = formulas
	}

	// Set interval - use override from any query that has it, otherwise let Datadog auto-calculate
	for _, qm := range queryModels {
		if qm.Interval != nil && *qm.Interval > 0 {
			body.Data.Attributes.Interval = qm.Interval
			break // Use the first interval override found
		}
	}

	// Create context with timeout
	queryCtx, cancel := context.WithTimeout(ddCtx, 30*time.Second)
	defer cancel()

	// Call Datadog API
	resp, r, err := metricsApi.QueryTimeseriesData(queryCtx, body)
	if err != nil {
		// Log request body for debugging
		requestBody, _ := json.MarshalIndent(body, "", "  ")
		logger.Error("QueryTimeseriesData request body", "request", string(requestBody))

		// Log HTTP response details
		httpStatus := 0
		var responseBody string
		if r != nil {
			httpStatus = r.StatusCode
			if r.Body != nil {
				bodyBytes, _ := io.ReadAll(r.Body)
				responseBody = string(bodyBytes)
				r.Body = io.NopCloser(strings.NewReader(responseBody))
			}
		}

		logger.Error("QueryTimeseriesData API call failed",
			"error", err,
			"httpStatus", httpStatus,
			"responseBody", responseBody)

		// Return error for all queries
		errorMsg := d.parseDatadogError(err, httpStatus, responseBody)
		for refID := range queryModels {
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, errorMsg)
		}
		return response, nil
	}

	// Process the response and create frames for each query/formula
	d.processTimeseriesResponse(&resp, queryModels, response)

	return response, nil
}

// parseDatadogErrorResponse extracts detailed error information from Datadog API error responses
func parseDatadogErrorResponse(responseBody string, queryText string) string {
	if responseBody == "" {
		return "Invalid query syntax"
	}

	// Try to parse JSON response
	var errResp map[string]interface{}
	if err := json.Unmarshal([]byte(responseBody), &errResp); err != nil {
		// If not JSON, return the raw response (trimmed)
		if len(responseBody) > 200 {
			return fmt.Sprintf("Invalid query: %s...", responseBody[:200])
		}
		return fmt.Sprintf("Invalid query: %s", responseBody)
	}

	// Extract error messages from different possible formats
	var errorMessages []string

	// Handle "errors" field (array of errors)
	if errorsField, ok := errResp["errors"]; ok {
		switch errors := errorsField.(type) {
		case []interface{}:
			for _, errItem := range errors {
				if errMsg, ok := errItem.(string); ok {
					errorMessages = append(errorMessages, errMsg)
				} else if errObj, ok := errItem.(map[string]interface{}); ok {
					// Handle error object with message field
					if msg, ok := errObj["message"]; ok {
						if msgStr, ok := msg.(string); ok {
							errorMessages = append(errorMessages, msgStr)
						}
					} else if detail, ok := errObj["detail"]; ok {
						if detailStr, ok := detail.(string); ok {
							errorMessages = append(errorMessages, detailStr)
						}
					}
				}
			}
		case string:
			errorMessages = append(errorMessages, errors)
		}
	}

	// Handle "error" field (single error)
	if len(errorMessages) == 0 {
		if errorField, ok := errResp["error"]; ok {
			switch errValue := errorField.(type) {
			case string:
				errorMessages = append(errorMessages, errValue)
			case map[string]interface{}:
				if msg, ok := errValue["message"]; ok {
					if msgStr, ok := msg.(string); ok {
						errorMessages = append(errorMessages, msgStr)
					}
				}
			}
		}
	}

	// Handle "message" field directly
	if len(errorMessages) == 0 {
		if msgField, ok := errResp["message"]; ok {
			if msgStr, ok := msgField.(string); ok {
				errorMessages = append(errorMessages, msgStr)
			}
		}
	}

	// If we found error messages, combine them
	if len(errorMessages) > 0 {
		// Combine multiple errors
		errorText := strings.Join(errorMessages, "; ")

		// Provide context-aware suggestions
		suggestion := suggestQueryFix(errorText, queryText)
		if suggestion != "" {
			return fmt.Sprintf("Invalid query: %s\n%s", errorText, suggestion)
		}
		return fmt.Sprintf("Invalid query: %s", errorText)
	}

	// Fallback if no recognizable error format
	return "Invalid query syntax"
}

// suggestQueryFix provides helpful suggestions based on error messages
func suggestQueryFix(errorMsg string, queryText string) string {
	lowerError := strings.ToLower(errorMsg)

	// Check for logs-specific error patterns first
	if strings.Contains(lowerError, "logs") || strings.Contains(lowerError, "log") {
		if strings.Contains(lowerError, "service") || strings.Contains(lowerError, "facet") {
			return "Suggestion: Use logs facet syntax 'service:api-gateway' or 'source:nginx'. Multiple facets: 'service:web-app source:nginx'"
		}
		if strings.Contains(lowerError, "status") || strings.Contains(lowerError, "level") {
			return "Suggestion: Use log level syntax 'status:ERROR' or 'status:(ERROR OR WARN)'. Valid levels: DEBUG, INFO, WARN, ERROR, FATAL"
		}
		if strings.Contains(lowerError, "operator") || strings.Contains(lowerError, "boolean") {
			return "Suggestion: Use boolean operators 'AND', 'OR', 'NOT'. Example: 'service:web-app AND status:ERROR'"
		}
		if strings.Contains(lowerError, "wildcard") || strings.Contains(lowerError, "pattern") {
			return "Suggestion: Use wildcard patterns like 'error*' or '*exception*' for text matching"
		}
		return "Suggestion: Use Datadog logs search syntax. Examples: 'service:web-app status:ERROR', 'error AND service:api', 'source:nginx'"
	}

	// Check for metrics-specific error patterns
	if strings.Contains(lowerError, "metric") || strings.Contains(lowerError, "unknown") {
		return "Suggestion: Verify the metric name exists. Common formats: 'system.cpu', 'datadog.estimated_usage.metrics.custom', 'avg:system.cpu{*}'"
	}

	if strings.Contains(lowerError, "tag") || strings.Contains(lowerError, "filter") || strings.Contains(lowerError, "syntax") {
		return "Suggestion: Use tag syntax 'tag_key:tag_value' (e.g., 'host:web-01'). Multiple tags: 'host:web-01,env:prod'"
	}

	if strings.Contains(lowerError, "aggregation") || strings.Contains(lowerError, "function") {
		return "Suggestion: Use valid aggregation functions with 'by' keyword. Examples: 'by avg', 'by max', 'by sum'"
	}

	if strings.Contains(lowerError, "formula") || strings.Contains(lowerError, "expression") {
		return "Suggestion: Ensure query follows Datadog format: 'metric{tags} by aggregation'"
	}

	if strings.Contains(lowerError, "brace") || strings.Contains(lowerError, "bracket") {
		return "Suggestion: Ensure braces are balanced in tag section: '{...}'"
	}

	return ""
}

// replaceTemplateVariables replaces template variables like {{keyName}} with actual values from labels
func replaceTemplateVariables(template string, labels map[string]string) string {
	result := template
	for key, value := range labels {
		// Replace {{keyName}} with actual value
		placeholder := "{{" + key + "}}"
		result = strings.ReplaceAll(result, placeholder, value)
	}
	return result
}

// queryDatadog executes a Datadog query and returns Grafana DataFrames
func (d *Datasource) queryDatadog(ctx context.Context, api *datadogV2.MetricsApi, from, to int64, qm *QueryModel, refID string) (data.Frames, error) {
	logger := log.New()

	// Modify query to include "by {*}" if no "by" clause is present
	// This ensures we get individual series instead of a single aggregated series
	// However, skip this if the query already has complex filtering (IN, OR, AND operators)
	// as those queries are likely already designed to return specific series
	queryText := qm.QueryText
	lowerQuery := strings.ToLower(queryText)
	
	hasGroupByClause := strings.Contains(lowerQuery, " by ")
	hasBooleanOperators := strings.Contains(lowerQuery, " in ") || 
						  strings.Contains(lowerQuery, " or ") || 
						  strings.Contains(lowerQuery, " and ") ||
						  strings.Contains(lowerQuery, " not in ")
	
	if !hasGroupByClause && !hasBooleanOperators {
		// No "by" clause and no boolean operators present, add "by {*}" to get all series
		queryText = queryText + " by {*}"
		logger.Debug("Added 'by {*}' to query", "original", qm.QueryText, "modified", queryText)
	} else if hasBooleanOperators {
		logger.Debug("Skipping 'by {*}' addition due to boolean operators", "original", qm.QueryText)
	}

	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				From: from,
				To:   to,
				Queries: []datadogV2.TimeseriesQuery{
					{
						MetricsTimeseriesQuery: &datadogV2.MetricsTimeseriesQuery{
							DataSource: datadogV2.METRICSDATASOURCE_METRICS,
							Query:      queryText,
						}},
				},
			},
		},
	}

	// Call Datadog Metrics API
	resp, r, err := api.QueryTimeseriesData(ctx, body)
	if err != nil {
		// Log request body for debugging
		requestBody, _ := json.MarshalIndent(body, "", "  ")
		logger.Error("QueryTimeseriesData request body",
			"request", string(requestBody))

		// Log HTTP response details
		httpStatus := 0
		var responseBody string
		if r != nil {
			httpStatus = r.StatusCode
			if r.Body != nil {
				bodyBytes, _ := io.ReadAll(r.Body)
				responseBody = string(bodyBytes)
				// Restore body for potential future reads (though it's exhausted here)
				r.Body = io.NopCloser(strings.NewReader(responseBody))
			}
		}

		logger.Error("QueryTimeseriesData API call failed",
			"error", err,
			"errorString", err.Error(),
			"httpStatus", httpStatus,
			"responseBody", responseBody)

		fmt.Fprintf(os.Stderr, "Error when calling `MetricsApi.QueryTimeseriesData`: %v\n", err)
		fmt.Fprintf(os.Stderr, "HTTP Status: %d\n", httpStatus)
		fmt.Fprintf(os.Stderr, "Response Body: %s\n", responseBody)

		// Build detailed error message based on HTTP status and response
		var errorMsg string

		// Check for authentication errors
		if httpStatus == 401 || strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "Unauthorized") {
			errorMsg = "Invalid Datadog API credentials"
		} else if httpStatus == 403 || strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "Forbidden") {
			errorMsg = "API key missing required permissions (need 'metrics_read' scope)"
		} else if httpStatus == 400 || strings.Contains(err.Error(), "400") {
			// Parse error response for specific validation issues
			errorMsg = parseDatadogErrorResponse(responseBody, qm.QueryText)
		} else if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "context deadline exceeded") {
			errorMsg = "Query timeout - Datadog API took too long to respond"
		} else if httpStatus >= 500 {
			errorMsg = fmt.Sprintf("Datadog API error (%d) - service may be unavailable", httpStatus)
		} else {
			errorMsg = fmt.Sprintf("Datadog API error: %s", err.Error())
		}

		return nil, fmt.Errorf("%s", errorMsg)
	}

	// Debug: Log the response to understand what Datadog is returning
	// responseContent, _ := json.MarshalIndent(resp, "", "  ")
	// logger.Debug("Datadog API Response", "response", string(responseContent))

	// Build frames from response
	var frames data.Frames

	// Check if response has series data
	series := resp.GetData()
	if len(series.Attributes.Series) == 0 {
		return frames, nil
	}

	times := resp.GetData().Attributes.GetTimes()
	values := resp.GetData().Attributes.GetValues()

	logger.Info("Processing Datadog series", 
		"seriesCount", len(series.Attributes.Series),
		"timesCount", len(times),
		"valuesCount", len(values))

	for i := range series.Attributes.GetSeries() {
		s := &series.Attributes.Series[i]

		// Use the series index (i) instead of queryIndex for values array
		// queryIndex is for multi-query requests, but for series within the same query,
		// we need to use the series index to get the correct values
		seriesIndex := i

		// Check if we have data for this series index
		if seriesIndex >= len(values) {
			logger.Warn("Series index out of bounds", "seriesIndex", seriesIndex, "valuesCount", len(values))
			continue
		}

		pointlist := values[seriesIndex]
		if len(pointlist) == 0 {
			logger.Debug("Empty pointlist for series", "seriesIndex", seriesIndex)
			continue
		}

		// Extract metric name and build series label
		// The metric name comes from the query, group_tags identify the specific series
		metric := qm.QueryText

		// Parse group tags (dimensions) into labels
		labels := map[string]string{}
		tagSet := s.GetGroupTags()
		
		// Create a safe slice for logging first few values
		maxLogValues := 5
		if len(pointlist) < maxLogValues {
			maxLogValues = len(pointlist)
		}
		firstFewValues := make([]interface{}, maxLogValues)
		for idx := 0; idx < maxLogValues; idx++ {
			if pointlist[idx] != nil {
				firstFewValues[idx] = *pointlist[idx]
			} else {
				firstFewValues[idx] = nil
			}
		}
		
		logger.Info("Processing series", 
			"seriesIndex", seriesIndex,
			"queryIndex", *s.QueryIndex,
			"groupTags", tagSet,
			"pointCount", len(pointlist),
			"firstFewValues", firstFewValues)
		
		if len(tagSet) > 0 {
			for _, tag := range tagSet {
				parts := strings.SplitN(tag, ":", 2)
				if len(parts) == 2 {
					labels[parts[0]] = parts[1]
				}
			}
		}

		// Extract timestamps and values
		timeValues := make([]time.Time, 0)
		numberValues := make([]float64, 0)

		// pointlist is []*float64, and times is []int64 (in milliseconds from Datadog API)
		// Zip them together - Grafana expects time.Time objects
		for j, timeVal := range times {
			if j >= len(pointlist) {
				break
			}
			point := pointlist[j]
			if point != nil {
				// Convert milliseconds timestamp to time.Time
				timestamp := time.UnixMilli(timeVal)
				timeValues = append(timeValues, timestamp)
				numberValues = append(numberValues, *point)
			}
		}

		if len(timeValues) == 0 {
			logger.Debug("No valid time values for series", "seriesIndex", seriesIndex)
			continue
		}

		// Build series name using new legend configuration
		seriesName := metric // Default to the query text if no custom legend
		
		// Determine legend template based on legend mode
		var legendTemplate string
		if qm.LegendMode == "custom" && qm.LegendTemplate != "" {
			legendTemplate = qm.LegendTemplate
		} else if qm.InterpolatedLabel != "" {
			// Backward compatibility: use interpolated label if available
			legendTemplate = qm.InterpolatedLabel
		} else if qm.Label != "" {
			// Backward compatibility: fall back to old label field
			legendTemplate = qm.Label
		}
		
		if legendTemplate != "" {
			// Use the legend template, replacing template variables with label values
			seriesName = replaceTemplateVariables(legendTemplate, labels)
		} else if len(labels) > 0 {
			// Auto mode: use default format with metric + labels
			var labelStrings []string
			for k, v := range labels {
				labelStrings = append(labelStrings, k+":"+v)
			}
			seriesName = metric + " {" + strings.Join(labelStrings, ", ") + "}"
		}

		logger.Info("Creating frame for series", 
			"seriesIndex", seriesIndex,
			"seriesName", seriesName,
			"labels", labels,
			"timeValueCount", len(timeValues),
			"numberValueCount", len(numberValues))

		// Create data frame with proper timeseries format
		frame := data.NewFrame(
			seriesName, // Use the correctly formatted series name as frame name
			data.NewField("Time", nil, timeValues),
			data.NewField("Value", labels, numberValues), // Attach labels to the field for filtering/grouping
		)

		// Configure the display name to ensure it shows the formatted name
		frame.Fields[1].Config = &data.FieldConfig{
			DisplayName: seriesName, // Explicitly set display name to our formatted series name
		}

		// Set metadata to indicate this is timeseries data
		frame.Meta = &data.FrameMeta{
			Type: data.FrameTypeTimeSeriesMulti,
		}

		frame.RefID = refID // Use the query's RefID instead of metric name
		frames = append(frames, frame)
	}

	logger.Info("Completed processing series", "totalFrames", len(frames))
	return frames, nil
}

// parseDatadogError parses Datadog API errors and returns user-friendly messages
func (d *Datasource) parseDatadogError(err error, httpStatus int, responseBody string) string {
	if httpStatus == 401 || strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "Unauthorized") {
		return "Invalid Datadog API credentials - check your API key and App key"
	} else if httpStatus == 403 || strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "Forbidden") {
		// Check if this is a logs-specific permission error
		if strings.Contains(responseBody, "logs") || strings.Contains(err.Error(), "logs") {
			return "API key missing required permissions - need 'logs_read_data' scope"
		}
		return "API key missing required permissions (need 'metrics_read' scope)"
	} else if httpStatus == 400 || strings.Contains(err.Error(), "400") {
		return parseDatadogErrorResponse(responseBody, "")
	} else if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "context deadline exceeded") {
		// Check if this is a logs query timeout
		if strings.Contains(responseBody, "logs") || strings.Contains(err.Error(), "logs") {
			return "Log query timeout - try narrowing your search criteria or time range"
		}
		return "Query timeout - Datadog API took too long to respond"
	} else if httpStatus >= 500 {
		return fmt.Sprintf("Datadog API error (%d) - service may be unavailable", httpStatus)
	}
	return fmt.Sprintf("Datadog API error: %s", err.Error())
}

// processTimeseriesResponse processes the Datadog API response and creates frames for each query
func (d *Datasource) processTimeseriesResponse(resp *datadogV2.TimeseriesFormulaQueryResponse, queryModels map[string]QueryModel, response *backend.QueryDataResponse) {
	logger := log.New()
	
	// Check if response has series data
	series := resp.GetData()
	if len(series.Attributes.Series) == 0 {
		// Return empty responses for all queries
		for refID := range queryModels {
			response.Responses[refID] = backend.DataResponse{Frames: data.Frames{}}
		}
		return
	}

	times := resp.GetData().Attributes.GetTimes()
	values := resp.GetData().Attributes.GetValues()

	logger.Info("Processing Datadog series", 
		"seriesCount", len(series.Attributes.Series),
		"timesCount", len(times),
		"valuesCount", len(values))

	// Map query indices to refIDs for legend formatting
	queryList := make([]string, 0, len(queryModels))
	for refID := range queryModels {
		queryList = append(queryList, refID)
	}
	sort.Strings(queryList) // Ensure consistent ordering

	// Group frames by query index (which corresponds to refID)
	framesByQuery := make(map[int]data.Frames)

	for i := range series.Attributes.GetSeries() {
		s := &series.Attributes.Series[i]
		
		// Get the query index to determine which refID this belongs to
		queryIndex := int(*s.QueryIndex)
		
		// Check if we have data for this series index
		if i >= len(values) {
			logger.Warn("Series index out of bounds", "seriesIndex", i, "valuesCount", len(values))
			continue
		}

		pointlist := values[i]
		if len(pointlist) == 0 {
			logger.Debug("Empty pointlist for series", "seriesIndex", i)
			continue
		}

		// Extract timestamps and values
		timeValues := make([]time.Time, 0)
		numberValues := make([]float64, 0)

		for j, timeVal := range times {
			if j >= len(pointlist) {
				break
			}
			point := pointlist[j]
			if point != nil {
				timestamp := time.UnixMilli(timeVal)
				timeValues = append(timeValues, timestamp)
				numberValues = append(numberValues, *point)
			}
		}

		if len(timeValues) == 0 {
			logger.Debug("No valid time values for series", "seriesIndex", i)
			continue
		}

		// Build series name and labels
		labels := map[string]string{}
		tagSet := s.GetGroupTags()
		
		if len(tagSet) > 0 {
			for _, tag := range tagSet {
				parts := strings.SplitN(tag, ":", 2)
				if len(parts) == 2 {
					labels[parts[0]] = parts[1]
				}
			}
		}

		// Get the query model for this query to determine legend formatting
		refID := queryList[queryIndex]
		qm, exists := queryModels[refID]
		if !exists {
			logger.Warn("Query model not found for refID", "refID", refID)
			continue
		}

		// Build series name using legend configuration (same logic as queryDatadog)
		metric := qm.QueryText // Default to the query text if no custom legend
		seriesName := metric
		
		// Determine legend template based on legend mode
		var legendTemplate string
		if qm.LegendMode == "custom" && qm.LegendTemplate != "" {
			legendTemplate = qm.LegendTemplate
		} else if qm.LegendMode != "auto" {
			// Only use legacy fields when NOT in auto mode
			if qm.InterpolatedLabel != "" {
				// Backward compatibility: use interpolated label if available
				legendTemplate = qm.InterpolatedLabel
			} else if qm.Label != "" {
				// Backward compatibility: fall back to old label field
				legendTemplate = qm.Label
			}
		}
		// If LegendMode is "auto" or empty, legendTemplate remains empty and we use auto format
		
		if legendTemplate != "" {
			// Use the legend template, replacing template variables with label values
			seriesName = replaceTemplateVariables(legendTemplate, labels)
		} else if len(labels) > 0 {
			// Auto mode: use default format with metric + labels
			var labelStrings []string
			for k, v := range labels {
				labelStrings = append(labelStrings, k+":"+v)
			}
			seriesName = metric + " {" + strings.Join(labelStrings, ", ") + "}"
		}
		
		// Create data frame
		frame := data.NewFrame(
			seriesName,
			data.NewField("Time", nil, timeValues),
			data.NewField("Value", labels, numberValues),
		)

		// Configure the display name to ensure it shows the formatted name
		frame.Fields[1].Config = &data.FieldConfig{
			DisplayName: seriesName, // Explicitly set display name to our formatted series name
		}

		// Set metadata
		frame.Meta = &data.FrameMeta{
			Type: data.FrameTypeTimeSeriesMulti,
		}

		// Add to the appropriate query group
		framesByQuery[queryIndex] = append(framesByQuery[queryIndex], frame)
	}

	// Map query indices back to refIDs and set responses
	for queryIndex, frames := range framesByQuery {
		if queryIndex < len(queryList) {
			refID := queryList[queryIndex]
			
			// Set refID on all frames
			for _, frame := range frames {
				frame.RefID = refID
			}
			
			response.Responses[refID] = backend.DataResponse{
				Frames: frames,
			}
			
			logger.Info("Created frames for query", "refID", refID, "frameCount", len(frames))
		}
	}

	// Ensure all queries have a response (even if empty)
	for refID := range queryModels {
		if _, exists := response.Responses[refID]; !exists {
			response.Responses[refID] = backend.DataResponse{Frames: data.Frames{}}
		}
	}
}

// CallResource handles resource calls (autocomplete endpoints)
func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	
	// CRITICAL DEBUG: Log all incoming requests with ERROR level to ensure visibility
	logger.Error("CRITICAL DEBUG - CallResource received request", 
		"method", req.Method, 
		"path", req.Path, 
		"bodyLength", len(req.Body),
		"body", string(req.Body),
		"headers", req.Headers)

	// Route requests to appropriate handlers
	switch {
	case req.Method == "GET" && req.Path == "autocomplete/metrics":
		return d.MetricsHandler(ctx, req, sender)
	case req.Method == "GET" && len(req.Path) > len("autocomplete/tags/") && req.Path[:len("autocomplete/tags/")] == "autocomplete/tags/":
		return d.TagsHandler(ctx, req, sender)
	case req.Method == "GET" && len(req.Path) > len("autocomplete/tag-values/") && req.Path[:len("autocomplete/tag-values/")] == "autocomplete/tag-values/":
		return d.TagValuesHandler(ctx, req, sender)
	case req.Method == "POST" && req.Path == "autocomplete/complete":
		return d.CompleteHandler(ctx, req, sender)
	// Logs autocomplete handlers - reuse existing concurrency limiting and timeout patterns
	case req.Method == "GET" && req.Path == "autocomplete/logs/services":
		return d.LogsServicesHandler(ctx, req, sender)
	case req.Method == "GET" && req.Path == "autocomplete/logs/sources":
		return d.LogsSourcesHandler(ctx, req, sender)
	// Variable resource handlers - Grafana strips "resources/" prefix
	case req.Method == "POST" && req.Path == "metrics":
		return d.VariableMetricsHandler(ctx, req, sender)
	case req.Method == "POST" && req.Path == "tag-keys":
		return d.VariableTagKeysHandler(ctx, req, sender)
	case req.Method == "POST" && req.Path == "tag-values":
		return d.VariableTagValuesHandler(ctx, req, sender)
	case req.Method == "POST" && req.Path == "all-tags":
		return d.VariableAllTagsHandler(ctx, req, sender)
	default:
		logger.Warn("Unknown resource path", "path", req.Path, "method", req.Method)
		return sender.Send(&backend.CallResourceResponse{
			Status: 404,
			Body:   []byte(`{"error": "endpoint not found"}`),
		})
	}
}

// MetricsHandler handles GET /autocomplete/metrics requests
func (d *Datasource) MetricsHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	ttl := 30 * time.Second

	// Check if cache is disabled via environment variable (for development)
	cacheDisabled := os.Getenv("DISABLE_CACHE") == "true"
	
	// Check cache first
	if !cacheDisabled {
		if cached := d.GetCachedEntry("metrics", ttl); cached != nil {
			logger.Debug("Returning cached metrics")
			respData, _ := json.Marshal(cached.Data)
			return sender.Send(&backend.CallResourceResponse{
				Status: 200,
				Body:   respData,
			})
		}
	}

	// Get API credentials
	apiKey, ok := d.SecureJSONData["apiKey"]
	if !ok {
		logger.Error("Missing apiKey")
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	appKey, ok := d.SecureJSONData["appKey"]
	if !ok {
		logger.Error("Missing appKey")
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Get site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	// Initialize Datadog API client with credentials and site
	// Don't use NewDefaultContext - just set values directly on the context
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

	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ddCtx, 2*time.Second)
	defer cancel()

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	// Fetch metrics from Datadog - ListTagConfigurations returns available metrics
	// Note: This requires the "metrics_read" scope on the API key
	resp, _, err := metricsApi.ListTagConfigurations(fetchCtx)
	if err != nil {
		// Log detailed error for debugging
		if err.Error() == "401 Unauthorized" {
			logger.Error("Failed to fetch metrics - check API and App key", "error", err)
		} else if err.Error() == "403 Forbidden" {
			logger.Error("Failed to fetch metrics - API key missing 'metrics_read' scope", "error", err)
		} else {
			logger.Error("Failed to fetch metrics", "error", err)
		}
		// Return empty array on timeout or error
		respData, _ := json.Marshal([]string{})
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Extract metric names from response
	// ListTagConfigurations returns MetricsAndMetricTagConfigurationsResponse
	data := resp.GetData()
	if data == nil {
		respData, _ := json.Marshal([]string{})
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	metrics := []string{}
	for _, config := range data {
		// MetricsAndMetricTagConfigurations is a OneOf type - check which field is populated
		if config.Metric != nil {
			metricName := config.Metric.GetId()
			if metricName != "" {
				metrics = append(metrics, metricName)
			}
		} else if config.MetricTagConfiguration != nil {
			metricName := config.MetricTagConfiguration.GetId()
			if metricName != "" {
				metrics = append(metrics, metricName)
			}
		}
	}

	// Cache the result
	d.SetCachedEntry("metrics", metrics)

	// Return metrics as JSON
	respData, _ := json.Marshal(metrics)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// TagsHandler handles GET /autocomplete/tags/{metric} requests
func (d *Datasource) TagsHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	ttl := 30 * time.Second

	// Extract metric name from path: "autocomplete/tags/{metric}"
	metric := req.Path[len("autocomplete/tags/"):]
	if metric == "" {
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "metric name required"}`),
		})
	}

	cacheKey := "tags:" + metric

	// Check if cache is disabled via environment variable (for development)
	cacheDisabled := os.Getenv("DISABLE_CACHE") == "true"
	
	// Check cache first (skip cache if it's empty to force refresh or if cache is disabled)
	if !cacheDisabled {
		if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil && len(cached.Data) > 0 {
			logger.Debug("Returning cached tags", "metric", metric, "tagCount", len(cached.Data))
			respData, _ := json.Marshal(cached.Data)
			return sender.Send(&backend.CallResourceResponse{
				Status: 200,
				Body:   respData,
			})
		}
	}
	
	// If cache is empty, expired, or disabled, fetch fresh data
	logger.Debug("Fetching fresh tags", "metric", metric, "cacheDisabled", cacheDisabled)

	// Get API credentials
	apiKey, ok := d.SecureJSONData["apiKey"]
	if !ok {
		logger.Error("Missing apiKey")
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	appKey, ok := d.SecureJSONData["appKey"]
	if !ok {
		logger.Error("Missing appKey")
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Get site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com"
	}

	// Initialize Datadog API client with credentials and site
	// Don't use NewDefaultContext - just set values directly on the context
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

	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ddCtx, 2*time.Second)
	defer cancel()

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	// Check if metric name is a regex pattern
	isRegexPattern := len(metric) >= 2 && metric[0] == '/' && metric[len(metric)-1] == '/'
	
	var tags []string
	
	if !isRegexPattern {
		// Fetch tags from Datadog using ListTagsByMetricName for literal metric names
		// This returns all tags associated with a specific metric
		logger.Debug("Fetching tags for metric using ListTagsByMetricName", "metric", metric)

		resp, httpResp, err := metricsApi.ListTagsByMetricName(fetchCtx, metric)
		if err != nil {
			httpStatus := 0
			if httpResp != nil {
				httpStatus = httpResp.StatusCode
			}
			logger.Error("Failed to fetch tags", "error", err, "metric", metric, "httpStatus", httpStatus)
			// Return empty array on timeout or error
			respData, _ := json.Marshal([]string{})
			return sender.Send(&backend.CallResourceResponse{
				Status: 200,
				Body:   respData,
			})
		}

		// Extract tag keys from response
		// The response contains tags in format "key:value", we need to extract unique keys
		tagKeysSet := make(map[string]bool)
		data := resp.GetData()
		
		logger.Debug("Got response from ListTagsByMetricName", "metric", metric, "hasData", data.Id != nil)
		
		if data.Id != nil {
			attributes := data.GetAttributes()
			allTags := attributes.GetTags()
			logger.Debug("Got tags from attributes", "metric", metric, "tagCount", len(allTags))
			
			// Tags are in format "key:value", extract unique keys
			for _, tag := range allTags {
				parts := strings.SplitN(tag, ":", 2)
				if len(parts) >= 1 {
					tagKey := parts[0]
					tagKeysSet[tagKey] = true
				}
			}
		}

		// Convert set to sorted slice
		tags = make([]string, 0, len(tagKeysSet))
		for key := range tagKeysSet {
			tags = append(tags, key)
		}
	} else {
		// Handle regex pattern for metric name - return empty array
		logger.Debug("Regex pattern detected for autocomplete tags, returning empty array", "pattern", metric)
		// For autocomplete with regex patterns, return empty array since we can't efficiently 
		// fetch and aggregate tags from all matching metrics in real-time
		tags = []string{}
	}
	
	logger.Debug("Extracted tag keys", "metric", metric, "tagCount", len(tags), "tags", tags)

	// Cache the result
	d.SetCachedEntry(cacheKey, tags)

	// Return tags as JSON
	respData, _ := json.Marshal(tags)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// TagValuesHandler handles GET /autocomplete/tag-values/{metric}/{tagKey} requests
func (d *Datasource) TagValuesHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	ttl := 30 * time.Second

	// Extract metric name and tag key from path: "autocomplete/tag-values/{metric}/{tagKey}"
	pathParts := strings.Split(req.Path[len("autocomplete/tag-values/"):], "/")
	if len(pathParts) < 2 {
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "metric name and tag key required"}`),
		})
	}

	metric := pathParts[0]
	tagKey := pathParts[1]

	if metric == "" || tagKey == "" {
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "metric name and tag key required"}`),
		})
	}

	cacheKey := "tag-values:" + metric + ":" + tagKey

	// Check if cache is disabled via environment variable (for development)
	cacheDisabled := os.Getenv("DISABLE_CACHE") == "true"

	// Check cache first
	if !cacheDisabled {
		if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil && len(cached.Data) > 0 {
			logger.Debug("Returning cached tag values", "metric", metric, "tagKey", tagKey, "valueCount", len(cached.Data))
			respData, _ := json.Marshal(cached.Data)
			return sender.Send(&backend.CallResourceResponse{
				Status: 200,
				Body:   respData,
			})
		}
	}

	// If cache is empty, expired, or disabled, fetch fresh data
	logger.Debug("Fetching fresh tag values", "metric", metric, "tagKey", tagKey, "cacheDisabled", cacheDisabled)

	// Get API credentials
	apiKey, ok := d.SecureJSONData["apiKey"]
	if !ok {
		logger.Error("Missing apiKey")
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	appKey, ok := d.SecureJSONData["appKey"]
	if !ok {
		logger.Error("Missing appKey")
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Get site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com"
	}

	// Initialize Datadog API client with credentials and site
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

	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ddCtx, 2*time.Second)
	defer cancel()

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	// Fetch tags from Datadog using ListTagsByMetricName
	logger.Debug("Fetching tag values for metric and tag key", "metric", metric, "tagKey", tagKey)

	resp, httpResp, err := metricsApi.ListTagsByMetricName(fetchCtx, metric)
	if err != nil {
		httpStatus := 0
		if httpResp != nil {
			httpStatus = httpResp.StatusCode
		}
		logger.Error("Failed to fetch tag values", "error", err, "metric", metric, "tagKey", tagKey, "httpStatus", httpStatus)
		// Return empty array on timeout or error
		respData, _ := json.Marshal([]string{})
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Extract tag values for the specific tag key from response
	tagValuesSet := make(map[string]bool)
	data := resp.GetData()

	logger.Debug("Got response from ListTagsByMetricName", "metric", metric, "hasData", data.Id != nil)

	if data.Id != nil {
		attributes := data.GetAttributes()
		allTags := attributes.GetTags()
		logger.Debug("Got tags from attributes", "metric", metric, "tagCount", len(allTags))

		// Tags are in format "key:value", extract values for the specific key
		for _, tag := range allTags {
			parts := strings.SplitN(tag, ":", 2)
			if len(parts) == 2 && parts[0] == tagKey {
				tagValue := parts[1]
				tagValuesSet[tagValue] = true
			}
		}
	}

	// Convert set to sorted slice
	tagValues := make([]string, 0, len(tagValuesSet))
	for value := range tagValuesSet {
		tagValues = append(tagValues, value)
	}

	logger.Debug("Extracted tag values", "metric", metric, "tagKey", tagKey, "valueCount", len(tagValues), "values", tagValues)

	// Cache the result
	d.SetCachedEntry(cacheKey, tagValues)

	// Return tag values as JSON
	respData, _ := json.Marshal(tagValues)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// CheckHealth checks the health of the datasource connection
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger := log.New()

	// Get API credentials from secure JSON data
	apiKey, ok := d.SecureJSONData["apiKey"]
	if !ok {
		logger.Error("CheckHealth: apiKey not found in SecureJSONData")
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Missing API key",
		}, nil
	}

	appKey, ok := d.SecureJSONData["appKey"]
	if !ok {
		logger.Error("CheckHealth: appKey not found in SecureJSONData")
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Missing App key",
		}, nil
	}

	if len(apiKey) == 0 || len(appKey) == 0 {
		logger.Error("CheckHealth: credentials are empty", "apiKeyLen", len(apiKey), "appKeyLen", len(appKey))
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "API key or App key is empty",
		}, nil
	}

	// Get Datadog site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	// Log credentials info (without exposing full keys)
	apiKeyPrefix := ""
	if len(apiKey) >= 8 {
		apiKeyPrefix = apiKey[:8]
	} else if len(apiKey) > 0 {
		apiKeyPrefix = apiKey
	}
	appKeyPrefix := ""
	if len(appKey) >= 8 {
		appKeyPrefix = appKey[:8]
	} else if len(appKey) > 0 {
		appKeyPrefix = appKey
	}

	logger.Info("CheckHealth: starting health check",
		"site", site,
		"apiKeyLen", len(apiKey),
		"appKeyLen", len(appKey),
		"apiKeyPrefix", apiKeyPrefix,
		"appKeyPrefix", appKeyPrefix)

	// Set up context with credentials and site
	// Don't use NewDefaultContext - just set values directly on the context
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

	// Create timeout context for health check
	healthCtx, cancel := context.WithTimeout(ddCtx, 5*time.Second)
	defer cancel()

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	// Use v2 QueryTimeseriesData endpoint for health check (same as production queries)
	now := time.Now()
	fromMs := now.Add(-1 * time.Hour).UnixMilli()
	toMs := now.UnixMilli()

	interval := int64(5000)
	formula := "a"
	queryName := "a"

	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				From:     fromMs,
				To:       toMs,
				Interval: &interval,
				Formulas: []datadogV2.QueryFormula{
					{
						Formula: formula,
					},
				},
				Queries: []datadogV2.TimeseriesQuery{
					{
						MetricsTimeseriesQuery: &datadogV2.MetricsTimeseriesQuery{
							DataSource: datadogV2.METRICSDATASOURCE_METRICS,
							Query:      "avg:datadog.estimated_usage.metrics.custom{*}",
							Name:       &queryName,
						}},
				},
			},
		},
	}

	logger.Info("CheckHealth: calling QueryTimeseriesData (v2 API)")

	// Log the request body
	requestBody, _ := json.MarshalIndent(body, "", "  ")
	logger.Debug("CheckHealth: request body", "request", string(requestBody))

	resp, httpResp, err := metricsApi.QueryTimeseriesData(healthCtx, body)
	if err != nil {
		httpStatus := 0
		var responseBody string
		if httpResp != nil {
			httpStatus = httpResp.StatusCode
			if httpResp.Body != nil {
				bodyBytes, _ := io.ReadAll(httpResp.Body)
				responseBody = string(bodyBytes)
				// Restore body for potential future reads
				httpResp.Body = io.NopCloser(strings.NewReader(responseBody))
			}
		}

		logger.Error("CheckHealth: API call failed",
			"error", err,
			"errorString", err.Error(),
			"httpStatus", httpStatus,
			"responseBody", responseBody)

		if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "Unauthorized") {
			logger.Error("Health check failed - authentication error", "error", err)
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "Invalid Datadog API credentials - check your API key and App key",
			}, nil
		}
		if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "Forbidden") {
			logger.Error("Health check failed - permission error", "error", err)
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "API key missing required permissions - need 'metrics_read' scope",
			}, nil
		}
		if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "context deadline exceeded") {
			logger.Error("Health check failed - timeout", "error", err)
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "Connection timeout - Datadog API is not responding",
			}, nil
		}
		logger.Error("Health check failed", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Failed to connect to Datadog: " + err.Error(),
		}, nil
	}

	logger.Info("CheckHealth: API call succeeded", "seriesCount", len(resp.GetData().Attributes.GetSeries()))
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Connected to Datadog",
	}, nil
}

// GetCachedEntry retrieves a cached entry if valid (not expired)
func (d *Datasource) GetCachedEntry(key string, ttl time.Duration) *CacheEntry {
	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()

	entry, ok := d.cache.entries[key]
	if !ok {
		return nil
	}

	// Check if expired
	if time.Since(entry.Timestamp) > ttl {
		delete(d.cache.entries, key)
		return nil
	}

	return entry
}

// SetCachedEntry stores data in cache with current timestamp
func (d *Datasource) SetCachedEntry(key string, data []string) {
	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()

	d.cache.entries[key] = &CacheEntry{
		Data:      data,
		Timestamp: time.Now(),
	}
}

// CleanExpiredCache removes expired entries from cache
func (d *Datasource) CleanExpiredCache(ttl time.Duration) {
	d.cache.mu.Lock()
	defer d.cache.mu.Unlock()

	now := time.Now()
	for key, entry := range d.cache.entries {
		if now.Sub(entry.Timestamp) > ttl {
			delete(d.cache.entries, key)
		}
	}
}

// GetCachedLogsEntry retrieves a cached logs entry if valid (not expired)
func (d *Datasource) GetCachedLogsEntry(key string, ttl time.Duration) *LogsCacheEntry {
	d.logsCacheMu.Lock()
	defer d.logsCacheMu.Unlock()

	entry, ok := d.logsCache[key]
	if !ok {
		return nil
	}

	// Check if expired
	if time.Since(entry.Timestamp) > ttl {
		delete(d.logsCache, key)
		return nil
	}

	return entry
}

// SetCachedLogsEntry stores logs data in cache with current timestamp
func (d *Datasource) SetCachedLogsEntry(key string, logEntries []LogEntry, nextCursor string) {
	d.logsCacheMu.Lock()
	defer d.logsCacheMu.Unlock()

	d.logsCache[key] = &LogsCacheEntry{
		LogEntries: logEntries,
		Timestamp:  time.Now(),
		NextCursor: nextCursor,
	}
}

// CleanExpiredLogsCache removes expired entries from logs cache
func (d *Datasource) CleanExpiredLogsCache(ttl time.Duration) {
	d.logsCacheMu.Lock()
	defer d.logsCacheMu.Unlock()

	now := time.Now()
	for key, entry := range d.logsCache {
		if now.Sub(entry.Timestamp) > ttl {
			delete(d.logsCache, key)
		}
	}
}

// CompleteRequest represents the request body for autocomplete completion
type CompleteRequest struct {
	Query          string `json:"query"`
	CursorPosition int    `json:"cursorPosition"`
	SelectedItem   string `json:"selectedItem"`
	ItemKind       string `json:"itemKind"`
}

// CompleteResponse represents the response for autocomplete completion
type CompleteResponse struct {
	NewQuery          string `json:"newQuery"`
	NewCursorPosition int    `json:"newCursorPosition"`
}

// Variable resource request/response models

// MetricsRequest represents the request for /resources/metrics endpoint
type MetricsRequest struct {
	Namespace     string `json:"namespace,omitempty"`
	SearchPattern string `json:"searchPattern,omitempty"`
}

// TagKeysRequest represents the request for /resources/tag-keys endpoint
type TagKeysRequest struct {
	MetricName string `json:"metricName,omitempty"`
	Filter     string `json:"filter,omitempty"` // Filter pattern for tag keys (supports regex with /pattern/)
}

// TagValuesRequest represents the request for /resources/tag-values endpoint
type TagValuesRequest struct {
	MetricName string `json:"metricName,omitempty"`
	TagKey     string `json:"tagKey"`
	Filter     string `json:"filter,omitempty"` // Filter pattern for tag values (supports regex with /pattern/)
}

// VariableResponse represents the response for variable resource endpoints
type VariableResponse struct {
	Values []string `json:"values"`
	Error  string   `json:"error,omitempty"`
}

// Enhanced logging and error handling utilities for variable operations

// generateTraceID creates a simple trace ID for request tracking
func generateTraceID() string {
	return fmt.Sprintf("var-%d", time.Now().UnixNano())
}

// logVariableRequest logs the start of a variable request with structured context
func logVariableRequest(logger log.Logger, traceID, endpoint, method string, requestData interface{}) {
	logger.Info("Variable request started",
		"traceID", traceID,
		"endpoint", endpoint,
		"method", method,
		"requestData", requestData,
		"timestamp", time.Now().Format(time.RFC3339))
}

// logVariableResponse logs the completion of a variable request with timing and status
func logVariableResponse(logger log.Logger, traceID, endpoint string, status int, duration time.Duration, resultCount int, err error) {
	fields := []interface{}{
		"traceID", traceID,
		"endpoint", endpoint,
		"status", status,
		"duration", duration,
		"resultCount", resultCount,
		"timestamp", time.Now().Format(time.RFC3339),
	}

	if err != nil {
		fields = append(fields, "error", err.Error())
		logger.Error("Variable request completed with error", fields...)
	} else {
		logger.Info("Variable request completed successfully", fields...)
	}
}

// logVariableError logs detailed error information for variable operations
func logVariableError(logger log.Logger, traceID, operation string, err error, context map[string]interface{}) {
	fields := []interface{}{
		"traceID", traceID,
		"operation", operation,
		"error", err.Error(),
		"errorType", fmt.Sprintf("%T", err),
		"timestamp", time.Now().Format(time.RFC3339),
	}

	// Add context fields
	for key, value := range context {
		fields = append(fields, key, value)
	}

	logger.Error("Variable operation error", fields...)
}

// createUserFriendlyError creates user-friendly error messages while logging technical details
func createUserFriendlyError(logger log.Logger, traceID string, technicalErr error, userMessage string, context map[string]interface{}) error {
	// Log technical details for debugging
	logVariableError(logger, traceID, "error_handling", technicalErr, context)
	
	// Return user-friendly error
	return fmt.Errorf("%s", userMessage)
}

// validateVariableRequest performs common validation for variable requests
func validateVariableRequest(logger log.Logger, traceID string, body []byte, target interface{}) error {
	if len(body) == 0 {
		return createUserFriendlyError(logger, traceID, 
			fmt.Errorf("empty request body"), 
			"Invalid request format", 
			map[string]interface{}{"bodyLength": 0})
	}

	if err := json.Unmarshal(body, target); err != nil {
		return createUserFriendlyError(logger, traceID, err, 
			"Invalid request format", 
			map[string]interface{}{"bodyLength": len(body), "body": string(body)})
	}

	return nil
}

// handleVariableAPIError processes Datadog API errors and returns appropriate HTTP responses
func handleVariableAPIError(logger log.Logger, traceID string, err error, operation string) (int, []byte) {
	context := map[string]interface{}{
		"operation": operation,
	}

	// Log technical error details
	logVariableError(logger, traceID, "datadog_api_error", err, context)

	// Determine appropriate HTTP status and user message based on error
	errorStr := err.Error()
	
	if strings.Contains(errorStr, "401") || strings.Contains(errorStr, "Unauthorized") {
		return 401, []byte(`{"error": "Invalid Datadog API credentials"}`)
	}
	
	if strings.Contains(errorStr, "403") || strings.Contains(errorStr, "Forbidden") {
		return 403, []byte(`{"error": "API key missing required permissions"}`)
	}
	
	if strings.Contains(errorStr, "timeout") || strings.Contains(errorStr, "context deadline exceeded") {
		return 504, []byte(`{"error": "Request timeout - Datadog API took too long to respond"}`)
	}
	
	if strings.Contains(errorStr, "400") || strings.Contains(errorStr, "Bad Request") {
		return 400, []byte(`{"error": "Invalid request parameters"}`)
	}

	// Default to 500 for other errors
	return 500, []byte(`{"error": "Unable to fetch data from Datadog"}`)
}

// matchesFilter checks if a value matches a filter pattern, supporting regex syntax
// If pattern is wrapped in /.../, it's treated as a regex pattern
// Otherwise, it's treated as a simple substring match
func matchesFilter(value, pattern string) bool {
	if pattern == "" || pattern == "*" {
		return true
	}
	
	// Check if pattern is a regex (wrapped in forward slashes)
	if len(pattern) >= 2 && pattern[0] == '/' && pattern[len(pattern)-1] == '/' {
		// Extract regex pattern (remove surrounding slashes)
		regexPattern := pattern[1 : len(pattern)-1]
		
		// Compile and match regex
		if regex, err := regexp.Compile(regexPattern); err == nil {
			return regex.MatchString(value)
		}
		// If regex compilation fails, fall back to substring match
		return strings.Contains(value, regexPattern)
	}
	
	// Default substring match
	return strings.Contains(value, pattern)
}

// validateAPICredentials checks for required API credentials and logs missing credentials
func validateAPICredentials(logger log.Logger, traceID string, secureData map[string]string) error {
	if apiKey, ok := secureData["apiKey"]; !ok || apiKey == "" {
		return createUserFriendlyError(logger, traceID,
			fmt.Errorf("missing or empty apiKey"),
			"Invalid Datadog API credentials",
			map[string]interface{}{"credential": "apiKey", "present": ok, "empty": apiKey == ""})
	}

	if appKey, ok := secureData["appKey"]; !ok || appKey == "" {
		return createUserFriendlyError(logger, traceID,
			fmt.Errorf("missing or empty appKey"),
			"Invalid Datadog API credentials",
			map[string]interface{}{"credential": "appKey", "present": ok, "empty": appKey == ""})
	}

	return nil
}

// Helper functions to eliminate code duplication in variable handlers

// setupDatadogClient creates a configured Datadog API client with credentials and site
func (d *Datasource) setupDatadogClient(ctx context.Context) (*datadogV2.MetricsApi, context.Context, error) {
	// Get site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com"
	}

	// Initialize Datadog API client with credentials and site
	ddCtx := context.WithValue(ctx, datadog.ContextServerVariables, map[string]string{
		"site": site,
	})
	ddCtx = context.WithValue(ddCtx, datadog.ContextAPIKeys, map[string]datadog.APIKey{
		"apiKeyAuth": {
			Key: d.SecureJSONData["apiKey"],
		},
		"appKeyAuth": {
			Key: d.SecureJSONData["appKey"],
		},
	})

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	return metricsApi, ddCtx, nil
}

// extractMetricName extracts metric name from ListTagConfigurations response config
func extractMetricName(config datadogV2.MetricsAndMetricTagConfigurations) string {
	// Check MetricTagConfiguration first (this is where the data usually is)
	if config.MetricTagConfiguration != nil {
		return config.MetricTagConfiguration.GetId()
	}
	// Fallback to Metric field
	if config.Metric != nil {
		return config.Metric.GetId()
	}
	return ""
}

// extractTagKeysFromTags extracts unique tag keys from "key:value" formatted tags
func extractTagKeysFromTags(tags []string) []string {
	tagKeysSet := make(map[string]bool)
	for _, tag := range tags {
		parts := strings.SplitN(tag, ":", 2)
		if len(parts) >= 1 {
			tagKey := parts[0]
			tagKeysSet[tagKey] = true
		}
	}
	
	// Convert set to slice
	tagKeys := make([]string, 0, len(tagKeysSet))
	for key := range tagKeysSet {
		tagKeys = append(tagKeys, key)
	}
	return tagKeys
}

// extractTagValuesForKey extracts tag values for a specific key from "key:value" formatted tags
func extractTagValuesForKey(tags []string, targetKey string) []string {
	tagValuesSet := make(map[string]bool)
	for _, tag := range tags {
		parts := strings.SplitN(tag, ":", 2)
		if len(parts) == 2 && parts[0] == targetKey {
			tagValue := parts[1]
			tagValuesSet[tagValue] = true
		}
	}
	
	// Convert set to slice
	tagValues := make([]string, 0, len(tagValuesSet))
	for value := range tagValuesSet {
		tagValues = append(tagValues, value)
	}
	return tagValues
}

// CompleteHandler handles POST /autocomplete/complete requests
// This endpoint receives a query, cursor position, and selected item,
// then returns the completed query with the new cursor position
func (d *Datasource) CompleteHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()

	// Parse request body
	var completeReq CompleteRequest
	if err := json.Unmarshal(req.Body, &completeReq); err != nil {
		logger.Error("Failed to parse complete request", "error", err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "invalid request body"}`),
		})
	}

	logger.Info("Complete request", "query", completeReq.Query, "cursor", completeReq.CursorPosition, "item", completeReq.SelectedItem, "kind", completeReq.ItemKind)

	// Determine where to insert based on item kind and cursor position
	newQuery := completeReq.Query
	newCursorPos := completeReq.CursorPosition
	selectedItem := completeReq.SelectedItem

	switch completeReq.ItemKind {
	case "metric":
		// Replace entire query with avg:metric{*}
		newQuery = fmt.Sprintf("avg:%s{*}", selectedItem)
		newCursorPos = len(newQuery)

	case "aggregator":
		// Replace aggregator at the beginning
		colonIdx := strings.Index(completeReq.Query, ":")
		if colonIdx > 0 {
			// Replace existing aggregator
			newQuery = selectedItem + ":" + completeReq.Query[colonIdx+1:]
		} else {
			// Add aggregator
			newQuery = selectedItem + ":" + completeReq.Query
		}
		newCursorPos = len(selectedItem) + 1

	case "grouping_tag":
		// Find "by {" section and insert tag
		byIdx := strings.Index(completeReq.Query, " by {")
		if byIdx == -1 {
			// No "by {" found, append it
			newQuery = completeReq.Query + " by {" + selectedItem + "}"
			newCursorPos = len(newQuery) - 1
		} else {
			// Find the opening brace position
			openBracePos := byIdx + len(" by {") - 1
			closeBracePos := strings.Index(completeReq.Query[openBracePos:], "}")
			
			if closeBracePos == -1 {
				// No closing brace, append tag and close
				newQuery = completeReq.Query + selectedItem + "}"
				newCursorPos = len(newQuery) - 1
			} else {
				// Insert tag inside braces
				closeBracePos += openBracePos
				groupingContent := completeReq.Query[openBracePos+1 : closeBracePos]
				
				// Calculate relative position within the braces
				relativePos := completeReq.CursorPosition - (openBracePos + 1)
				if relativePos < 0 {
					relativePos = 0
				}
				if relativePos > len(groupingContent) {
					relativePos = len(groupingContent)
				}
				
				logger.Info("Grouping tag insertion", 
					"groupingContent", groupingContent,
					"relativePos", relativePos,
					"cursorPos", completeReq.CursorPosition,
					"openBracePos", openBracePos)
				
				// Check if cursor is right after a comma or space
				needsComma := false
				if relativePos > 0 && relativePos <= len(groupingContent) {
					// Check character before cursor
					charBeforeCursor := groupingContent[relativePos-1]
					logger.Info("Character before cursor", "char", string(charBeforeCursor), "byte", charBeforeCursor)
					// Add comma only if previous char is not a comma/space and content is not empty
					if charBeforeCursor != ',' && charBeforeCursor != ' ' && strings.TrimSpace(groupingContent[:relativePos]) != "" {
						needsComma = true
					}
				}
				
				if needsComma {
					selectedItem = "," + selectedItem
				}
				
				logger.Info("Inserting tag", "needsComma", needsComma, "selectedItem", selectedItem)
				
				newGroupingContent := groupingContent[:relativePos] + selectedItem + groupingContent[relativePos:]
				newQuery = completeReq.Query[:openBracePos+1] + newGroupingContent + completeReq.Query[closeBracePos:]
				newCursorPos = openBracePos + 1 + relativePos + len(selectedItem)
			}
		}

	case "tag":
		// Find the filter section {tags} and insert tag:
		openBracePos := strings.LastIndex(completeReq.Query[:completeReq.CursorPosition+1], "{")
		if openBracePos == -1 {
			// No opening brace found, just insert at cursor
			newQuery = completeReq.Query[:completeReq.CursorPosition] + selectedItem + ":" + completeReq.Query[completeReq.CursorPosition:]
			newCursorPos = completeReq.CursorPosition + len(selectedItem) + 1
		} else {
			closeBracePos := strings.Index(completeReq.Query[openBracePos:], "}")
			if closeBracePos == -1 {
				closeBracePos = len(completeReq.Query)
			} else {
				closeBracePos += openBracePos
			}
			
			// Insert tag: at cursor position
			newQuery = completeReq.Query[:completeReq.CursorPosition] + selectedItem + ":" + completeReq.Query[completeReq.CursorPosition:]
			newCursorPos = completeReq.CursorPosition + len(selectedItem) + 1
		}

	case "filter_tag_key":
		// Find the filter section {tags} (first {...} after metric name) and insert tag key with colon
		openBracePos := strings.Index(completeReq.Query, "{")
		if openBracePos == -1 {
			// No opening brace found, just insert at cursor
			newQuery = completeReq.Query[:completeReq.CursorPosition] + selectedItem + ":" + completeReq.Query[completeReq.CursorPosition:]
			newCursorPos = completeReq.CursorPosition + len(selectedItem) + 1
		} else {
			closeBracePos := strings.Index(completeReq.Query[openBracePos:], "}")
			if closeBracePos == -1 {
				closeBracePos = len(completeReq.Query)
			} else {
				closeBracePos += openBracePos
			}
			
			// Calculate position within the filter section
			filterContent := completeReq.Query[openBracePos+1 : closeBracePos]
			relativePos := completeReq.CursorPosition - (openBracePos + 1)
			
			if relativePos < 0 {
				relativePos = 0
			}
			if relativePos > len(filterContent) {
				relativePos = len(filterContent)
			}
			
			// Find the start of the current token (backwards to comma or start)
			tokenStart := relativePos
			for tokenStart > 0 && filterContent[tokenStart-1] != ',' && filterContent[tokenStart-1] != ':' {
				tokenStart--
			}
			
			// Find the end of the current token (forwards to comma, colon, or end)
			tokenEnd := relativePos
			for tokenEnd < len(filterContent) && filterContent[tokenEnd] != ',' && filterContent[tokenEnd] != ':' {
				tokenEnd++
			}
			
			logger.Info("Filter tag key insertion",
				"filterContent", filterContent,
				"relativePos", relativePos,
				"cursorPos", completeReq.CursorPosition,
				"openBracePos", openBracePos,
				"tokenStart", tokenStart,
				"tokenEnd", tokenEnd,
				"selectedItem", selectedItem)
			
			// Replace the current token with the selected tag key
			// Always add colon since we're completing a tag key (not value)
			newFilterContent := filterContent[:tokenStart] + selectedItem + ":" + filterContent[tokenEnd:]
			newQuery = completeReq.Query[:openBracePos+1] + newFilterContent + completeReq.Query[closeBracePos:]
			newCursorPos = openBracePos + 1 + tokenStart + len(selectedItem) + 1 // Position after the colon
		}

	case "filter_tag_value":
		// Find the filter section {tags} (first {...} after metric name) and replace tag value
		openBracePos := strings.Index(completeReq.Query, "{")
		if openBracePos == -1 {
			// No opening brace found, just insert at cursor
			newQuery = completeReq.Query[:completeReq.CursorPosition] + selectedItem + completeReq.Query[completeReq.CursorPosition:]
			newCursorPos = completeReq.CursorPosition + len(selectedItem)
		} else {
			closeBracePos := strings.Index(completeReq.Query[openBracePos:], "}")
			if closeBracePos == -1 {
				closeBracePos = len(completeReq.Query)
			} else {
				closeBracePos += openBracePos
			}
			
			// Calculate position within the filter section
			filterContent := completeReq.Query[openBracePos+1 : closeBracePos]
			relativePos := completeReq.CursorPosition - (openBracePos + 1)
			
			if relativePos < 0 {
				relativePos = 0
			}
			if relativePos > len(filterContent) {
				relativePos = len(filterContent)
			}
			
			logger.Info("Filter tag value insertion",
				"filterContent", filterContent,
				"relativePos", relativePos,
				"cursorPos", completeReq.CursorPosition,
				"openBracePos", openBracePos)
			
			// Find the current tag pair by looking backwards for comma or start
			pairStart := relativePos
			for pairStart > 0 && filterContent[pairStart-1] != ',' {
				pairStart--
			}
			
			// Find the end of the current pair (stop at comma or end)
			pairEnd := relativePos
			for pairEnd < len(filterContent) && filterContent[pairEnd] != ',' {
				pairEnd++
			}
			
			// Extract the current pair
			currentPair := filterContent[pairStart:pairEnd]
			
			// Find the colon in the current pair
			colonIndex := strings.Index(currentPair, ":")
			if colonIndex == -1 {
				// No colon found, just insert at cursor
				newQuery = completeReq.Query[:completeReq.CursorPosition] + selectedItem + completeReq.Query[completeReq.CursorPosition:]
				newCursorPos = completeReq.CursorPosition + len(selectedItem)
			} else {
				// Replace the value part (after the colon)
				tagKey := currentPair[:colonIndex]
				newPair := tagKey + ":" + selectedItem
				
				// Replace the current pair with the new pair
				newFilterContent := filterContent[:pairStart] + newPair + filterContent[pairEnd:]
				newQuery = completeReq.Query[:openBracePos+1] + newFilterContent + completeReq.Query[closeBracePos:]
				newCursorPos = openBracePos + 1 + pairStart + len(newPair) // Position after the value
			}
		}

	default:
		// Default: insert at cursor position
		newQuery = completeReq.Query[:completeReq.CursorPosition] + selectedItem + completeReq.Query[completeReq.CursorPosition:]
		newCursorPos = completeReq.CursorPosition + len(selectedItem)
	}

	logger.Info("Complete response", "newQuery", newQuery, "newCursor", newCursorPos)

	// Return response
	response := CompleteResponse{
		NewQuery:          newQuery,
		NewCursorPosition: newCursorPos,
	}

	respData, _ := json.Marshal(response)
	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// VariableMetricsHandler handles POST /resources/metrics requests for variable queries
func (d *Datasource) VariableMetricsHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	traceID := generateTraceID()
	startTime := time.Now()
	ttl := 5 * time.Minute // 5-minute cache TTL as specified in requirements

	// Log request start
	logVariableRequest(logger, traceID, "/resources/metrics", req.Method, string(req.Body))

	// Parse request body with enhanced validation
	var metricsReq MetricsRequest
	if err := validateVariableRequest(logger, traceID, req.Body, &metricsReq); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/metrics", 400, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "Invalid request format"}`),
		})
	}

	// Build cache key based on filters
	cacheKey := fmt.Sprintf("var-metrics:%s:%s", metricsReq.Namespace, metricsReq.SearchPattern)

	// Check cache first
	if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil {
		duration := time.Since(startTime)
		logger.Debug("Returning cached variable metrics", 
			"traceID", traceID,
			"namespace", metricsReq.Namespace, 
			"searchPattern", metricsReq.SearchPattern,
			"cacheHit", true,
			"resultCount", len(cached.Data))
		logVariableResponse(logger, traceID, "/resources/metrics", 200, duration, len(cached.Data), nil)
		
		response := VariableResponse{Values: cached.Data}
		respData, _ := json.Marshal(response)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Validate API credentials with enhanced logging
	if err := validateAPICredentials(logger, traceID, d.SecureJSONData); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/metrics", 401, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Setup Datadog API client
	metricsApi, ddCtx, err := d.setupDatadogClient(ctx)
	if err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/metrics", 500, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 500,
			Body:   []byte(`{"error": "Failed to setup Datadog client"}`),
		})
	}

	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ddCtx, 30*time.Second)
	defer cancel()

	// Fetch metrics from Datadog - ListTagConfigurations returns available metrics
	logger.Debug("Fetching metrics from Datadog API", 
		"traceID", traceID,
		"namespace", metricsReq.Namespace, 
		"searchPattern", metricsReq.SearchPattern,
		"timeout", "30s")
		
	resp, _, err := metricsApi.ListTagConfigurations(fetchCtx)
	if err != nil {
		duration := time.Since(startTime)
		status, body := handleVariableAPIError(logger, traceID, err, "ListTagConfigurations")
		logVariableResponse(logger, traceID, "/resources/metrics", status, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: status,
			Body:   body,
		})
	}

	// Extract metric names from response
	data := resp.GetData()
	if data == nil {
		response := VariableResponse{Values: []string{}}
		respData, _ := json.Marshal(response)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	metrics := []string{}
	for _, config := range data {
		metricName := extractMetricName(config)
		if metricName != "" {
			// Apply namespace filter if specified (namespace uses prefix matching, not regex)
			if metricsReq.Namespace != "" && metricsReq.Namespace != "*" && !strings.HasPrefix(metricName, metricsReq.Namespace) {
				continue
			}

			// Apply search pattern filter with regex support
			if metricsReq.SearchPattern != "" && metricsReq.SearchPattern != "*" && !matchesFilter(metricName, metricsReq.SearchPattern) {
				continue
			}

			metrics = append(metrics, metricName)
		}
	}

	// Cache the result
	d.SetCachedEntry(cacheKey, metrics)

	// Log successful completion
	duration := time.Since(startTime)
	logger.Debug("Successfully fetched variable metrics",
		"traceID", traceID,
		"namespace", metricsReq.Namespace,
		"searchPattern", metricsReq.SearchPattern,
		"resultCount", len(metrics),
		"cached", true)
	logVariableResponse(logger, traceID, "/resources/metrics", 200, duration, len(metrics), nil)

	// Return metrics as VariableResponse
	response := VariableResponse{Values: metrics}
	respData, _ := json.Marshal(response)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// VariableTagKeysHandler handles POST /resources/tag-keys requests for variable queries
func (d *Datasource) VariableTagKeysHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	traceID := generateTraceID()
	startTime := time.Now()
	ttl := 5 * time.Minute // 5-minute cache TTL as specified in requirements

	// Log request start
	logVariableRequest(logger, traceID, "/resources/tag-keys", req.Method, string(req.Body))

	// Parse request body with enhanced validation
	var tagKeysReq TagKeysRequest
	if err := validateVariableRequest(logger, traceID, req.Body, &tagKeysReq); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/tag-keys", 400, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "Invalid request format"}`),
		})
	}

	// Build cache key based on metric name and filter
	cacheKey := fmt.Sprintf("var-tag-keys:%s:%s", tagKeysReq.MetricName, tagKeysReq.Filter)

	// Check cache first
	if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil {
		duration := time.Since(startTime)
		logger.Debug("Returning cached variable tag keys", 
			"traceID", traceID,
			"metricName", tagKeysReq.MetricName,
			"cacheHit", true,
			"resultCount", len(cached.Data))
		logVariableResponse(logger, traceID, "/resources/tag-keys", 200, duration, len(cached.Data), nil)
		
		response := VariableResponse{Values: cached.Data}
		respData, _ := json.Marshal(response)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Validate API credentials
	if err := validateAPICredentials(logger, traceID, d.SecureJSONData); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/tag-keys", 401, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Setup Datadog API client
	metricsApi, ddCtx, err := d.setupDatadogClient(ctx)
	if err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/tag-keys", 500, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 500,
			Body:   []byte(`{"error": "Failed to setup Datadog client"}`),
		})
	}

	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ddCtx, 30*time.Second)
	defer cancel()

	var tagKeys []string

	// Check if metric name is a regex pattern
	isRegexPattern := len(tagKeysReq.MetricName) >= 2 && 
		tagKeysReq.MetricName[0] == '/' && 
		tagKeysReq.MetricName[len(tagKeysReq.MetricName)-1] == '/'

	if tagKeysReq.MetricName != "" && tagKeysReq.MetricName != "*" && !isRegexPattern {
		// Fetch tags for specific metric using ListTagsByMetricName
		logger.Debug("Fetching tag keys for specific metric", 
			"traceID", traceID,
			"metricName", tagKeysReq.MetricName,
			"timeout", "30s")

		resp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, tagKeysReq.MetricName)
		if err != nil {
			duration := time.Since(startTime)
			status, body := handleVariableAPIError(logger, traceID, err, "ListTagsByMetricName")
			logVariableResponse(logger, traceID, "/resources/tag-keys", status, duration, 0, err)
			return sender.Send(&backend.CallResourceResponse{
				Status: status,
				Body:   body,
			})
		}

		// Extract tag keys from response
		data := resp.GetData()
		if data.Id != nil {
			attributes := data.GetAttributes()
			allTags := attributes.GetTags()
			tagKeys = extractTagKeysFromTags(allTags)
		}
	} else if isRegexPattern {
		// Handle regex pattern for metric name - need to get all metrics first, then filter
		logger.Debug("Fetching tag keys for regex metric pattern", 
			"traceID", traceID,
			"metricPattern", tagKeysReq.MetricName,
			"timeout", "30s")

		// First, get all available metrics
		metricsResp, _, err := metricsApi.ListTagConfigurations(fetchCtx)
		if err != nil {
			logger.Error("Failed to fetch metrics for regex filtering", "error", err, "traceID", traceID)
			// Return empty array instead of fake data
			tagKeys = []string{}
		} else {
			// Extract metrics that match the regex pattern
			tagKeysSet := make(map[string]bool)
			data := metricsResp.GetData()
			matchingMetrics := []string{}

			if data != nil {
				for _, config := range data {
					metricName := extractMetricName(config)
					if metricName != "" && matchesFilter(metricName, tagKeysReq.MetricName) {
						matchingMetrics = append(matchingMetrics, metricName)
					}
				}
			}

			logger.Debug("Found matching metrics for regex pattern", 
				"traceID", traceID,
				"pattern", tagKeysReq.MetricName,
				"matchingCount", len(matchingMetrics))

			// Limit to first 10 metrics to avoid too many API calls
			maxMetrics := 10
			if len(matchingMetrics) > maxMetrics {
				matchingMetrics = matchingMetrics[:maxMetrics]
				logger.Debug("Limited matching metrics to avoid too many API calls", 
					"traceID", traceID,
					"limitedCount", maxMetrics)
			}

			// Get tag keys for each matching metric
			for _, metric := range matchingMetrics {
				resp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, metric)
				if err != nil {
					logger.Debug("Failed to fetch tags for metric", "metric", metric, "error", err, "traceID", traceID)
					continue
				}

				data := resp.GetData()
				if data.Id != nil {
					attributes := data.GetAttributes()
					allTags := attributes.GetTags()
					metricTagKeys := extractTagKeysFromTags(allTags)
					
					// Add to set
					for _, key := range metricTagKeys {
						tagKeysSet[key] = true
					}
				}
			}

			// Convert set to slice
			for key := range tagKeysSet {
				tagKeys = append(tagKeys, key)
			}
		}
	} else {
		// Use the all-tags endpoint to get comprehensive tag keys from organization
		logger.Debug("Fetching comprehensive tag keys using all-tags endpoint", 
			"traceID", traceID,
			"timeout", "30s")

		// Create a request for all tag keys
		allTagsReq := AllTagsRequest{
			QueryType: "tag_keys",
		}
		reqBody, _ := json.Marshal(allTagsReq)

		// Create a new request for the all-tags handler
		allTagsRequest := &backend.CallResourceRequest{
			Method: "POST",
			Path:   "resources/all-tags",
			Body:   reqBody,
		}

		// Create a response sender that captures the response
		var allTagsResponse *backend.CallResourceResponse
		allTagsSender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			allTagsResponse = res
			return nil
		})

		// Call the all-tags handler
		if err := d.VariableAllTagsHandler(ctx, allTagsRequest, allTagsSender); err != nil {
			logger.Error("Failed to fetch comprehensive tag keys", "error", err, "traceID", traceID)
			// Return empty array instead of fake data
			tagKeys = []string{}
		} else if allTagsResponse != nil && allTagsResponse.Status == 200 {
			// Parse the response from all-tags handler
			var allTagsResp VariableResponse
			if err := json.Unmarshal(allTagsResponse.Body, &allTagsResp); err == nil {
				tagKeys = allTagsResp.Values
			} else {
				// Return empty array instead of fake data
				tagKeys = []string{}
			}
		} else {
			// Return empty array if all-tags handler failed
			tagKeys = []string{}
		}
	}

	// Apply filter to tag keys if specified
	if tagKeysReq.Filter != "" && tagKeysReq.Filter != "*" {
		filteredTagKeys := []string{}
		for _, tagKey := range tagKeys {
			if matchesFilter(tagKey, tagKeysReq.Filter) {
				filteredTagKeys = append(filteredTagKeys, tagKey)
			}
		}
		tagKeys = filteredTagKeys
		logger.Debug("Applied filter to tag keys", 
			"traceID", traceID,
			"filter", tagKeysReq.Filter,
			"originalCount", len(tagKeys),
			"filteredCount", len(filteredTagKeys))
	}

	// Cache the result
	d.SetCachedEntry(cacheKey, tagKeys)

	// Log successful completion
	duration := time.Since(startTime)
	logger.Debug("Successfully fetched variable tag keys",
		"traceID", traceID,
		"metricName", tagKeysReq.MetricName,
		"filter", tagKeysReq.Filter,
		"resultCount", len(tagKeys),
		"cached", true)
	logVariableResponse(logger, traceID, "/resources/tag-keys", 200, duration, len(tagKeys), nil)

	// Return tag keys as VariableResponse
	response := VariableResponse{Values: tagKeys}
	respData, _ := json.Marshal(response)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// VariableTagValuesHandler handles POST /resources/tag-values requests for variable queries
func (d *Datasource) VariableTagValuesHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	traceID := generateTraceID()
	startTime := time.Now()
	ttl := 5 * time.Minute // 5-minute cache TTL as specified in requirements

	// Log request start
	logVariableRequest(logger, traceID, "/resources/tag-values", req.Method, string(req.Body))

	// Parse request body with enhanced validation
	var tagValuesReq TagValuesRequest
	if err := validateVariableRequest(logger, traceID, req.Body, &tagValuesReq); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/tag-values", 400, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "Invalid request format"}`),
		})
	}

	// Build cache key based on metric name, tag key, and filter
	cacheKey := fmt.Sprintf("var-tag-values:%s:%s:%s", tagValuesReq.MetricName, tagValuesReq.TagKey, tagValuesReq.Filter)

	// Handle case where metric name is "*" - fetch real data from all metrics
	if tagValuesReq.MetricName == "*" {
		logger.Debug("Fetching real tag values from all metrics for wildcard", 
			"traceID", traceID,
			"tagKey", tagValuesReq.TagKey,
			"timeout", "60s")

		// Check cache first for wildcard queries
		if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil {
			duration := time.Since(startTime)
			logger.Debug("Returning cached wildcard tag values", 
				"traceID", traceID,
				"tagKey", tagValuesReq.TagKey,
				"cacheHit", true,
				"resultCount", len(cached.Data))
			logVariableResponse(logger, traceID, "/resources/tag-values", 200, duration, len(cached.Data), nil)
			
			response := VariableResponse{Values: cached.Data}
			respData, _ := json.Marshal(response)
			return sender.Send(&backend.CallResourceResponse{
				Status: 200,
				Body:   respData,
			})
		}

		// Validate API credentials
		if err := validateAPICredentials(logger, traceID, d.SecureJSONData); err != nil {
			duration := time.Since(startTime)
			logVariableResponse(logger, traceID, "/resources/tag-values", 401, duration, 0, err)
			return sender.Send(&backend.CallResourceResponse{
				Status: 401,
				Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
			})
		}

		// Acquire semaphore slot (max 5 concurrent requests)
		d.concurrencyLimit <- struct{}{}
		defer func() { <-d.concurrencyLimit }()

		// Setup Datadog API client
		metricsApi, ddCtx, err := d.setupDatadogClient(ctx)
		if err != nil {
			duration := time.Since(startTime)
			logVariableResponse(logger, traceID, "/resources/tag-values", 500, duration, 0, err)
			return sender.Send(&backend.CallResourceResponse{
				Status: 500,
				Body:   []byte(`{"error": "Failed to setup Datadog client"}`),
			})
		}

		// Create context with longer timeout for comprehensive queries
		fetchCtx, cancel := context.WithTimeout(ddCtx, 60*time.Second)
		defer cancel()

		// Fetch all available metrics first
		logger.Debug("Fetching all metrics to aggregate tag values", 
			"traceID", traceID,
			"tagKey", tagValuesReq.TagKey)

		tagValuesSet := make(map[string]bool)
		var cursor *string = nil
		pageCount := 0
		maxPages := 5 // Limit pages to avoid timeout
		maxMetricsPerPage := 20 // Limit metrics processed per page

		for pageCount < maxPages {
			pageCount++
			
			// Create optional parameters for pagination
			optionalParams := datadogV2.NewListTagConfigurationsOptionalParameters()
			if cursor != nil {
				optionalParams = optionalParams.WithPageCursor(*cursor)
			}
			
			// Fetch metrics page
			resp, _, err := metricsApi.ListTagConfigurations(fetchCtx, *optionalParams)
			if err != nil {
				logger.Error("Failed to fetch metrics page for wildcard tag values", 
					"error", err, "page", pageCount, "traceID", traceID)
				break
			}

			// Process metrics from this page
			data := resp.GetData()
			if data != nil {
				processedCount := 0
				for _, config := range data {
					if processedCount >= maxMetricsPerPage {
						break // Limit processing to avoid timeout
					}

					metricName := extractMetricName(config)
					if metricName != "" {
						// Fetch tags for this metric
						metricResp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, metricName)
						if err != nil {
							logger.Debug("Failed to fetch tags for metric", 
								"metric", metricName, "error", err, "traceID", traceID)
							continue
						}

						// Extract tag values for the specific tag key
						metricData := metricResp.GetData()
						if metricData.Id != nil {
							attributes := metricData.GetAttributes()
							allTags := attributes.GetTags()
							metricTagValues := extractTagValuesForKey(allTags, tagValuesReq.TagKey)
							
							// Add to set
							for _, value := range metricTagValues {
								tagValuesSet[value] = true
							}
						}
						processedCount++
					}
				}
				
				logger.Debug("Processed metrics from page", 
					"page", pageCount, 
					"processedCount", processedCount,
					"uniqueTagValues", len(tagValuesSet),
					"traceID", traceID)
			}

			// Check for next page
			meta := resp.GetMeta()
			pagination := meta.GetPagination()
			if nextCursor := pagination.GetNextCursor(); nextCursor != "" {
				cursor = &nextCursor
				logger.Debug("Found next page", "cursor", nextCursor, "page", pageCount, "traceID", traceID)
			} else {
				logger.Debug("No more pages", "totalPages", pageCount, "traceID", traceID)
				break
			}
		}

		// Convert set to sorted slice
		var tagValues []string
		for value := range tagValuesSet {
			tagValues = append(tagValues, value)
		}

		// If no real tag values found, return empty array
		if len(tagValues) == 0 {
			logger.Debug("No real tag values found for wildcard query", 
				"traceID", traceID,
				"tagKey", tagValuesReq.TagKey)
			tagValues = []string{} // Return empty array instead of fake data
		}

		// Cache the result
		d.SetCachedEntry(cacheKey, tagValues)

		// Log successful completion
		duration := time.Since(startTime)
		logger.Debug("Successfully fetched real tag values for wildcard metric",
			"traceID", traceID,
			"tagKey", tagValuesReq.TagKey,
			"resultCount", len(tagValues),
			"pagesProcessed", pageCount)
		logVariableResponse(logger, traceID, "/resources/tag-values", 200, duration, len(tagValues), nil)

		// Return tag values as VariableResponse
		response := VariableResponse{Values: tagValues}
		respData, _ := json.Marshal(response)

		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Handle case where tag key is empty or "*" - use comprehensive endpoint
	if tagValuesReq.TagKey == "" || tagValuesReq.TagKey == "*" {
		// Use the all-tags endpoint to get comprehensive tag values from organization
		logger.Debug("Fetching comprehensive tag values using all-tags endpoint", 
			"traceID", traceID,
			"metricName", tagValuesReq.MetricName,
			"timeout", "30s")

		// Create a request for all tag values
		allTagsReq := AllTagsRequest{
			QueryType: "tag_values",
			TagKey:    tagValuesReq.TagKey, // Pass through the tag key (might be "*")
		}
		reqBody, _ := json.Marshal(allTagsReq)

		// Create a new request for the all-tags handler
		allTagsRequest := &backend.CallResourceRequest{
			Method: "POST",
			Path:   "resources/all-tags",
			Body:   reqBody,
		}

		// Create a response sender that captures the response
		var allTagsResponse *backend.CallResourceResponse
		allTagsSender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			allTagsResponse = res
			return nil
		})

		// Call the all-tags handler
		if err := d.VariableAllTagsHandler(ctx, allTagsRequest, allTagsSender); err != nil {
			logger.Error("Failed to fetch comprehensive tag values", "error", err, "traceID", traceID)
			// Return empty array instead of fake data
			tagValues := []string{}
			d.SetCachedEntry(cacheKey, tagValues)
			
			response := VariableResponse{Values: tagValues}
			respData, _ := json.Marshal(response)
			return sender.Send(&backend.CallResourceResponse{
				Status: 200,
				Body:   respData,
			})
		} else if allTagsResponse != nil && allTagsResponse.Status == 200 {
			// Parse and return the response from all-tags handler
			var allTagsResp VariableResponse
			if err := json.Unmarshal(allTagsResponse.Body, &allTagsResp); err == nil {
				// Cache and return the comprehensive results
				d.SetCachedEntry(cacheKey, allTagsResp.Values)
				
				duration := time.Since(startTime)
				logVariableResponse(logger, traceID, "/resources/tag-values", 200, duration, len(allTagsResp.Values), nil)
				
				respData, _ := json.Marshal(allTagsResp)
				return sender.Send(&backend.CallResourceResponse{
					Status: 200,
					Body:   respData,
				})
			}
		}
		
		// Return empty array if all-tags failed
		tagValues := []string{}
		d.SetCachedEntry(cacheKey, tagValues)
		
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/tag-values", 200, duration, len(tagValues), nil)
		
		response := VariableResponse{Values: tagValues}
		respData, _ := json.Marshal(response)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Check cache first
	if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil {
		duration := time.Since(startTime)
		logger.Debug("Returning cached variable tag values", 
			"traceID", traceID,
			"metricName", tagValuesReq.MetricName, 
			"tagKey", tagValuesReq.TagKey,
			"cacheHit", true,
			"resultCount", len(cached.Data))
		logVariableResponse(logger, traceID, "/resources/tag-values", 200, duration, len(cached.Data), nil)
		
		response := VariableResponse{Values: cached.Data}
		respData, _ := json.Marshal(response)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Validate API credentials with enhanced logging
	if err := validateAPICredentials(logger, traceID, d.SecureJSONData); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/tag-values", 401, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	apiKey := d.SecureJSONData["apiKey"]
	appKey := d.SecureJSONData["appKey"]

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Get site configuration
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com"
	}

	// Initialize Datadog API client with credentials and site
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

	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ddCtx, 30*time.Second)
	defer cancel()

	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	metricsApi := datadogV2.NewMetricsApi(client)

	var tagValues []string

	// Check if metric name is a regex pattern
	isRegexPattern := len(tagValuesReq.MetricName) >= 2 && 
		tagValuesReq.MetricName[0] == '/' && 
		tagValuesReq.MetricName[len(tagValuesReq.MetricName)-1] == '/'

	if tagValuesReq.MetricName != "" && tagValuesReq.MetricName != "*" && !isRegexPattern {
		// Fetch tag values for specific metric and tag key
		logger.Debug("Fetching tag values for specific metric and tag key", 
			"traceID", traceID,
			"metricName", tagValuesReq.MetricName, 
			"tagKey", tagValuesReq.TagKey,
			"timeout", "30s")

		resp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, tagValuesReq.MetricName)
		if err != nil {
			duration := time.Since(startTime)
			status, body := handleVariableAPIError(logger, traceID, err, "ListTagsByMetricName")
			logVariableResponse(logger, traceID, "/resources/tag-values", status, duration, 0, err)
			return sender.Send(&backend.CallResourceResponse{
				Status: status,
				Body:   body,
			})
		}

		// Extract tag values for the specific tag key from response
		tagValuesSet := make(map[string]bool)
		data := resp.GetData()

		if data.Id != nil {
			attributes := data.GetAttributes()
			allTags := attributes.GetTags()

			// Tags are in format "key:value", extract values for the specific key
			for _, tag := range allTags {
				parts := strings.SplitN(tag, ":", 2)
				if len(parts) == 2 && parts[0] == tagValuesReq.TagKey {
					tagValue := parts[1]
					tagValuesSet[tagValue] = true
				}
			}
		}

		// Convert set to slice
		for value := range tagValuesSet {
			tagValues = append(tagValues, value)
		}
	} else if isRegexPattern {
		// Handle regex pattern for metric name - need to get all metrics first, then filter
		logger.Debug("Fetching tag values for regex metric pattern", 
			"traceID", traceID,
			"metricPattern", tagValuesReq.MetricName,
			"tagKey", tagValuesReq.TagKey,
			"timeout", "30s")

		// First, get all available metrics
		metricsResp, _, err := metricsApi.ListTagConfigurations(fetchCtx)
		if err != nil {
			logger.Error("Failed to fetch metrics for regex filtering", "error", err, "traceID", traceID)
			// Return empty array instead of fake data
			tagValues = []string{}
		} else {
			// Extract metrics that match the regex pattern
			tagValuesSet := make(map[string]bool)
			data := metricsResp.GetData()
			matchingMetrics := []string{}

			if data != nil {
				for _, config := range data {
					var metricName string
					if config.Metric != nil {
						metricName = config.Metric.GetId()
					} else if config.MetricTagConfiguration != nil {
						metricName = config.MetricTagConfiguration.GetId()
					}

					if metricName != "" && matchesFilter(metricName, tagValuesReq.MetricName) {
						matchingMetrics = append(matchingMetrics, metricName)
					}
				}
			}

			logger.Debug("Found matching metrics for regex pattern", 
				"traceID", traceID,
				"pattern", tagValuesReq.MetricName,
				"matchingCount", len(matchingMetrics))

			// Now get tag values for each matching metric (limit to first 10 to avoid too many API calls)
			maxMetrics := 10
			if len(matchingMetrics) > maxMetrics {
				matchingMetrics = matchingMetrics[:maxMetrics]
				logger.Debug("Limited matching metrics to avoid too many API calls", 
					"traceID", traceID,
					"limitedCount", maxMetrics)
			}

			for _, metric := range matchingMetrics {
				resp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, metric)
				if err != nil {
					logger.Debug("Failed to fetch tags for metric", "metric", metric, "error", err, "traceID", traceID)
					continue
				}

				data := resp.GetData()
				if data.Id != nil {
					attributes := data.GetAttributes()
					allTags := attributes.GetTags()

					// Tags are in format "key:value", extract values for the specific key
					for _, tag := range allTags {
						parts := strings.SplitN(tag, ":", 2)
						if len(parts) == 2 && parts[0] == tagValuesReq.TagKey {
							tagValue := parts[1]
							tagValuesSet[tagValue] = true
						}
					}
				}
			}

			// Convert set to slice
			for value := range tagValuesSet {
				tagValues = append(tagValues, value)
			}

			// If no tag values found from matching metrics, return empty array
			if len(tagValues) == 0 {
				tagValues = []string{} // Return empty array instead of fake data
			}
		}
	} else {
		// For unfiltered queries, we would need a different API call
		// For now, return empty array as we need a specific metric to get meaningful tag values
		tagValues = []string{}
	}

	// Apply filter to tag values if specified
	if tagValuesReq.Filter != "" && tagValuesReq.Filter != "*" {
		filteredTagValues := []string{}
		for _, tagValue := range tagValues {
			if matchesFilter(tagValue, tagValuesReq.Filter) {
				filteredTagValues = append(filteredTagValues, tagValue)
			}
		}
		tagValues = filteredTagValues
		logger.Debug("Applied filter to tag values", 
			"traceID", traceID,
			"filter", tagValuesReq.Filter,
			"originalCount", len(tagValues),
			"filteredCount", len(filteredTagValues))
	}

	// Cache the result
	d.SetCachedEntry(cacheKey, tagValues)

	// Log successful completion
	duration := time.Since(startTime)
	logger.Debug("Successfully fetched variable tag values",
		"traceID", traceID,
		"metricName", tagValuesReq.MetricName,
		"tagKey", tagValuesReq.TagKey,
		"filter", tagValuesReq.Filter,
		"resultCount", len(tagValues),
		"cached", true)
	logVariableResponse(logger, traceID, "/resources/tag-values", 200, duration, len(tagValues), nil)

	// Return tag values as VariableResponse
	response := VariableResponse{Values: tagValues}
	respData, _ := json.Marshal(response)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}
// AllTagsRequest represents the request for /resources/all-tags endpoint
type AllTagsRequest struct {
	QueryType string `json:"queryType"` // "tag_keys" or "tag_values"
	TagKey    string `json:"tagKey,omitempty"` // For tag_values queries
}

// VariableAllTagsHandler handles POST /resources/all-tags requests for variable queries
// This uses Datadog's v2/metrics API with pagination to get comprehensive tag data
func (d *Datasource) VariableAllTagsHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	traceID := generateTraceID()
	startTime := time.Now()
	ttl := 10 * time.Minute // 10-minute cache TTL for organization-wide tags

	// Log request start
	logVariableRequest(logger, traceID, "/resources/all-tags", req.Method, string(req.Body))

	// Parse request body with enhanced validation
	var allTagsReq AllTagsRequest
	if err := validateVariableRequest(logger, traceID, req.Body, &allTagsReq); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/all-tags", 400, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 400,
			Body:   []byte(`{"error": "Invalid request format"}`),
		})
	}

	// Build cache key based on query type and tag key
	cacheKey := fmt.Sprintf("var-all-tags:%s:%s", allTagsReq.QueryType, allTagsReq.TagKey)

	// Check cache first
	if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil {
		duration := time.Since(startTime)
		logger.Debug("Returning cached comprehensive tags", 
			"traceID", traceID,
			"queryType", allTagsReq.QueryType,
			"tagKey", allTagsReq.TagKey,
			"cacheHit", true,
			"resultCount", len(cached.Data))
		logVariableResponse(logger, traceID, "/resources/all-tags", 200, duration, len(cached.Data), nil)
		
		response := VariableResponse{Values: cached.Data}
		respData, _ := json.Marshal(response)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Validate API credentials with enhanced logging
	if err := validateAPICredentials(logger, traceID, d.SecureJSONData); err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/all-tags", 401, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 401,
			Body:   []byte(`{"error": "Invalid Datadog API credentials"}`),
		})
	}

	// Acquire semaphore slot (max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// Setup Datadog API client
	metricsApi, ddCtx, err := d.setupDatadogClient(ctx)
	if err != nil {
		duration := time.Since(startTime)
		logVariableResponse(logger, traceID, "/resources/all-tags", 500, duration, 0, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: 500,
			Body:   []byte(`{"error": "Failed to setup Datadog client"}`),
		})
	}

	// Create context with timeout (longer for paginated requests)
	fetchCtx, cancel := context.WithTimeout(ddCtx, 60*time.Second)
	defer cancel()

	var result []string

	// Process the request based on query type
	if allTagsReq.QueryType == "tag_keys" {
		// Fetch all available metrics to get their tag keys
		logger.Debug("Fetching all available metrics to extract tag keys", 
			"traceID", traceID,
			"timeout", "60s")

		tagKeysSet := make(map[string]bool)
		var cursor *string = nil
		pageCount := 0
		maxPages := 5 // Limit to prevent too many API calls
		metricsProcessed := 0
		maxMetricsToProcess := 50 // Limit metrics to process for performance

		// First, get available metrics using ListTagConfigurations (which gives us metrics)
		for pageCount < maxPages && metricsProcessed < maxMetricsToProcess {
			pageCount++
			
			// Create optional parameters for pagination
			optionalParams := datadogV2.NewListTagConfigurationsOptionalParameters()
			if cursor != nil {
				optionalParams = optionalParams.WithPageCursor(*cursor)
			}
			
			// Fetch metrics page
			resp, _, err := metricsApi.ListTagConfigurations(fetchCtx, *optionalParams)
			if err != nil {
				logger.Error("Failed to fetch metrics page", "error", err, "page", pageCount, "traceID", traceID)
				break
			}

			// Process metrics from this page
			data := resp.GetData()
			if data != nil {
				
				for _, config := range data {
					if metricsProcessed >= maxMetricsToProcess {
						break
					}
					
					metricName := extractMetricName(config)
					
					if metricName != "" {
						metricsProcessed++
						
						// Fetch tags for this specific metric
						tagsResp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, metricName)
						if err != nil {
							logger.Debug("Failed to fetch tags for metric", "metric", metricName, "error", err, "traceID", traceID)
							continue
						}

						// Extract tag keys from the tags
						tagsData := tagsResp.GetData()
						if tagsData.Id != nil {
							attributes := tagsData.GetAttributes()
							allTags := attributes.GetTags()
							metricTagKeys := extractTagKeysFromTags(allTags)
							
							// Add to set
							for _, key := range metricTagKeys {
								tagKeysSet[key] = true
							}
						}
					}
				}
			}

			// Check for next page
			meta := resp.GetMeta()
			pagination := meta.GetPagination()
			if nextCursor := pagination.GetNextCursor(); nextCursor != "" && metricsProcessed < maxMetricsToProcess {
				cursor = &nextCursor
				logger.Debug("Found next page", "cursor", nextCursor, "page", pageCount, "metricsProcessed", metricsProcessed, "traceID", traceID)
			} else {
				logger.Debug("No more pages or reached metric limit", "totalPages", pageCount, "metricsProcessed", metricsProcessed, "traceID", traceID)
				break
			}
		}

		// Convert set to slice
		for key := range tagKeysSet {
			result = append(result, key)
		}

		logger.Debug("Completed tag keys collection from real metrics", 
			"traceID", traceID,
			"totalPages", pageCount,
			"metricsProcessed", metricsProcessed,
			"uniqueTagKeys", len(result))

	} else if allTagsReq.QueryType == "tag_values" {
		// For tag_values queries, we should fetch real data from the organization
		// This handler is currently not implemented to fetch real data
		// Return empty array instead of fake hardcoded values
		logger.Debug("VariableAllTagsHandler tag_values query - returning empty array", 
			"traceID", traceID,
			"tagKey", allTagsReq.TagKey)
		result = []string{}
	}

	// Cache the result
	d.SetCachedEntry(cacheKey, result)

	// Log successful completion
	duration := time.Since(startTime)
	logger.Debug("Successfully provided comprehensive tags",
		"traceID", traceID,
		"queryType", allTagsReq.QueryType,
		"tagKey", allTagsReq.TagKey,
		"resultCount", len(result),
		"cached", true)
	logVariableResponse(logger, traceID, "/resources/all-tags", 200, duration, len(result), nil)

	// Return results as VariableResponse
	response := VariableResponse{Values: result}
	respData, _ := json.Marshal(response)

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// LogsServicesHandler handles GET /autocomplete/logs/services requests
// Reuses existing concurrency limiting and timeout patterns from metrics implementation
func (d *Datasource) LogsServicesHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	traceID := generateTraceID()
	startTime := time.Now()

	logger.Info("LogsServicesHandler called", "traceID", traceID, "path", req.Path)

	// Reuse existing timeout configuration (2 seconds for autocomplete)
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	// Acquire semaphore slot (reusing existing concurrency limiting - max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// TODO: Get API credentials from secure JSON data when implementing actual Datadog Logs API calls
	// For now, we're using placeholder data so credentials are not needed
	
	// Get Datadog site configuration (reusing existing pattern)
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	// TODO: Implement actual Datadog Logs API call to get services
	// For now, return a placeholder list of common services
	// The actual implementation would call Datadog's Logs API to get unique service values
	// from recent log data, similar to how MetricsHandler gets metric names
	
	services := []string{
		"api-gateway",
		"auth-service", 
		"cache-service",
		"database",
		"frontend",
		"load-balancer",
		"monitoring",
		"payment-service",
		"user-service",
		"web-app",
	}

	duration := time.Since(startTime)
	logger.Info("LogsServicesHandler completed",
		"traceID", traceID,
		"duration", duration,
		"serviceCount", len(services),
		"site", site)

	// Log the response for debugging (reusing existing logging pattern)
	logVariableResponse(logger, traceID, "/autocomplete/logs/services", 200, duration, len(services), nil)

	// Return services as JSON array (same format as metrics autocomplete)
	respData, err := json.Marshal(services)
	if err != nil {
		logger.Error("failed to marshal services response", "error", err, "traceID", traceID)
		return sender.Send(&backend.CallResourceResponse{
			Status: 500,
			Body:   []byte(`{"error": "failed to marshal response"}`),
		})
	}

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}

// LogsSourcesHandler handles GET /autocomplete/logs/sources requests  
// Reuses existing concurrency limiting and timeout patterns from metrics implementation
func (d *Datasource) LogsSourcesHandler(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()
	traceID := generateTraceID()
	startTime := time.Now()

	logger.Info("LogsSourcesHandler called", "traceID", traceID, "path", req.Path)

	// Reuse existing timeout configuration (2 seconds for autocomplete)
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	// Acquire semaphore slot (reusing existing concurrency limiting - max 5 concurrent requests)
	d.concurrencyLimit <- struct{}{}
	defer func() { <-d.concurrencyLimit }()

	// TODO: Get API credentials from secure JSON data when implementing actual Datadog Logs API calls
	// For now, we're using placeholder data so credentials are not needed

	// Get Datadog site configuration (reusing existing pattern)
	site := d.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	// TODO: Implement actual Datadog Logs API call to get sources
	// For now, return a placeholder list of common log sources
	// The actual implementation would call Datadog's Logs API to get unique source values
	// from recent log data, similar to how MetricsHandler gets metric names
	
	sources := []string{
		"application",
		"docker",
		"kubernetes",
		"nginx",
		"postgres",
		"redis",
		"system",
		"syslog",
	}

	duration := time.Since(startTime)
	logger.Info("LogsSourcesHandler completed",
		"traceID", traceID,
		"duration", duration,
		"sourceCount", len(sources),
		"site", site)

	// Log the response for debugging (reusing existing logging pattern)
	logVariableResponse(logger, traceID, "/autocomplete/logs/sources", 200, duration, len(sources), nil)

	// Return sources as JSON array (same format as metrics autocomplete)
	respData, err := json.Marshal(sources)
	if err != nil {
		logger.Error("failed to marshal sources response", "error", err, "traceID", traceID)
		return sender.Send(&backend.CallResourceResponse{
			Status: 500,
			Body:   []byte(`{"error": "failed to marshal response"}`),
		})
	}

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   respData,
	})
}