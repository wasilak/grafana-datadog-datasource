package plugin

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogsVolumeHandler_calculateBucketSize(t *testing.T) {
	datasource := &Datasource{}
	handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{}, context.Background())

	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"30 minutes", 30 * time.Minute, "1m"},
		{"1 hour", time.Hour, "1m"},
		{"3 hours", 3 * time.Hour, "5m"},
		{"6 hours", 6 * time.Hour, "5m"},
		{"12 hours", 12 * time.Hour, "15m"},
		{"24 hours", 24 * time.Hour, "15m"},
		{"3 days", 3 * 24 * time.Hour, "1h"},
		{"7 days", 7 * 24 * time.Hour, "1h"},
		{"30 days", 30 * 24 * time.Hour, "4h"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := time.Now()
			timeRange := backend.TimeRange{
				From: now.Add(-tt.duration),
				To:   now,
			}
			
			result := handler.calculateBucketSize(timeRange)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestLogsVolumeHandler_processQuery(t *testing.T) {
	datasource := &Datasource{}
	
	// Create a mock backend query
	queryModel := QueryModel{
		LogQuery:  "service:web-server",
		QueryType: "logs-volume",
		Hide:      false,
	}
	
	queryJSON, err := json.Marshal(queryModel)
	require.NoError(t, err)
	
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

func TestLogsVolumeHandler_parseBucketInterval(t *testing.T) {
	datasource := &Datasource{}
	handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{}, context.Background())

	tests := []struct {
		interval string
		expected time.Duration
		hasError bool
	}{
		{"1m", time.Minute, false},
		{"5m", 5 * time.Minute, false},
		{"15m", 15 * time.Minute, false},
		{"1h", time.Hour, false},
		{"4h", 4 * time.Hour, false},
		{"invalid", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.interval, func(t *testing.T) {
			result, err := handler.parseBucketInterval(tt.interval)
			
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestLogsVolumeHandler_createLogsVolumeDataFrame(t *testing.T) {
	datasource := &Datasource{}
	handler := NewLogsVolumeHandler(datasource, []backend.DataQuery{}, context.Background())

	// Create mock aggregation response
	now := time.Now()
	response := &LogsAggregationResponse{
		Data: LogsAggregationResponseData{
			Buckets: []LogsAggregationBucket{
				{
					By:    LogsAggregationBucketBy{Timestamp: now.Add(-2 * time.Minute).Format(time.RFC3339)},
					Count: 10,
				},
				{
					By:    LogsAggregationBucketBy{Timestamp: now.Add(-time.Minute).Format(time.RFC3339)},
					Count: 15,
				},
				{
					By:    LogsAggregationBucketBy{Timestamp: now.Format(time.RFC3339)},
					Count: 8,
				},
			},
		},
	}

	frame := handler.createLogsVolumeDataFrame(response, "1m", "A")

	t.Run("should create frame with correct structure", func(t *testing.T) {
		assert.Equal(t, "logs-volume", frame.Name)
		assert.Equal(t, "log-volume-A", frame.RefID)
		assert.Len(t, frame.Fields, 2)
		
		// Check field names
		assert.Equal(t, "Time", frame.Fields[0].Name)
		assert.Equal(t, "Count", frame.Fields[1].Name)
		
		// Check field lengths
		assert.Equal(t, 3, frame.Fields[0].Len())
		assert.Equal(t, 3, frame.Fields[1].Len())
	})

	t.Run("should have correct metadata", func(t *testing.T) {
		require.NotNil(t, frame.Meta)
		assert.Equal(t, "graph", string(frame.Meta.PreferredVisualization))
		
		// Check custom metadata
		custom, ok := frame.Meta.Custom.(map[string]interface{})
		require.True(t, ok, "Custom metadata should be a map")
		assert.Equal(t, "1m", custom["bucketSize"])
	})
}