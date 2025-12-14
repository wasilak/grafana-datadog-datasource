package plugin

import (
	"context"
	"fmt"
	"strings"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
)

// DatadogMetricsRequestBuilder abstracts Datadog Metrics API request construction
// Refactored from existing metrics request logic into builder pattern
// Ensures consistent patterns between logs and metrics
// Requirements: 6.2, 6.3
type DatadogMetricsRequestBuilder struct {
	apiKey  string
	appKey  string
	site    string
	baseURL string
}

// NewDatadogMetricsRequestBuilder creates a new DatadogMetricsRequestBuilder instance
func NewDatadogMetricsRequestBuilder(apiKey, appKey, site string) *DatadogMetricsRequestBuilder {
	if site == "" {
		site = "datadoghq.com" // Default to US
	}
	
	return &DatadogMetricsRequestBuilder{
		apiKey:  apiKey,
		appKey:  appKey,
		site:    site,
		baseURL: fmt.Sprintf("https://api.%s", site),
	}
}

// MetricsQueryRequestParams contains parameters for metrics query requests
type MetricsQueryRequestParams struct {
	From           int64                        // Unix timestamp in milliseconds
	To             int64                        // Unix timestamp in milliseconds
	Queries        []datadogV2.TimeseriesQuery  // Metrics queries
	Formulas       []datadogV2.QueryFormula     // Optional formulas
	Interval       *int64                       // Optional interval override
}

// BuildTimeseriesQueryRequest creates a Datadog Timeseries Formula Query Request
// Handles authentication and request formatting for metrics queries
func (b *DatadogMetricsRequestBuilder) BuildTimeseriesQueryRequest(params MetricsQueryRequestParams) (datadogV2.TimeseriesFormulaQueryRequest, error) {
	// Validate required parameters
	if params.From <= 0 || params.To <= 0 {
		return datadogV2.TimeseriesFormulaQueryRequest{}, fmt.Errorf("invalid time range: from=%d, to=%d", params.From, params.To)
	}
	
	if params.To <= params.From {
		return datadogV2.TimeseriesFormulaQueryRequest{}, fmt.Errorf("invalid time range: to (%d) must be after from (%d)", params.To, params.From)
	}
	
	if len(params.Queries) == 0 && len(params.Formulas) == 0 {
		return datadogV2.TimeseriesFormulaQueryRequest{}, fmt.Errorf("at least one query or formula is required")
	}
	
	// Create the request body for metrics queries
	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				From:    params.From,
				To:      params.To,
				Queries: params.Queries,
			},
		},
	}
	
	// Add formulas if provided
	if len(params.Formulas) > 0 {
		body.Data.Attributes.Formulas = params.Formulas
	}
	
	// Add interval override if provided
	if params.Interval != nil && *params.Interval > 0 {
		body.Data.Attributes.Interval = params.Interval
	}
	
	return body, nil
}

// MetricsAutocompleteRequestParams contains parameters for metrics autocomplete requests
type MetricsAutocompleteRequestParams struct {
	MetricName string // For tag-related autocomplete
	TagKey     string // For tag values autocomplete
}

// BuildListTagConfigurationsRequest creates parameters for ListTagConfigurations API call
// Used for fetching available metrics
func (b *DatadogMetricsRequestBuilder) BuildListTagConfigurationsRequest() (*datadogV2.ListTagConfigurationsOptionalParameters, error) {
	// Create optional parameters for the API call
	// This can be extended in the future to support filtering, pagination, etc.
	optionalParams := datadogV2.NewListTagConfigurationsOptionalParameters()
	
	return optionalParams, nil
}

// BuildListTagsByMetricNameRequest validates parameters for ListTagsByMetricName API call
// Used for fetching tags for a specific metric
func (b *DatadogMetricsRequestBuilder) BuildListTagsByMetricNameRequest(params MetricsAutocompleteRequestParams) (string, error) {
	// Validate required parameters
	if params.MetricName == "" {
		return "", fmt.Errorf("metric name is required")
	}
	
	// Check if metric name is a regex pattern (not supported by this API)
	if len(params.MetricName) >= 2 && params.MetricName[0] == '/' && params.MetricName[len(params.MetricName)-1] == '/' {
		return "", fmt.Errorf("regex patterns are not supported for ListTagsByMetricName API")
	}
	
	return params.MetricName, nil
}

// ValidateCredentials validates that the required API credentials are present
func (b *DatadogMetricsRequestBuilder) ValidateCredentials() error {
	if b.apiKey == "" {
		return fmt.Errorf("DD-API-KEY is required")
	}
	
	if b.appKey == "" {
		return fmt.Errorf("DD-APPLICATION-KEY is required")
	}
	
	return nil
}

// GetSite returns the configured Datadog site
func (b *DatadogMetricsRequestBuilder) GetSite() string {
	return b.site
}

// GetBaseURL returns the base URL for API requests
func (b *DatadogMetricsRequestBuilder) GetBaseURL() string {
	return b.baseURL
}

// CreateDatadogContext creates a Datadog API context with authentication
// Shares common authentication and header logic with logs builder
func (b *DatadogMetricsRequestBuilder) CreateDatadogContext(ctx context.Context) context.Context {
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

// CreateMetricsAPI creates a configured Datadog Metrics API client
// Provides a convenient way to get a properly configured API client
func (b *DatadogMetricsRequestBuilder) CreateMetricsAPI() *datadogV2.MetricsApi {
	configuration := datadog.NewConfiguration()
	client := datadog.NewAPIClient(configuration)
	return datadogV2.NewMetricsApi(client)
}

// ProcessQueryText processes and validates a metrics query text
// Adds "by {*}" clause if needed for proper series separation
func (b *DatadogMetricsRequestBuilder) ProcessQueryText(queryText string) (string, error) {
	if queryText == "" {
		return "", fmt.Errorf("query text cannot be empty")
	}
	
	// Apply the same query processing logic as the existing implementation
	lowerQuery := strings.ToLower(queryText)
	
	hasGroupByClause := strings.Contains(lowerQuery, " by ")
	hasBooleanOperators := strings.Contains(lowerQuery, " in ") ||
		strings.Contains(lowerQuery, " or ") ||
		strings.Contains(lowerQuery, " and ") ||
		strings.Contains(lowerQuery, " not in ")
	
	// Add "by {*}" if no grouping clause and no boolean operators
	if !hasGroupByClause && !hasBooleanOperators {
		queryText = queryText + " by {*}"
	}
	
	return queryText, nil
}