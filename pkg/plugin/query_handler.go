package plugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// QueryHandler defines the interface for handling different types of queries
// Following OpenSearch's clean handler separation pattern
type QueryHandler interface {
	// processQuery processes a single query and prepares it for execution
	processQuery(q *QueryModel) error
	
	// executeQueries executes all processed queries and returns the response
	executeQueries(ctx context.Context) (*backend.QueryDataResponse, error)
}

// QueryType represents the type of query being processed
type QueryType string

const (
	// MetricsQueryType represents Datadog metrics queries
	MetricsQueryType QueryType = "metrics"
	
	// LogsQueryType represents Datadog logs queries
	// Note: logs-volume queries are also handled by LogsHandler since volume
	// is calculated from log entries (no separate API call needed)
	LogsQueryType QueryType = "logs"
)

// detectQueryType determines the query type based on the QueryModel
// Requirements: 2.1, 2.2, 2.5
func detectQueryType(qm *QueryModel) QueryType {
	// Explicit query type takes precedence
	if qm.QueryType != "" {
		switch qm.QueryType {
		case "logs", "logs-volume":
			// Both logs and logs-volume are handled by LogsHandler
			// Volume histogram is calculated from log entries
			return LogsQueryType
		case "metrics":
			return MetricsQueryType
		}
	}
	
	// Infer from query content
	if qm.LogQuery != "" {
		return LogsQueryType
	}
	
	// Default to metrics for backward compatibility
	return MetricsQueryType
}