package plugin

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// decodeQuery decodes a query the way QueryData does.
func decodeQuery(t *testing.T, refID, raw string) *QueryModel {
	t.Helper()
	var qm QueryModel
	require.NoError(t, json.Unmarshal([]byte(raw), &qm))
	qm.RefID = refID
	return &qm
}

// marshalQuery returns the JSON a timeseries query sends to Datadog.
func marshalQuery(t *testing.T, q datadogV2.TimeseriesQuery) map[string]interface{} {
	t.Helper()
	raw, err := json.Marshal(q)
	require.NoError(t, err)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &out))
	return out
}

// -------------------------------------------------------------------------
// Request building
// -------------------------------------------------------------------------

func TestLogAnalyticsTimeseriesQuery_GroupedPercentile(t *testing.T) {
	qm := decodeQuery(t, "A", `{
		"queryType": "log-analytics",
		"logQuery": "service:web @duration_ms:*",
		"compute": {"aggregation": "pc90", "metric": "@duration_ms"},
		"groupBy": [{"facet": "@http.status_code", "limit": 20}]
	}`)

	out := marshalQuery(t, logAnalyticsTimeseriesQuery(qm))

	assert.Equal(t, "logs", out["data_source"])
	assert.Equal(t, "A", out["name"])
	assert.Equal(t, map[string]interface{}{"aggregation": "pc90", "metric": "@duration_ms"}, out["compute"])
	assert.Equal(t, map[string]interface{}{"query": "service:web @duration_ms:*"}, out["search"])
	// Groups are ranked by the query's own compute when no sort is given
	assert.Equal(t, []interface{}{map[string]interface{}{
		"facet": "@http.status_code",
		"limit": float64(20),
		"sort":  map[string]interface{}{"aggregation": "pc90", "metric": "@duration_ms", "order": "desc"},
	}}, out["group_by"])
}

func TestLogAnalyticsParts_Defaults(t *testing.T) {
	qm := decodeQuery(t, "A", `{"queryType": "log-analytics", "groupBy": [{"facet": "service"}]}`)

	compute, groupBy, search := logAnalyticsParts(qm)

	assert.Equal(t, datadogV2.EVENTSAGGREGATION_COUNT, compute.Aggregation)
	assert.Nil(t, compute.Metric)
	assert.Equal(t, "*", search.GetQuery())
	require.Len(t, groupBy, 1)
	assert.Equal(t, datadogV2.EVENTSAGGREGATION_COUNT, groupBy[0].Sort.Aggregation)
	assert.Equal(t, datadogV2.QUERYSORTORDER_DESC, groupBy[0].Sort.GetOrder())
	// The query model itself is left untouched
	assert.Nil(t, qm.GroupBy[0].Sort)
}

func TestLogAnalyticsParts_KeepsExplicitSort(t *testing.T) {
	qm := decodeQuery(t, "A", `{
		"queryType": "log-analytics",
		"compute": {"aggregation": "avg", "metric": "@duration_ms"},
		"groupBy": [{"facet": "service", "sort": {"aggregation": "count", "order": "asc"}}]
	}`)

	_, groupBy, _ := logAnalyticsParts(qm)

	assert.Equal(t, datadogV2.EVENTSAGGREGATION_COUNT, groupBy[0].Sort.Aggregation)
	assert.Equal(t, datadogV2.QUERYSORTORDER_ASC, groupBy[0].Sort.GetOrder())
}

func TestLogAnalyticsTimeseriesQuery_UnknownAggregationPassesThrough(t *testing.T) {
	// Datadog decides which aggregations are valid, so values the client
	// doesn't know yet reach Datadog unchanged
	qm := decodeQuery(t, "A", `{"queryType": "log-analytics", "compute": {"aggregation": "pc50", "metric": "@duration_ms"}}`)

	out := marshalQuery(t, logAnalyticsTimeseriesQuery(qm))

	assert.Equal(t, map[string]interface{}{"aggregation": "pc50", "metric": "@duration_ms"}, out["compute"])
}

func TestLogAnalyticsLabel(t *testing.T) {
	assert.Equal(t, "count", logAnalyticsLabel(&QueryModel{}))
	assert.Equal(t, "pc95(@duration_ms)", logAnalyticsLabel(decodeQuery(t, "A", `{"compute": {"aggregation": "pc95", "metric": "@duration_ms"}}`)))
	assert.Equal(t, "cardinality(@usr.id)", logAnalyticsLabel(decodeQuery(t, "A", `{"compute": {"aggregation": "cardinality", "metric": "@usr.id"}}`)))
}

// -------------------------------------------------------------------------
// Routing and refIDs
// -------------------------------------------------------------------------

func TestDetectQueryType_LogAnalytics(t *testing.T) {
	assert.Equal(t, MetricsQueryType, detectQueryType(&QueryModel{QueryType: LogAnalyticsQueryType}))
	assert.Equal(t, MetricsQueryType, detectQueryType(&QueryModel{QueryType: LogAnalyticsQueryType, ResponseFormat: "timeseries"}))
	assert.Equal(t, ScalarQueryType, detectQueryType(&QueryModel{QueryType: LogAnalyticsQueryType, ResponseFormat: "scalar"}))
	// A Log Analytics search is not a raw logs query
	assert.Equal(t, MetricsQueryType, detectQueryType(&QueryModel{QueryType: LogAnalyticsQueryType, LogQuery: "service:web"}))
}

func TestMetricsHandler_TwoLogAnalyticsQueriesKeepTheirRefIDs(t *testing.T) {
	h := NewMetricsHandler(&Datasource{}, []backend.DataQuery{}, context.Background(), nil)

	// Same search, different aggregations: both have an empty queryText
	require.NoError(t, h.processQuery(decodeQuery(t, "A", `{"queryType": "log-analytics", "logQuery": "service:web"}`)))
	require.NoError(t, h.processQuery(decodeQuery(t, "B", `{"queryType": "log-analytics", "logQuery": "service:web", "compute": {"aggregation": "pc95", "metric": "@duration_ms"}}`)))

	require.Len(t, h.metricsQueries, 2)
	assert.Equal(t, "A", h.metricsQueries[0].EventsTimeseriesQuery.GetName())
	assert.Equal(t, "B", h.metricsQueries[1].EventsTimeseriesQuery.GetName())
	assert.Contains(t, h.queryModels, "A")
	assert.Contains(t, h.queryModels, "B")
}

// -------------------------------------------------------------------------
// Timeseries responses
// -------------------------------------------------------------------------

func TestParseTimeseriesResponse_LogAnalyticsNames(t *testing.T) {
	p := newTestParser()
	idx := int32(0)
	val := 120.0
	ts := newTimeseriesResponse(
		[]datadogV2.TimeseriesResponseSeries{{GroupTags: []string{"@http.status_code:500"}, QueryIndex: &idx}},
		[]int64{1700000000000},
		[][]*float64{{&val}},
	)

	tests := []struct {
		name     string
		query    string
		expected string
	}{
		{"auto legend", `{"queryType": "log-analytics", "compute": {"aggregation": "pc95", "metric": "@duration_ms"}}`, "pc95(@duration_ms) {@http.status_code:500}"},
		{"template with @", `{"queryType": "log-analytics", "legendMode": "custom", "legendTemplate": "status {{@http.status_code}}"}`, "status 500"},
		{"template without @", `{"queryType": "log-analytics", "legendMode": "custom", "legendTemplate": "status {{http.status_code}}"}`, "status 500"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			qm := map[string]QueryModel{"A": *decodeQuery(t, "A", tt.query)}
			resp := backend.NewQueryDataResponse()

			require.NoError(t, p.ParseTimeseriesResponse(ts, qm, []string{"A"}, resp))

			require.Len(t, resp.Responses["A"].Frames, 1)
			frame := resp.Responses["A"].Frames[0]
			assert.Equal(t, tt.expected, frame.Name)
			assert.Equal(t, "500", frame.Fields[1].Labels["@http.status_code"])
		})
	}
}

// -------------------------------------------------------------------------
// Scalar responses
// -------------------------------------------------------------------------

// newScalarResponse builds a scalar response from the given columns.
func newScalarResponse(columns ...datadogV2.ScalarColumn) *datadogV2.ScalarFormulaQueryResponse {
	return &datadogV2.ScalarFormulaQueryResponse{
		Data: &datadogV2.ScalarResponse{
			Attributes: &datadogV2.ScalarFormulaResponseAtrributes{Columns: columns},
		},
	}
}

func groupColumn(name string, values ...[]string) datadogV2.ScalarColumn {
	return datadogV2.ScalarColumn{GroupScalarColumn: &datadogV2.GroupScalarColumn{Name: &name, Values: values}}
}

func dataColumn(name string, values ...float64) datadogV2.ScalarColumn {
	ptrs := make([]*float64, len(values))
	for i := range values {
		ptrs[i] = &values[i]
	}
	return datadogV2.ScalarColumn{DataScalarColumn: &datadogV2.DataScalarColumn{Name: &name, Values: ptrs}}
}

func TestScalarFrame_Grouped(t *testing.T) {
	h := &ScalarHandler{datasource: &Datasource{}}
	qm := decodeQuery(t, "A", `{"queryType": "log-analytics", "responseFormat": "scalar", "compute": {"aggregation": "cardinality", "metric": "@usr.id"}}`)
	resp := newScalarResponse(
		groupColumn("@http.status_code", []string{"200"}, []string{"500"}),
		groupColumn("service", []string{"web"}, []string{"api", "web"}),
		dataColumn("A", 42, 7),
	)

	frame := h.scalarFrame(resp, qm)

	assert.Equal(t, "A", frame.RefID)
	require.Len(t, frame.Fields, 3)
	assert.Equal(t, "@http.status_code", frame.Fields[0].Name)
	assert.Equal(t, "500", frame.Fields[0].At(1))
	assert.Equal(t, "service", frame.Fields[1].Name)
	assert.Equal(t, "api,web", frame.Fields[1].At(1))
	assert.Equal(t, 7.0, *frame.Fields[2].At(1).(*float64))
	assert.Equal(t, "cardinality(@usr.id)", frame.Fields[2].Config.DisplayName)
}

func TestScalarFrame_UngroupedWithCustomLegend(t *testing.T) {
	h := &ScalarHandler{datasource: &Datasource{}}
	qm := decodeQuery(t, "B", `{"queryType": "log-analytics", "responseFormat": "scalar", "legendMode": "custom", "legendTemplate": "errors"}`)

	frame := h.scalarFrame(newScalarResponse(dataColumn("B", 3)), qm)

	require.Len(t, frame.Fields, 1)
	assert.Equal(t, 1, frame.Rows())
	assert.Equal(t, "errors", frame.Fields[0].Config.DisplayName)
}

func TestScalarFrame_EmptyResponse(t *testing.T) {
	h := &ScalarHandler{datasource: &Datasource{}}

	frame := h.scalarFrame(&datadogV2.ScalarFormulaQueryResponse{}, decodeQuery(t, "A", `{"queryType": "log-analytics"}`))

	require.Len(t, frame.Fields, 1)
	assert.Equal(t, 0, frame.Rows())
}

func TestScalarFrame_EmptyGroupedResponseKeepsGroupColumns(t *testing.T) {
	h := &ScalarHandler{datasource: &Datasource{}}
	qm := decodeQuery(t, "A", `{"queryType": "log-analytics", "responseFormat": "scalar", "groupBy": [{"facet": "@http.status_code"}, {"facet": "service"}]}`)

	frame := h.scalarFrame(newScalarResponse(dataColumn("A")), qm)

	require.Len(t, frame.Fields, 3)
	assert.Equal(t, "@http.status_code", frame.Fields[0].Name)
	assert.Equal(t, "service", frame.Fields[1].Name)
	assert.Equal(t, 0, frame.Rows())
}

func TestScalarFrame_ValuesWithoutGroupColumnsStayValid(t *testing.T) {
	h := &ScalarHandler{datasource: &Datasource{}}
	qm := decodeQuery(t, "A", `{"queryType": "log-analytics", "responseFormat": "scalar", "groupBy": [{"facet": "@http.status_code"}]}`)

	// Empty group columns next to two values would give fields of different
	// lengths, which Grafana rejects
	frame := h.scalarFrame(newScalarResponse(dataColumn("A", 5, 3)), qm)

	require.Len(t, frame.Fields, 1)
	assert.Equal(t, 2, frame.Rows())
}

func TestLogAnalytics_SkipsGroupByRowsWithoutFacet(t *testing.T) {
	// The editor saves a group-by row before its facet is filled in
	qm := decodeQuery(t, "A", `{"queryType": "log-analytics", "responseFormat": "scalar", "groupBy": [{"facet": ""}, {"facet": "service"}]}`)

	_, groupBy, _ := logAnalyticsParts(qm)
	require.Len(t, groupBy, 1)
	assert.Equal(t, "service", groupBy[0].Facet)

	h := &ScalarHandler{datasource: &Datasource{}}
	frame := h.scalarFrame(newScalarResponse(dataColumn("A")), qm)
	require.Len(t, frame.Fields, 2)
	assert.Equal(t, "service", frame.Fields[0].Name)
}
