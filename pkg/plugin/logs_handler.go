package plugin

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// LogsHandler handles Datadog logs queries
// Created new LogsHandler for logs-specific processing
// Requirements: 1.1, 6.1, 6.2
type LogsHandler struct {
	datasource     *Datasource
	reqQueries     []backend.DataQuery
	logsQueries    []QueryModel
	queryModels    map[string]QueryModel
	ddCtx          context.Context
}

// NewLogsHandler creates a new LogsHandler instance
func NewLogsHandler(datasource *Datasource, queries []backend.DataQuery, ddCtx context.Context) *LogsHandler {
	return &LogsHandler{
		datasource:  datasource,
		reqQueries:  queries,
		logsQueries: make([]QueryModel, 0),
		queryModels: make(map[string]QueryModel),
		ddCtx:       ddCtx,
	}
}

// processQuery processes a single logs query and prepares it for execution
// Requirements: 2.1, 2.2, 2.5
func (h *LogsHandler) processQuery(qm *QueryModel) error {
	logger := log.New()

	// Skip hidden queries
	if qm.Hide {
		return nil
	}

	// Validate logs query
	if qm.LogQuery == "" {
		return fmt.Errorf("logs query cannot be empty")
	}

	// Validate and set defaults for JSON parsing configuration
	if qm.JSONParsing == nil {
		// Set default configuration if not provided
		defaultConfig := DefaultJSONParsingConfig()
		qm.JSONParsing = &defaultConfig
	} else {
		// Validate existing configuration
		if err := qm.JSONParsing.Validate(); err != nil {
			return fmt.Errorf("invalid JSON parsing configuration: %w", err)
		}
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
		return fmt.Errorf("could not find RefID for logs query")
	}

	h.queryModels[refID] = *qm
	h.logsQueries = append(h.logsQueries, *qm)

	logger.Debug("Added logs query", "refID", refID, "logQuery", qm.LogQuery)
	return nil
}

// executeQueries executes all processed logs queries and returns the response
// Requirements: 6.1, 6.2
func (h *LogsHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	logger := log.New()
	response := backend.NewQueryDataResponse()

	// Return empty response if no queries to process
	if len(h.logsQueries) == 0 {
		return response, nil
	}

	logger.Info("Processing logs queries", "logsQueryCount", len(h.logsQueries))

	// Create a new request containing only logs queries
	logsReq := &backend.QueryDataRequest{
		Headers: map[string]string{}, // Will be set by the calling context
		Queries: []backend.DataQuery{},
	}

	// Add logs queries to the new request
	for _, q := range h.reqQueries {
		var qm QueryModel
		if err := json.Unmarshal(q.JSON, &qm); err != nil {
			continue
		}

		// Check if this is a logs query that we processed
		for refID, processedQM := range h.queryModels {
			if q.RefID == refID && qm.LogQuery == processedQM.LogQuery {
				logsReq.Queries = append(logsReq.Queries, q)
				break
			}
		}
	}

	// Execute logs queries using the existing logs handler
	// This reuses the existing queryLogs method which has proper authentication and error handling
	logsResponse, err := h.datasource.queryLogs(h.ddCtx, logsReq)
	if err != nil {
		logger.Error("Failed to execute logs queries", "error", err)
		// Set error responses for all logs queries
		for refID := range h.queryModels {
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("logs query failed: %v", err))
		}
		return response, nil
	}

	// Merge logs responses into main response
	for refID, logsResp := range logsResponse.Responses {
		response.Responses[refID] = logsResp
	}

	return response, nil
}