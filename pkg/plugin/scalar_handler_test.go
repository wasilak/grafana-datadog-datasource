package plugin

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricsScalarQuery(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		expected map[string]interface{}
	}{
		{
			// Sent as written: no "by {*}" added, so an overall total stays one row
			"ungrouped, default aggregator",
			`{"queryText": "sum:http.requests{env:prod}", "responseFormat": "scalar"}`,
			map[string]interface{}{"data_source": "metrics", "name": "A", "query": "sum:http.requests{env:prod}", "aggregator": "avg"},
		},
		{
			"grouped, explicit aggregator",
			`{"queryText": "sum:http.errors{*} by {host}", "responseFormat": "scalar", "aggregator": "sum"}`,
			map[string]interface{}{"data_source": "metrics", "name": "A", "query": "sum:http.errors{*} by {host}", "aggregator": "sum"},
		},
		{
			// Datadog decides which aggregators are valid
			"unknown aggregator passes through",
			`{"queryText": "avg:system.load.1{*}", "responseFormat": "scalar", "aggregator": "percentile"}`,
			map[string]interface{}{"data_source": "metrics", "name": "A", "query": "avg:system.load.1{*}", "aggregator": "percentile"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw, err := json.Marshal(metricsScalarQuery(decodeQuery(t, "A", tt.query)))
			require.NoError(t, err)

			var out map[string]interface{}
			require.NoError(t, json.Unmarshal(raw, &out))
			assert.Equal(t, tt.expected, out)
		})
	}
}

func TestDetectQueryType_MetricsScalar(t *testing.T) {
	assert.Equal(t, ScalarQueryType, detectQueryType(&QueryModel{QueryType: "metrics", ResponseFormat: "scalar"}))
	assert.Equal(t, ScalarQueryType, detectQueryType(&QueryModel{QueryText: "avg:system.load.1{*}", ResponseFormat: "scalar"}))
	assert.Equal(t, MetricsQueryType, detectQueryType(&QueryModel{QueryType: "metrics", ResponseFormat: "timeseries"}))
	assert.Equal(t, MetricsQueryType, detectQueryType(&QueryModel{QueryType: "metrics"}))
}

func TestScalarFrame_GroupedMetrics(t *testing.T) {
	h := &ScalarHandler{datasource: &Datasource{}}
	qm := decodeQuery(t, "A", `{"queryType": "metrics", "queryText": "sum:http.errors{*} by {host}", "responseFormat": "scalar", "aggregator": "sum"}`)
	resp := newScalarResponse(
		groupColumn("host", []string{"web-1"}, []string{"web-2"}),
		dataColumn("A", 12, 3),
	)

	frame := h.scalarFrame(resp, qm)

	require.Len(t, frame.Fields, 2)
	assert.Equal(t, "host", frame.Fields[0].Name)
	assert.Equal(t, "web-2", frame.Fields[0].At(1))
	assert.Equal(t, 12.0, *frame.Fields[1].At(0).(*float64))
	assert.Equal(t, "sum:http.errors{*} by {host}", frame.Fields[1].Config.DisplayName)
}
