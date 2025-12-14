package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
)

// DatadogLogsRequestBuilder abstracts Datadog Logs API request construction
// Following OpenSearch's builder pattern for maintainability
// Requirements: 6.1, 6.2, 6.3
type DatadogLogsRequestBuilder struct {
	apiKey    string
	appKey    string
	site      string
	baseURL   string
	userAgent string
}

// NewDatadogLogsRequestBuilder creates a new DatadogLogsRequestBuilder instance
func NewDatadogLogsRequestBuilder(apiKey, appKey, site string) *DatadogLogsRequestBuilder {
	if site == "" {
		site = "datadoghq.com" // Default to US
	}
	
	return &DatadogLogsRequestBuilder{
		apiKey:    apiKey,
		appKey:    appKey,
		site:      site,
		baseURL:   fmt.Sprintf("https://api.%s", site),
		userAgent: "grafana-datadog-datasource/1.0",
	}
}

// LogsSearchRequestParams contains parameters for logs search requests
type LogsSearchRequestParams struct {
	Query    string
	From     int64  // Unix timestamp in milliseconds
	To       int64  // Unix timestamp in milliseconds
	Cursor   string // Pagination cursor
	PageSize int    // Number of results per page (max 1000)
}

// BuildLogsSearchRequest creates an HTTP request for Datadog Logs Search API v2
// Handles authentication headers (DD-API-KEY, DD-APPLICATION-KEY)
// Manages request formatting and validation
func (b *DatadogLogsRequestBuilder) BuildLogsSearchRequest(ctx context.Context, params LogsSearchRequestParams) (*http.Request, error) {
	// Validate required parameters
	if params.Query == "" {
		return nil, fmt.Errorf("logs query cannot be empty")
	}
	
	if params.From <= 0 || params.To <= 0 {
		return nil, fmt.Errorf("invalid time range: from=%d, to=%d", params.From, params.To)
	}
	
	if params.To <= params.From {
		return nil, fmt.Errorf("invalid time range: to (%d) must be after from (%d)", params.To, params.From)
	}
	
	// Set default page size if not specified
	if params.PageSize <= 0 {
		params.PageSize = 100 // Default page size
	}
	
	// Cap page size at API limit
	if params.PageSize > 1000 {
		params.PageSize = 1000
	}
	
	// Convert timestamps to ISO format as required by Datadog API
	fromTime := time.UnixMilli(params.From).UTC().Format(time.RFC3339)
	toTime := time.UnixMilli(params.To).UTC().Format(time.RFC3339)
	
	// Create request body matching Datadog's Logs API v2 format
	requestBody := map[string]interface{}{
		"filter": map[string]interface{}{
			"query": params.Query,
			"from":  fromTime,
			"to":    toTime,
		},
		"sort": "timestamp",
		"page": map[string]interface{}{
			"limit": params.PageSize,
		},
	}
	
	// Add pagination cursor if provided
	if params.Cursor != "" {
		requestBody["page"].(map[string]interface{})["cursor"] = params.Cursor
	}
	
	// Marshal request body to JSON
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal logs request body: %w", err)
	}
	
	// Create HTTP request
	url := fmt.Sprintf("%s/api/v2/logs/events/search", b.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	
	// Add authentication headers
	b.addAuthenticationHeaders(req)
	
	// Add content headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", b.userAgent)
	
	return req, nil
}

// BuildLogsAggregationRequest creates an HTTP request for Datadog Logs Aggregation API v2
// Used for logs volume histogram generation
func (b *DatadogLogsRequestBuilder) BuildLogsAggregationRequest(ctx context.Context, params LogsAggregationRequestParams) (*http.Request, error) {
	// Validate required parameters
	if params.Query == "" {
		return nil, fmt.Errorf("logs query cannot be empty")
	}
	
	if params.From <= 0 || params.To <= 0 {
		return nil, fmt.Errorf("invalid time range: from=%d, to=%d", params.From, params.To)
	}
	
	if params.BucketSize == "" {
		params.BucketSize = "auto" // Default bucket size
	}
	
	// Convert timestamps to ISO format
	fromTime := time.UnixMilli(params.From).UTC().Format(time.RFC3339)
	toTime := time.UnixMilli(params.To).UTC().Format(time.RFC3339)
	
	// Create request body for logs aggregation
	requestBody := map[string]interface{}{
		"filter": map[string]interface{}{
			"query": params.Query,
			"from":  fromTime,
			"to":    toTime,
		},
		"compute": []map[string]interface{}{
			{
				"aggregation": "count",
			},
		},
		"group_by": []map[string]interface{}{
			{
				"facet": "@timestamp",
				"histogram": map[string]interface{}{
					"interval": params.BucketSize,
				},
			},
		},
	}
	
	// Marshal request body to JSON
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal logs aggregation request body: %w", err)
	}
	
	// Create HTTP request
	url := fmt.Sprintf("%s/api/v2/logs/aggregate", b.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	
	// Add authentication headers
	b.addAuthenticationHeaders(req)
	
	// Add content headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", b.userAgent)
	
	return req, nil
}

// LogsAggregationRequestParams contains parameters for logs aggregation requests
type LogsAggregationRequestParams struct {
	Query      string
	From       int64  // Unix timestamp in milliseconds
	To         int64  // Unix timestamp in milliseconds
	BucketSize string // Time bucket size (e.g., "1m", "5m", "1h", "auto")
}

// addAuthenticationHeaders adds Datadog API authentication headers to the request
// Handles authentication headers (DD-API-KEY, DD-APPLICATION-KEY)
func (b *DatadogLogsRequestBuilder) addAuthenticationHeaders(req *http.Request) {
	req.Header.Set("DD-API-KEY", b.apiKey)
	req.Header.Set("DD-APPLICATION-KEY", b.appKey)
}

// ValidateCredentials validates that the required API credentials are present
func (b *DatadogLogsRequestBuilder) ValidateCredentials() error {
	if b.apiKey == "" {
		return fmt.Errorf("DD-API-KEY is required")
	}
	
	if b.appKey == "" {
		return fmt.Errorf("DD-APPLICATION-KEY is required")
	}
	
	return nil
}

// GetSite returns the configured Datadog site
func (b *DatadogLogsRequestBuilder) GetSite() string {
	return b.site
}

// GetBaseURL returns the base URL for API requests
func (b *DatadogLogsRequestBuilder) GetBaseURL() string {
	return b.baseURL
}

// CreateDatadogContext creates a Datadog API context with authentication
// This method provides compatibility with the existing Datadog Go client patterns
func (b *DatadogLogsRequestBuilder) CreateDatadogContext(ctx context.Context) context.Context {
	// Set the site and API keys in context (following existing authentication pattern)
	ddCtx := context.WithValue(ctx, datadog.ContextServerVariables, map[string]string{
		"site": b.site,
	})
	ddCtx = context.WithValue(ddCtx, datadog.ContextAPIKeys, map[string]datadog.APIKey{
		"apiKeyAuth": {
			Key: b.apiKey,
		},
		"appKeyAuth": {
			Key: b.appKey,
		},
	})
	
	return ddCtx
}