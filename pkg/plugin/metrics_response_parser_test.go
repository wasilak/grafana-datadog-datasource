package plugin

import (
	"testing"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestParser returns a MetricsResponseParser backed by a minimal Datasource stub.
func newTestParser() *MetricsResponseParser {
	ds := &Datasource{
		SecureJSONData: map[string]string{},
	}
	return NewMetricsResponseParser(ds)
}

// newTimeseriesResponse builds a TimeseriesFormulaQueryResponse with the given series
// and times/values. Pass nil series to create a response with no Data field.
func newTimeseriesResponse(
	series []datadogV2.TimeseriesResponseSeries,
	times []int64,
	values [][]*float64,
) *datadogV2.TimeseriesFormulaQueryResponse {
	resp := datadogV2.NewTimeseriesFormulaQueryResponse()
	inner := datadogV2.NewTimeseriesResponse()
	respType := datadogV2.TIMESERIESFORMULARESPONSETYPE_TIMESERIES_RESPONSE
	inner.SetType(respType)
	attrs := datadogV2.NewTimeseriesResponseAttributes()
	if series != nil {
		attrs.SetSeries(series)
	}
	if times != nil {
		attrs.SetTimes(times)
	}
	if values != nil {
		attrs.SetValues(values)
	}
	inner.SetAttributes(*attrs)
	resp.SetData(*inner)
	return resp
}

// -------------------------------------------------------------------------
// ParseTimeseriesResponse — nil / empty guard tests
// -------------------------------------------------------------------------

func TestParseTimeseriesResponse_NilResponse(t *testing.T) {
	p := newTestParser()
	qm := map[string]QueryModel{"A": {QueryText: "avg:system.cpu.user{*}"}}
	resp := backend.NewQueryDataResponse()

	err := p.ParseTimeseriesResponse(nil, qm, resp)

	require.Error(t, err, "nil response should return an error")
	assert.Contains(t, err.Error(), "nil", "error should mention nil")

	// Every query should have an error response, not a crash.
	require.Contains(t, resp.Responses, "A")
	assert.Error(t, resp.Responses["A"].Error)
}

func TestParseTimeseriesResponse_EmptySeries(t *testing.T) {
	p := newTestParser()
	qm := map[string]QueryModel{"A": {QueryText: "avg:system.cpu.user{*}"}}
	resp := backend.NewQueryDataResponse()

	ts := newTimeseriesResponse([]datadogV2.TimeseriesResponseSeries{}, nil, nil)

	err := p.ParseTimeseriesResponse(ts, qm, resp)
	require.NoError(t, err, "empty series should not return an error")

	// Each refID should receive an empty frame response.
	require.Contains(t, resp.Responses, "A")
	assert.NoError(t, resp.Responses["A"].Error)
}

func TestParseTimeseriesResponse_NilQueryIndex(t *testing.T) {
	p := newTestParser()
	qm := map[string]QueryModel{"A": {QueryText: "avg:system.cpu.user{*}"}}
	resp := backend.NewQueryDataResponse()

	// Series entry with QueryIndex == nil — must not panic.
	series := datadogV2.TimeseriesResponseSeries{}
	// Do NOT set QueryIndex: it is nil by default.

	val := 1.0
	ts := newTimeseriesResponse(
		[]datadogV2.TimeseriesResponseSeries{series},
		[]int64{1000},
		[][]*float64{{&val}},
	)

	err := p.ParseTimeseriesResponse(ts, qm, resp)

	// Should return no error — the nil-QueryIndex series is simply skipped.
	require.NoError(t, err, "nil QueryIndex should be skipped gracefully, not panic")
}

// -------------------------------------------------------------------------
// ValidateResponse
// -------------------------------------------------------------------------

func TestValidateResponse_Nil(t *testing.T) {
	p := newTestParser()
	err := p.ValidateResponse(nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestValidateResponse_EmptySeries(t *testing.T) {
	p := newTestParser()
	ts := newTimeseriesResponse([]datadogV2.TimeseriesResponseSeries{}, nil, nil)

	err := p.ValidateResponse(ts)
	require.Error(t, err, "empty series should be reported as invalid")
}

func TestValidateResponse_ValidResponse(t *testing.T) {
	p := newTestParser()

	var idx int32 = 0
	series := datadogV2.TimeseriesResponseSeries{}
	series.SetQueryIndex(idx)

	val := 42.0
	ts := newTimeseriesResponse(
		[]datadogV2.TimeseriesResponseSeries{series},
		[]int64{1000, 2000},
		[][]*float64{{&val, &val}},
	)

	err := p.ValidateResponse(ts)
	require.NoError(t, err, "valid response should pass validation")
}

// -------------------------------------------------------------------------
// SanitizeMetricName
// -------------------------------------------------------------------------

func TestSanitizeMetricName(t *testing.T) {
	p := newTestParser()

	tests := []struct {
		input    string
		expected string
	}{
		{"system.cpu.user", "system.cpu.user"},
		{"  spaces  ", "spaces"},
		{"metric with spaces", "metric_with_spaces"},
		{"", ""},
		{"1starts_with_digit", "metric_1starts_with_digit"},
		{"valid-metric_name:tag", "valid-metric_name:tag"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := p.SanitizeMetricName(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// -------------------------------------------------------------------------
// FormatMetricValue
// -------------------------------------------------------------------------

func TestFormatMetricValue_Nil(t *testing.T) {
	p := newTestParser()
	assert.Equal(t, "null", p.FormatMetricValue(nil))
}

func TestFormatMetricValue_Integer(t *testing.T) {
	p := newTestParser()
	v := 42.0
	assert.Equal(t, "42", p.FormatMetricValue(&v))
}

func TestFormatMetricValue_Float(t *testing.T) {
	p := newTestParser()
	v := 3.14159
	result := p.FormatMetricValue(&v)
	assert.NotEmpty(t, result)
	assert.NotEqual(t, "null", result)
}

// -------------------------------------------------------------------------
// CreateEmptyResponse
// -------------------------------------------------------------------------

func TestCreateEmptyResponse(t *testing.T) {
	p := newTestParser()
	qm := map[string]QueryModel{
		"A": {QueryText: "avg:system.cpu.user{*}", Hide: false},
		"B": {QueryText: "avg:system.mem.used{*}", Hide: true},
	}

	resp := p.CreateEmptyResponse(qm)
	require.NotNil(t, resp)

	// Visible query should get an empty frame.
	aResp, ok := resp.Responses["A"]
	require.True(t, ok)
	require.Len(t, aResp.Frames, 1)

	// Hidden query should get an empty DataResponse with no frames.
	bResp, ok := resp.Responses["B"]
	require.True(t, ok)
	assert.Empty(t, bResp.Frames)
}
