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
// NO additional API calls - uses cached log entries from the main logs query
// Requirements: 18.1, 18.2, 18.4, 18.5
type LogsVolumeHandler struct {
	datasource    *Datasource
	reqQueries    []backend.DataQuery
	volumeQueries []QueryModel
	queryModels   map[string]QueryModel
	ddCtx         context.Context
}

// NewLogsVolumeHandler creates a new LogsVolumeHandler instance
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
// NO API calls - uses cached log entries from the main logs query
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

		// Create volume histogram from cached log entries - NO API calls
		volumeResponse, err := h.queryLogsVolume(ctx, &qm, backendQuery)
		if err != nil {
			logger.Error("Failed to create logs volume histogram", "refID", refID, "error", err)
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("logs volume failed: %v", err))
			continue
		}

		response.Responses[refID] = volumeResponse
	}

	return response, nil
}

// queryLogsVolume creates a volume histogram from cached log entries
// NO additional API calls - uses the same data from the logs query cache
func (h *LogsVolumeHandler) queryLogsVolume(ctx context.Context, qm *QueryModel, backendQuery *backend.DataQuery) (backend.DataResponse, error) {
	logger := log.New()

	// Get cached log entries from the main logs query - NO additional API calls
	from := backendQuery.TimeRange.From.UnixMilli()
	to := backendQuery.TimeRange.To.UnixMilli()

	// Build cache key matching the logs query cache key format
	cursorKey := "first"
	pageSize := 100
	if qm.PageSize != nil && *qm.PageSize > 0 {
		pageSize = *qm.PageSize
	}
	cacheKey := fmt.Sprintf("logs:%s:%d:%d:%s:%d", qm.LogQuery, from, to, cursorKey, pageSize)

	// Try to get cached entries (use same TTL as logs queries)
	cacheTTL := 30 * time.Second
	cachedEntry := h.datasource.GetCachedLogsEntry(cacheKey, cacheTTL)

	var logEntries []LogEntry
	if cachedEntry != nil {
		logEntries = cachedEntry.LogEntries
		logger.Info("Using cached log entries for volume calculation",
			"query", qm.LogQuery,
			"entriesCount", len(logEntries),
			"cacheKey", cacheKey)
	} else {
		// If no cache, return empty volume frame - the logs query will populate the cache
		logger.Info("No cached log entries for volume calculation, returning empty frame",
			"query", qm.LogQuery,
			"cacheKey", cacheKey)
		parser := NewLogsResponseParser(h.datasource)
		volumeFrame := parser.createEmptyVolumeFrame(backendQuery.RefID)
		return backend.DataResponse{Frames: data.Frames{volumeFrame}}, nil
	}

	// Create volume frame from cached entries - no API calls!
	parser := NewLogsResponseParser(h.datasource)
	volumeFrame := parser.createLogsVolumeFrame(logEntries, backendQuery.RefID, backendQuery.TimeRange)

	logger.Info("Created volume histogram from cached log entries",
		"query", qm.LogQuery,
		"entriesCount", len(logEntries),
		"refID", backendQuery.RefID)

	return backend.DataResponse{Frames: data.Frames{volumeFrame}}, nil
}
