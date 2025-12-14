package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// MetricsHandler handles Datadog metrics queries
// Refactored from existing metrics logic into MetricsHandler
// Requirements: 1.1, 6.1, 6.2
type MetricsHandler struct {
	datasource     *Datasource
	reqQueries     []backend.DataQuery
	metricsQueries []datadogV2.TimeseriesQuery
	formulas       []datadogV2.QueryFormula
	queryModels    map[string]QueryModel
	hasFormulas    bool
	from           int64
	to             int64
	ddCtx          context.Context
	metricsApi     *datadogV2.MetricsApi
}

// NewMetricsHandler creates a new MetricsHandler instance
func NewMetricsHandler(datasource *Datasource, queries []backend.DataQuery, ddCtx context.Context, metricsApi *datadogV2.MetricsApi) *MetricsHandler {
	var from, to int64
	if len(queries) > 0 {
		from = queries[0].TimeRange.From.UnixMilli()
		to = queries[0].TimeRange.To.UnixMilli()
	}

	return &MetricsHandler{
		datasource:     datasource,
		reqQueries:     queries,
		metricsQueries: make([]datadogV2.TimeseriesQuery, 0),
		formulas:       make([]datadogV2.QueryFormula, 0),
		queryModels:    make(map[string]QueryModel),
		hasFormulas:    false,
		from:           from,
		to:             to,
		ddCtx:          ddCtx,
		metricsApi:     metricsApi,
	}
}

// processQuery processes a single metrics query and prepares it for execution
// Requirements: 2.1, 2.2, 2.5
func (h *MetricsHandler) processQuery(qm *QueryModel) error {
	logger := log.New()

	// Skip hidden queries
	if qm.Hide {
		return nil
	}

	// Find the corresponding backend query for RefID
	var refID string
	for _, q := range h.reqQueries {
		var tempQM QueryModel
		if err := json.Unmarshal(q.JSON, &tempQM); err != nil {
			continue
		}
		if tempQM.QueryText == qm.QueryText && tempQM.Type == qm.Type && tempQM.Expression == qm.Expression {
			refID = q.RefID
			break
		}
	}

	if refID == "" {
		return fmt.Errorf("could not find RefID for query")
	}

	h.queryModels[refID] = *qm

	if qm.Type == "math" && qm.Expression != "" {
		// This is a formula query - convert Grafana format ($A) to Datadog format (A)
		h.hasFormulas = true
		datadogFormula := convertGrafanaFormulaToDatadog(qm.Expression)
		h.formulas = append(h.formulas, datadogV2.QueryFormula{
			Formula: datadogFormula,
		})
		logger.Debug("Added formula", "refID", refID, "formula", datadogFormula)
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
		queryName := refID
		h.metricsQueries = append(h.metricsQueries, datadogV2.TimeseriesQuery{
			MetricsTimeseriesQuery: &datadogV2.MetricsTimeseriesQuery{
				DataSource: datadogV2.METRICSDATASOURCE_METRICS,
				Query:      queryText,
				Name:       &queryName,
			},
		})
		logger.Debug("Added metrics query", "refID", refID, "query", queryText)
	}

	return nil
}

// executeQueries executes all processed metrics queries and returns the response
// Requirements: 6.1, 6.2
func (h *MetricsHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	logger := log.New()
	response := backend.NewQueryDataResponse()

	// Return empty response if no queries to process
	if len(h.metricsQueries) == 0 && len(h.formulas) == 0 {
		return response, nil
	}

	// Create the request body for metrics queries
	body := datadogV2.TimeseriesFormulaQueryRequest{
		Data: datadogV2.TimeseriesFormulaRequest{
			Type: datadogV2.TIMESERIESFORMULAREQUESTTYPE_TIMESERIES_REQUEST,
			Attributes: datadogV2.TimeseriesFormulaRequestAttributes{
				From:    h.from,
				To:      h.to,
				Queries: h.metricsQueries,
			},
		},
	}

	// Add formulas if we have any
	if h.hasFormulas {
		body.Data.Attributes.Formulas = h.formulas
	}

	// Set interval - use override from any query that has it, otherwise let Datadog auto-calculate
	for _, qm := range h.queryModels {
		if qm.Interval != nil && *qm.Interval > 0 {
			body.Data.Attributes.Interval = qm.Interval
			break // Use the first interval override found
		}
	}

	// Create context with timeout
	queryCtx, cancel := context.WithTimeout(h.ddCtx, 30*time.Second)
	defer cancel()

	// Call Datadog API
	resp, r, err := h.metricsApi.QueryTimeseriesData(queryCtx, body)
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

		// Return error for all queries using existing error handling patterns
		errorMsg := h.datasource.parseDatadogError(err, httpStatus, responseBody)
		for refID := range h.queryModels {
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, errorMsg)
		}
		return response, nil
	}

	// Process the response and create frames for each query/formula
	h.datasource.processTimeseriesResponse(&resp, h.queryModels, response)

	return response, nil
}