package plugin

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestMetricsHandler runs the queries through processQuery, as QueryData does.
func newTestMetricsHandler(t *testing.T, queries map[string]QueryModel, order ...string) *MetricsHandler {
	t.Helper()
	reqQueries := make([]backend.DataQuery, 0, len(order))
	for _, refID := range order {
		raw, err := json.Marshal(queries[refID])
		require.NoError(t, err)
		reqQueries = append(reqQueries, backend.DataQuery{RefID: refID, JSON: raw})
	}

	h := NewMetricsHandler(&Datasource{}, reqQueries, context.Background(), nil)
	for _, refID := range order {
		qm := queries[refID]
		qm.RefID = refID
		require.NoError(t, h.processQuery(&qm))
	}
	return h
}

func TestResponseRefIDs_FollowsRequestOrder(t *testing.T) {
	h := newTestMetricsHandler(t, map[string]QueryModel{
		"A": {QueryText: "avg:system.load.1{*}"},
		"B": {QueryText: "avg:system.cpu.user{*}"},
	}, "B", "A")

	assert.Equal(t, []string{"B", "A"}, h.responseRefIDs())
}

func TestResponseRefIDs_UsesFormulasWhenPresent(t *testing.T) {
	h := newTestMetricsHandler(t, map[string]QueryModel{
		"A": {QueryText: "avg:system.load.1{*}"},
		"B": {QueryText: "avg:system.cpu.user{*}"},
		"C": {Type: "math", Expression: "$A / $B"},
	}, "A", "B", "C")

	assert.Equal(t, []string{"C"}, h.responseRefIDs())
}
