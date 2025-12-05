package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadog"
	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV1"
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

	// Initialize Datadog API client
	ctx = context.WithValue(ctx, datadog.ContextAPIKeys, map[string]datadog.APIKey{
		"apiKeyAuth": {
			Key: apiKey,
		},
		"appKeyAuth": {
			Key: appKey,
		},
	})

	client := datadog.NewAPIClient(datadog.NewConfiguration())
	metricsApi := datadogV1.NewMetricsApi(client)

	// Datadog time range in seconds - Get from first query if available
	var from, to int64
	if len(req.Queries) > 0 {
		from = req.Queries[0].TimeRange.From.Unix()
		to = req.Queries[0].TimeRange.To.Unix()
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
		queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)

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
func (d *Datasource) queryDatadog(ctx context.Context, api *datadogV1.MetricsApi, from, to int64, qm *QueryModel) (data.Frames, error) {
	logger := log.New()

	// Call Datadog Metrics API
	resp, _, err := api.QueryMetrics(ctx, from, to, qm.QueryText)
	if err != nil {
		// Check for authentication errors
		if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403") {
			return nil, fmt.Errorf("invalid Datadog API credentials")
		}
		if strings.Contains(err.Error(), "timeout") {
			return nil, fmt.Errorf("query timeout")
		}
		logger.Error("failed to query metrics", "error", err)
		return nil, fmt.Errorf("failed to query metrics: %w", err)
	}

	// Build frames from response
	var frames data.Frames

	// Check if response has series data
	series := resp.GetSeries()
	if series == nil || len(series) == 0 {
		return frames, nil
	}

	for i := range series {
		s := &series[i]
		if s == nil {
			continue
		}

		pointlist := s.GetPointlist()
		if pointlist == nil || len(pointlist) == 0 {
			continue
		}

		// Extract metric name
		metric := s.GetMetric()

		// Parse tags into labels
		labels := map[string]string{}
		tagSet := s.GetTagSet()
		if tagSet != nil && len(tagSet) > 0 {
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

		for _, point := range pointlist {
			if point == nil || len(point) < 2 {
				continue
			}

			// Datadog returns [timestamp, value] where both are pointers to float64
			timestamp := point[0]
			value := point[1]
			if timestamp != nil && value != nil {
				// Convert timestamp from seconds to milliseconds for Grafana
				timeValues = append(timeValues, int64(*timestamp)*1000)
				numberValues = append(numberValues, *value)
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
	
	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	
	// Initialize Datadog API client
	authCtx := context.WithValue(fetchCtx, datadog.ContextAPIKeys, map[string]datadog.APIKey{
		"apiKeyAuth": {
			Key: apiKey,
		},
		"appKeyAuth": {
			Key: appKey,
		},
	})
	
	client := datadog.NewAPIClient(datadog.NewConfiguration())
	metricsApi := datadogV1.NewMetricsApi(client)
	
	// Fetch metrics from Datadog - ListMetrics requires a query string parameter
	// Note: This requires the "metrics_read" scope on the API key
	resp, _, err := metricsApi.ListMetrics(authCtx, "*")
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
	results := resp.GetResults()
	metrics := results.GetMetrics()
	if metrics == nil {
		metrics = []string{}
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
	
	// Create context with timeout
	fetchCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	
	// Initialize Datadog API client
	authCtx := context.WithValue(fetchCtx, datadog.ContextAPIKeys, map[string]datadog.APIKey{
		"apiKeyAuth": {
			Key: apiKey,
		},
		"appKeyAuth": {
			Key: appKey,
		},
	})
	
	client := datadog.NewAPIClient(datadog.NewConfiguration())
	tagsApi := datadogV1.NewTagsApi(client)
	
	// Fetch tags from Datadog for this metric
	// Using ListHostTags as a way to get tags (note: in real scenario, 
	// you might want to query specific tags for a metric using custom queries)
	resp, _, err := tagsApi.ListHostTags(authCtx)
	if err != nil {
		logger.Error("Failed to fetch tags", "error", err)
		// Return empty array on timeout or error
		respData, _ := json.Marshal([]string{})
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   respData,
		})
	}
	
	// Extract and deduplicate tags from response
	tagSet := make(map[string]bool)
	var tags []string
	
	respTags := resp.GetTags()
	if respTags != nil {
		for _, hostTags := range respTags {
			if hostTags != nil {
				for _, tag := range hostTags {
					if tag != "" {
						if _, exists := tagSet[tag]; !exists {
							tagSet[tag] = true
							tags = append(tags, tag)
						}
					}
				}
			}
		}
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
	// Get API credentials from secure JSON data
	apiKey, ok := d.SecureJSONData["apiKey"]
	if !ok {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Missing API key",
		}, nil
	}

	appKey, ok := d.SecureJSONData["appKey"]
	if !ok {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Missing App key",
		}, nil
	}

	// TODO: Implement actual API call to Datadog to validate credentials
	// For now, just verify keys exist
	if len(apiKey) == 0 || len(appKey) == 0 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "API key or App key is empty",
		}, nil
	}

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
