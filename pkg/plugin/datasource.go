package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
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
	concurrencyLimit chan struct{} // Semaphore for max 5 concurrent requests
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
	QueryText string `json:"queryText"`
	Label     string `json:"label"`
	Hide      bool   `json:"hide"`
}

// NewDatasource creates a new Datasource factory function
func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.New()

	ds := &Datasource{
		InstanceSettings: &settings,
		cache: &AutocompleteCache{
			entries: make(map[string]*CacheEntry),
		},
		concurrencyLimit: make(chan struct{}, 5), // Max 5 concurrent requests to Datadog
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

	logger.Info("Datasource initialized", "site", opts.Site)

	return ds, nil
}

// Dispose disposes of the datasource instance
func (d *Datasource) Dispose() {
	// Cleanup if needed
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

	// Process each query
	for _, q := range req.Queries {
		var qm QueryModel
		if err := json.Unmarshal(q.JSON, &qm); err != nil {
			logger.Error("failed to parse query", "error", err)
			response.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("failed to parse query: %w", err),
			}
			continue
		}

		// Skip hidden queries
		if qm.Hide {
			response.Responses[q.RefID] = backend.DataResponse{}
			continue
		}

		if qm.QueryText == "" {
			response.Responses[q.RefID] = backend.DataResponse{}
			continue
		}

		// Create context with timeout
		queryCtx, cancel := context.WithTimeout(ddCtx, 30*time.Second)

		// Execute query
		frames, err := d.queryDatadog(queryCtx, metricsApi, from, to, &qm)
		cancel()

		if err != nil {
			logger.Error("query execution failed", "error", err, "refID", q.RefID)
			response.Responses[q.RefID] = backend.DataResponse{
				Error: err,
			}
			continue
		}

		response.Responses[q.RefID] = backend.DataResponse{
			Frames: frames,
		}
	}

	return response, nil
}

// queryDatadog executes a Datadog query and returns Grafana DataFrames
func (d *Datasource) queryDatadog(ctx context.Context, api *datadogV2.MetricsApi, from, to int64, qm *QueryModel) (data.Frames, error) {
	logger := log.New()

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
							Query:      qm.QueryText,
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

		// Check for authentication errors
		if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403") {
			return nil, fmt.Errorf("invalid Datadog API credentials")
		}
		if strings.Contains(err.Error(), "timeout") {
			return nil, fmt.Errorf("query timeout")
		}
		return nil, fmt.Errorf("failed to query metrics: %w", err)
	}

	// responseContent, _ := json.MarshalIndent(resp, "", "  ")

	// Build frames from response
	var frames data.Frames

	// Check if response has series data
	series := resp.GetData()
	if len(series.Attributes.Series) == 0 {
		return frames, nil
	}

	times := resp.GetData().Attributes.GetTimes()
	values := resp.GetData().Attributes.GetValues()

	for i := range series.Attributes.GetSeries() {
		s := &series.Attributes.Series[i]

		index := *s.QueryIndex

		// Check if we have data for this query index
		if index >= int32(len(values)) {
			continue
		}

		pointlist := values[index]
		if len(pointlist) == 0 {
			continue
		}

		// Extract metric name and build series label
		// The metric name comes from the query, group_tags identify the specific series
		metric := qm.QueryText

		// Parse group tags (dimensions) into labels
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

		// Extract timestamps and values
		timeValues := make([]int64, 0)
		numberValues := make([]float64, 0)

		// pointlist is []*float64, and times is []int64 (in milliseconds from Datadog API)
		// Zip them together - Grafana expects milliseconds
		for j, timeVal := range times {
			if j >= len(pointlist) {
				break
			}
			point := pointlist[j]
			if point != nil {
				// Timestamps are already in milliseconds from Datadog API v2
				timeValues = append(timeValues, timeVal)
				numberValues = append(numberValues, *point)
			}
		}

		if len(timeValues) == 0 {
			continue
		}

		// Build series name with labels
		seriesName := metric
		if len(labels) > 0 {
			var labelStrings []string
			for k, v := range labels {
				labelStrings = append(labelStrings, k+":"+v)
			}
			seriesName = metric + " {" + strings.Join(labelStrings, ", ") + "}"
		}

		// Use custom label if provided
		if qm.Label != "" {
			seriesName = qm.Label
		}

		// Create data frame
		frame := data.NewFrame(
			metric,
			data.NewField("time", nil, timeValues),
			data.NewField(seriesName, labels, numberValues),
		)

		frame.RefID = metric
		frames = append(frames, frame)
	}

	return frames, nil
}

// CallResource handles resource calls (autocomplete endpoints)
func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger := log.New()

	// Route requests to appropriate handlers
	switch {
	case req.Method == "GET" && req.Path == "autocomplete/metrics":
		return d.MetricsHandler(ctx, req, sender)
	case req.Method == "GET" && len(req.Path) > len("autocomplete/tags/") && req.Path[:len("autocomplete/tags/")] == "autocomplete/tags/":
		return d.TagsHandler(ctx, req, sender)
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

	// Check cache first
	if cached := d.GetCachedEntry("metrics", ttl); cached != nil {
		logger.Debug("Returning cached metrics")
		respData, _ := json.Marshal(cached.Data)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
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

	// Check cache first
	if cached := d.GetCachedEntry(cacheKey, ttl); cached != nil {
		logger.Debug("Returning cached tags", "metric", metric)
		respData, _ := json.Marshal(cached.Data)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
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

	// Fetch tags from Datadog for this metric
	// ListTagsByMetricName returns all tags associated with a specific metric
	resp, _, err := metricsApi.ListTagsByMetricName(fetchCtx, metric)
	if err != nil {
		logger.Error("Failed to fetch tags", "error", err)
		// Return empty array on timeout or error
		respData, _ := json.Marshal([]string{})
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}

	// Extract tags from response
	// ListTagsByMetricName returns MetricAllTagsResponse with Data.Attributes.Tags
	tags := []string{}
	data := resp.GetData()
	if (data.Id) != nil { // Check if pointer is not nil
		attributes := data.GetAttributes()
		tags = attributes.GetTags()
	}

	// Cache the result
	d.SetCachedEntry(cacheKey, tags)

	// Return tags as JSON
	respData, _ := json.Marshal(tags)

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
				Message: "Invalid Datadog API credentials",
			}, nil
		}
		if strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "Forbidden") {
			logger.Error("Health check failed - permission error", "error", err)
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: "API key missing required permissions",
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
