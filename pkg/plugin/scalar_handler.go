package plugin

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ScalarHandler handles queries answered by Datadog's scalar endpoint
// (POST /api/v2/query/scalar): one value per group over the whole time range,
// such as a window-exact p95 or a unique count.
type ScalarHandler struct {
	datasource *Datasource
	queries    []QueryModel
	from       int64
	to         int64
	ddCtx      context.Context
	metricsApi *datadogV2.MetricsApi
}

// NewScalarHandler creates a new ScalarHandler instance
func NewScalarHandler(datasource *Datasource, queries []backend.DataQuery, ddCtx context.Context, metricsApi *datadogV2.MetricsApi) *ScalarHandler {
	var from, to int64
	if len(queries) > 0 {
		from = queries[0].TimeRange.From.UnixMilli()
		to = queries[0].TimeRange.To.UnixMilli()
	}

	return &ScalarHandler{
		datasource: datasource,
		from:       from,
		to:         to,
		ddCtx:      ddCtx,
		metricsApi: metricsApi,
	}
}

// processQuery queues a scalar query for execution
func (h *ScalarHandler) processQuery(qm *QueryModel) error {
	if qm.Hide {
		return nil
	}
	h.queries = append(h.queries, *qm)
	return nil
}

// executeQueries sends one request per query, so each query's groups come back
// in their own table even when queries in a panel group by different facets.
func (h *ScalarHandler) executeQueries(ctx context.Context) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()
	// Requests run one after another; run them in parallel if panels with many
	// scalar queries get slow
	for i := range h.queries {
		qm := &h.queries[i]
		response.Responses[qm.RefID] = h.executeQuery(qm)
	}
	return response, nil
}

func (h *ScalarHandler) executeQuery(qm *QueryModel) backend.DataResponse {
	logger := log.New()

	body := datadogV2.ScalarFormulaQueryRequest{
		Data: datadogV2.ScalarFormulaRequest{
			Type: datadogV2.SCALARFORMULAREQUESTTYPE_SCALAR_REQUEST,
			Attributes: datadogV2.ScalarFormulaRequestAttributes{
				From:    h.from,
				To:      h.to,
				Queries: []datadogV2.ScalarQuery{logAnalyticsScalarQuery(qm)},
			},
		},
	}

	queryCtx, cancel := context.WithTimeout(h.ddCtx, 30*time.Second)
	defer cancel()

	resp, r, err := h.metricsApi.QueryScalarData(queryCtx, body)
	if err != nil {
		// Debug, not Error: the request carries the user's log search
		requestBody, _ := json.MarshalIndent(body, "", "  ")
		logger.Debug("QueryScalarData request body", "request", string(requestBody))

		httpStatus := 0
		var responseBody string
		if r != nil {
			httpStatus = r.StatusCode
			if r.Body != nil {
				bodyBytes, _ := io.ReadAll(r.Body)
				responseBody = string(bodyBytes)
			}
		}

		logger.Error("QueryScalarData API call failed",
			"error", err,
			"httpStatus", httpStatus,
			"responseBody", responseBody)

		return backend.ErrDataResponse(backend.StatusBadRequest, h.datasource.parseDatadogError(err, httpStatus, responseBody))
	}

	return backend.DataResponse{Frames: data.Frames{h.scalarFrame(&resp, qm)}}
}

// scalarFrame turns a scalar response into a table frame: one string column
// per group, named as Datadog returns it (e.g. "@http.status_code"), and a
// value column named like the query's series would be.
func (h *ScalarHandler) scalarFrame(resp *datadogV2.ScalarFormulaQueryResponse, qm *QueryModel) *data.Frame {
	frame := data.NewFrame(qm.RefID)
	frame.RefID = qm.RefID

	var values []*float64
	if resp.Data != nil && resp.Data.Attributes != nil {
		for _, col := range resp.Data.Attributes.Columns {
			switch {
			case col.GroupScalarColumn != nil:
				// A group value is a list, as one log can carry several values of a facet
				groups := make([]string, len(col.GroupScalarColumn.Values))
				for i, v := range col.GroupScalarColumn.Values {
					groups[i] = strings.Join(v, ",")
				}
				frame.Fields = append(frame.Fields, data.NewField(col.GroupScalarColumn.GetName(), nil, groups))
			case col.DataScalarColumn != nil:
				values = col.DataScalarColumn.Values
			}
		}
	}

	// When nothing matches, Datadog sends an empty value column and no group
	// columns; add them empty so the table keeps the same columns, e.g. for a
	// join across queries
	if len(frame.Fields) == 0 && len(values) == 0 {
		for _, g := range qm.GroupBy {
			if g.Facet != "" {
				frame.Fields = append(frame.Fields, data.NewField(g.Facet, nil, []string{}))
			}
		}
	}

	valueField := data.NewField("Value", nil, values)
	valueField.Config = &data.FieldConfig{
		DisplayName: NewMetricsResponseParser(h.datasource).buildSeriesName(*qm, nil),
	}
	frame.Fields = append(frame.Fields, valueField)
	return frame
}
