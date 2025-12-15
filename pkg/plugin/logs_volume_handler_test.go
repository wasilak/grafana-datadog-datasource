package plugin

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func TestLogsVolumeHandler_processQuery(t *testing.T) {
	datasource := &Datasource{}

	// Create a mock backend query
	queryModel := QueryModel{
		LogQuery:  "service:web-server",
		QueryType: "logs-volume",
		Hide:      false,
	}

	queryJSON, err := json.Marshal(queryModel)
	if err != nil {
		t.Fatal(err)
	}

	backendQuery := backend.DataQuery{
		RefID: "A",
		JSON:  queryJSON,
		TimeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour),
			To:   time.Now(),
		},
	}

	handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{backendQuery}, context.Background())

	t.Run("should process valid logs volume query", func(t *testing.T) {
		err := handler.processQuery(&queryModel)
		assert.NoError(t, err)
		assert.Len(t, handler.volumeQueries, 1)
		assert.Contains(t, handler.queryModels, "A")
	})

	t.Run("should skip hidden queries", func(t *testing.T) {
		hiddenQuery := queryModel
		hiddenQuery.Hide = true

		handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{backendQuery}, context.Background())
		err := handler.processQuery(&hiddenQuery)
		assert.NoError(t, err)
		assert.Len(t, handler.volumeQueries, 0)
	})

	t.Run("should reject empty log query", func(t *testing.T) {
		emptyQuery := queryModel
		emptyQuery.LogQuery = ""

		handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{backendQuery}, context.Background())
		err := handler.processQuery(&emptyQuery)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "logs volume query cannot be empty")
	})
}

func TestLogsVolumeHandler_executeQueries_EmptyCache(t *testing.T) {
	datasource := &Datasource{
		logsCache: make(map[string]*LogsCacheEntry),
	}

	// Create a mock backend query
	queryModel := QueryModel{
		LogQuery:  "service:web-server",
		QueryType: "logs-volume",
		Hide:      false,
	}

	queryJSON, err := json.Marshal(queryModel)
	if err != nil {
		t.Fatal(err)
	}

	backendQuery := backend.DataQuery{
		RefID: "A",
		JSON:  queryJSON,
		TimeRange: backend.TimeRange{
			From: time.Now().Add(-time.Hour),
			To:   time.Now(),
		},
	}

	handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{backendQuery}, context.Background())

	// Process the query
	err = handler.processQuery(&queryModel)
	assert.NoError(t, err)

	// Execute queries - should return empty frame since cache is empty
	response, err := handler.executeQueries(context.Background())
	assert.NoError(t, err)
	assert.NotNil(t, response)

	// Should have a response for refID "A"
	dataResponse, exists := response.Responses["A"]
	assert.True(t, exists)
	assert.Nil(t, dataResponse.Error)

	// Should have an empty volume frame
	assert.Len(t, dataResponse.Frames, 1)
	frame := dataResponse.Frames[0]
	assert.Equal(t, "logs-volume", frame.Name)
	assert.Equal(t, "log-volume-A", frame.RefID)
}

func TestLogsVolumeHandler_NoQueries(t *testing.T) {
	datasource := &Datasource{}
	handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{}, context.Background())

	// Execute with no queries
	response, err := handler.executeQueries(context.Background())
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.Empty(t, response.Responses)
}
