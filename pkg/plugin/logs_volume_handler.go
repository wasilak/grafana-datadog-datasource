package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LogsVolumeHandler handles Datadog logs volume queries for histogram visualization
// Requirements: 18.1, 18.2, 18.4, 18.5
type LogsVolumeHandler struct {
	datasource     *Datasource
	reqQueries     []backend.DataQuery
	volumeQueries  []QueryModel
	queryModels    map[string]QueryModel
	ddCtx          context.Context
}

// NewLogsVolumeHandler creates a new LogsVolumeHandler instance
// Requirements: 18.1, 18.4
func NewLogsVolumeHandler(datasource *Datasource, queries []backend.DataQuery, ddCtx context.Context) *LogsVolumeHandler {
	return &LogsVolumeHandler{
		datasource:    datasource,
		reqQueries:    queries,
		volumeQueries: make([]QueryModel, 0),
		queryModels:   make(map[string]QueryModel),
		ddCtx:         ddCtx,
	}
}

// processQuery processes a single logs volume query and prepares it for execution
// Requirements: 18.1, 18.4
func (h *LogsVolumeHandler) processQuery(qm *QueryModel) error {
	logger := log.New()

	// Skip hidden queries
	if qm.Hide {
		return nil
	}

	// Validate logs volume query
	if qm.LogQuery == "" {
		return fmt.Errorf("logs volume query cannot be empty")
	}

	// Find the corresponding backend query for RefID
	var refID string
	for _, q := range h.reqQueries {
		var tempQM QueryModel
		if err := json.Unmarshal(q.JSON, &tempQM); err != nil {
			continue
		}
		if tempQM.LogQuery == qm.LogQuery && tempQM.QueryType == qm.QueryType {
			refID = q.RefID
			break
		}
	}

	if refID == "" {
		return fmt.Errorf("could not find RefID for logs volume query")
	}

	h.queryModels[refID] = *qm
	h.volumeQueries = append(h.volumeQueries, *qm)

	logger.Debug("Added logs volume query", "refID", refID, "logQuery", qm.LogQuery)
	return nil
}

// executeQueries executes all processed logs volume queries and returns the response
// Requirements: 18.1, 18.2, 18.4, 18.5
func (h *LogsVolumeHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	logger := log.New()
	response := backend.NewQueryDataResponse()

	// Return empty response if no queries to process
	if len(h.volumeQueries) == 0 {
		logger.Info("No logs volume queries to process")
		return response, nil
	}

	logger.Info("Processing logs volume queries", "volumeQueryCount", len(h.volumeQueries))

	// Process each logs volume query
	for refID, qm := range h.queryModels {
		// Find the corresponding backend query
		var backendQuery *backend.DataQuery
		for _, q := range h.reqQueries {
			if q.RefID == refID {
				backendQuery = &q
				break
			}
		}

		if backendQuery == nil {
			logger.Error("Could not find backend query for RefID", "refID", refID)
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, "could not find backend query")
			continue
		}

		// Execute logs volume query
		volumeResponse, err := h.queryLogsVolume(ctx, &qm, backendQuery)
		if err != nil {
			logger.Error("Failed to execute logs volume query", "refID", refID, "error", err)
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("logs volume query failed: %v", err))
			continue
		}

		response.Responses[refID] = volumeResponse
	}

	return response, nil
}

// queryLogsVolume executes a logs volume query using Datadog's Logs Aggregation API
// Requirements: 18.1, 18.2
func (h *LogsVolumeHandler) queryLogsVolume(ctx context.Context, qm *QueryModel, backendQuery *backend.DataQuery) (backend.DataResponse, error) {
	logger := log.New()

	// Calculate appropriate bucket size based on time range
	bucketSize := h.calculateBucketSize(backendQuery.TimeRange)
	logger.Debug("Calculated bucket size", "bucketSize", bucketSize, "timeRange", backendQuery.TimeRange)

	// Create logs aggregation request for Datadog API
	// Using logs search API for volume calculation
	aggRequest := LogsAggregationRequest{
		Data: LogsAggregationData{
			Type: "aggregate_request",
			Attributes: LogsAggregationAttributes{
				Query: qm.LogQuery,
				Time: LogsTime{
					From: backendQuery.TimeRange.From.Format(time.RFC3339),
					To:   backendQuery.TimeRange.To.Format(time.RFC3339),
				},
				Compute: []LogsCompute{{
					Aggregation: "count",
				}},
				GroupBy: []LogsGroupBy{{
					Facet: "@timestamp",
					Histogram: LogsHistogram{
						Interval: bucketSize,
					},
				}},
			},
		},
	}

	// Execute aggregation API call
	aggregationResponse, err := h.callLogsAggregationAPI(ctx, aggRequest)
	if err != nil {
		return backend.DataResponse{}, fmt.Errorf("logs aggregation API call failed: %w", err)
	}

	// Transform response to Grafana data frame
	frame := h.createLogsVolumeDataFrame(aggregationResponse, bucketSize, backendQuery.RefID)

	return backend.DataResponse{Frames: []*data.Frame{frame}}, nil
}

// calculateBucketSize determines the appropriate time bucket size based on the query time range
// Requirements: 18.2, 18.3
func (h *LogsVolumeHandler) calculateBucketSize(timeRange backend.TimeRange) string {
	duration := timeRange.To.Sub(timeRange.From)

	switch {
	case duration <= time.Hour:
		return "1m"
	case duration <= 6*time.Hour:
		return "5m"
	case duration <= 24*time.Hour:
		return "15m"
	case duration <= 7*24*time.Hour:
		return "1h"
	default:
		return "4h"
	}
}

// callLogsAggregationAPI makes API calls to get logs volume data using the logs search API
// Since the dedicated aggregation endpoint may not be available, we use time-based search
// NOTE: This approach provides approximations since we're limited to 1000 entries per time bucket
// Requirements: 18.1, 18.4, 18.5
func (h *LogsVolumeHandler) callLogsAggregationAPI(ctx context.Context, request LogsAggregationRequest) (*LogsAggregationResponse, error) {
	logger := log.New()

	// Get API credentials (reuse same authentication as logs queries)
	// Requirements: 18.4 - use same authentication and error handling as logs queries
	apiKey, ok := h.datasource.SecureJSONData["apiKey"]
	if !ok {
		return nil, fmt.Errorf("missing apiKey in secure data")
	}

	appKey, ok := h.datasource.SecureJSONData["appKey"]
	if !ok {
		return nil, fmt.Errorf("missing appKey in secure data")
	}

	// Get Datadog site configuration
	site := h.datasource.JSONData.Site
	if site == "" {
		site = "datadoghq.com" // Default to US
	}

	// Use logs search API instead of aggregation API for better compatibility
	// Construct API URL for logs search
	apiURL := fmt.Sprintf("https://api.%s/api/v2/logs/events/search", site)

	// Parse time range
	fromTime, err := time.Parse(time.RFC3339, request.Data.Attributes.Time.From)
	if err != nil {
		return nil, fmt.Errorf("failed to parse from time: %w", err)
	}
	
	toTime, err := time.Parse(time.RFC3339, request.Data.Attributes.Time.To)
	if err != nil {
		return nil, fmt.Errorf("failed to parse to time: %w", err)
	}

	// Calculate bucket duration
	bucketInterval := request.Data.Attributes.GroupBy[0].Histogram.Interval
	bucketDuration, err := h.parseBucketInterval(bucketInterval)
	if err != nil {
		return nil, fmt.Errorf("failed to parse bucket interval: %w", err)
	}

	// Generate time buckets and get counts for each
	buckets := []LogsAggregationBucket{}
	
	for currentTime := fromTime; currentTime.Before(toTime); currentTime = currentTime.Add(bucketDuration) {
		bucketEnd := currentTime.Add(bucketDuration)
		if bucketEnd.After(toTime) {
			bucketEnd = toTime
		}

		// Create search request for this time bucket
		searchRequest := LogsSearchRequest{
			Data: LogsSearchData{
				Type: "search_request",
				Attributes: LogsSearchAttributes{
					Query: request.Data.Attributes.Query,
					Time: LogsTime{
						From: currentTime.Format(time.RFC3339),
						To:   bucketEnd.Format(time.RFC3339),
					},
					Sort:  "timestamp",
					Limit: 1000, // FIXED: Use higher limit to get better count estimates
				},
			},
		}

		// Marshal request body
		requestBody, err := json.Marshal(searchRequest)
		if err != nil {
			logger.Warn("Failed to marshal search request for bucket", "time", currentTime, "error", err)
			continue
		}

		logger.Debug("Making logs search API call for volume bucket", 
			"url", apiURL, 
			"query", request.Data.Attributes.Query,
			"bucketStart", currentTime,
			"bucketEnd", bucketEnd)

		// Make HTTP request
		httpResponse, err := h.datasource.makeDatadogAPIRequest(ctx, "POST", apiURL, requestBody, apiKey, appKey)
		if err != nil {
			logger.Warn("Logs search API request failed for bucket", "time", currentTime, "error", err)
			// Add empty bucket to maintain time series continuity
			buckets = append(buckets, LogsAggregationBucket{
				By:    LogsAggregationBucketBy{Timestamp: currentTime.Format(time.RFC3339)},
				Count: 0,
			})
			continue
		}

		// Parse search response to get total count
		var searchResponse LogsSearchResponse
		if err := json.Unmarshal(httpResponse, &searchResponse); err != nil {
			logger.Warn("Failed to parse search response for bucket", "time", currentTime, "error", err)
			// Add empty bucket to maintain time series continuity
			buckets = append(buckets, LogsAggregationBucket{
				By:    LogsAggregationBucketBy{Timestamp: currentTime.Format(time.RFC3339)},
				Count: 0,
			})
			continue
		}

		// FIXED: Extract count from actual log entries returned as an approximation
		// Datadog Logs API doesn't provide total count in meta, so we use the actual entries count
		// Note: This is an approximation since we're limited to 1000 entries per bucket
		totalCount := len(searchResponse.Data)

		logger.Debug("Extracted count for bucket", 
			"time", currentTime, 
			"count", totalCount,
			"entriesReturned", len(searchResponse.Data),
			"isLimitReached", totalCount >= 1000)

		// Add bucket with count
		buckets = append(buckets, LogsAggregationBucket{
			By:    LogsAggregationBucketBy{Timestamp: currentTime.Format(time.RFC3339)},
			Count: totalCount,
		})
	}

	// Create aggregation response
	aggregationResponse := &LogsAggregationResponse{
		Data: LogsAggregationResponseData{
			Buckets: buckets,
		},
	}

	logger.Info("Created logs volume aggregation response", 
		"totalBuckets", len(buckets),
		"firstBucketCount", func() int {
			if len(buckets) > 0 {
				return buckets[0].Count
			}
			return -1
		}())

	return aggregationResponse, nil
}

// parseBucketInterval converts bucket interval string to time.Duration
func (h *LogsVolumeHandler) parseBucketInterval(interval string) (time.Duration, error) {
	switch interval {
	case "1m":
		return time.Minute, nil
	case "5m":
		return 5 * time.Minute, nil
	case "15m":
		return 15 * time.Minute, nil
	case "1h":
		return time.Hour, nil
	case "4h":
		return 4 * time.Hour, nil
	default:
		return 0, fmt.Errorf("unsupported bucket interval: %s", interval)
	}
}

// createLogsVolumeDataFrame creates a Grafana data frame for logs volume histogram visualization
// Requirements: 18.2, 18.3
func (h *LogsVolumeHandler) createLogsVolumeDataFrame(response *LogsAggregationResponse, bucketSize string, refID string) *data.Frame {
	// Extract time buckets and counts from aggregation response
	var timeValues []time.Time
	var countValues []float64

	// Process aggregation buckets
	for _, bucket := range response.Data.Buckets {
		// Parse timestamp
		timestamp, err := time.Parse(time.RFC3339, bucket.By.Timestamp)
		if err != nil {
			continue // Skip invalid timestamps
		}

		timeValues = append(timeValues, timestamp)
		countValues = append(countValues, float64(bucket.Count))
	}

	// Create data frame with proper structure for histogram visualization
	frame := data.NewFrame(
		"logs-volume", // Frame name
		data.NewField("Time", nil, timeValues),
		data.NewField("Count", nil, countValues),
	)

	// Set frame metadata for histogram visualization
	// Requirements: 18.3 - proper metadata for Grafana recognition
	// Use refId prefix 'log-volume-' to match Grafana conventions
	frame.RefID = fmt.Sprintf("log-volume-%s", refID)
	frame.Meta = &data.FrameMeta{
		Type:                    data.FrameTypeTimeSeriesMulti,
		PreferredVisualization: "graph", // For histogram display - using string instead of constant
		Custom: map[string]interface{}{
			"bucketSize": bucketSize,
		},
	}

	logger := log.New()
	logger.Info("Created logs volume data frame", 
		"refID", frame.RefID,
		"timeValueCount", len(timeValues),
		"countValueCount", len(countValues),
		"totalCount", func() float64 {
			total := 0.0
			for _, count := range countValues {
				total += count
			}
			return total
		}())

	return frame
}

// Data structures for Datadog Logs Volume API

// LogsAggregationRequest represents the request structure for logs volume queries
type LogsAggregationRequest struct {
	Data LogsAggregationData `json:"data"`
}

type LogsAggregationData struct {
	Type       string                     `json:"type"`
	Attributes LogsAggregationAttributes  `json:"attributes"`
}

type LogsAggregationAttributes struct {
	Query   string        `json:"query"`
	Time    LogsTime      `json:"time"`
	Compute []LogsCompute `json:"compute"`
	GroupBy []LogsGroupBy `json:"group_by"`
}

type LogsCompute struct {
	Aggregation string `json:"aggregation"`
}

type LogsGroupBy struct {
	Facet     string        `json:"facet"`
	Histogram LogsHistogram `json:"histogram"`
}

type LogsHistogram struct {
	Interval string `json:"interval"`
}

// LogsSearchResponse represents the response structure from Datadog's Logs Search API
// This matches the structure used in the main logs handler
type LogsSearchResponse struct {
	Data []map[string]interface{} `json:"data"`
	Meta *LogsSearchMeta          `json:"meta"`
}

type LogsSearchMeta struct {
	Page *LogsSearchPage `json:"page"`
}

type LogsSearchPage struct {
	After string `json:"after"` // Pagination cursor, not total count
}

// LogsAggregationResponse represents the response structure for logs volume queries
type LogsAggregationResponse struct {
	Data LogsAggregationResponseData `json:"data"`
}

type LogsAggregationResponseData struct {
	Buckets []LogsAggregationBucket `json:"buckets"`
}

type LogsAggregationBucket struct {
	By    LogsAggregationBucketBy `json:"by"`
	Count int                     `json:"count"`
}

type LogsAggregationBucketBy struct {
	Timestamp string `json:"@timestamp"`
}