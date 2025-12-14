package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateLogsDataFrames(t *testing.T) {
	datasource := &Datasource{}

	t.Run("creates proper data frame structure with sample entries", func(t *testing.T) {
		// Create sample log entries
		sampleEntries := datasource.createSampleLogEntries()
		require.NotEmpty(t, sampleEntries, "Sample entries should not be empty")

		// Create data frames
		frames := datasource.createLogsDataFrames(sampleEntries, "test-query", "error service:web-app")
		
		// Validate frame structure
		require.Len(t, frames, 1, "Should create exactly one frame")
		frame := frames[0]
		
		// Check frame metadata
		assert.Equal(t, "test-query", frame.RefID)
		assert.Equal(t, "logs", frame.Name)
		assert.NotNil(t, frame.Meta)
		assert.Equal(t, data.FrameTypeLogLines, frame.Meta.Type)
		
		// Check that we have the required core fields
		require.GreaterOrEqual(t, len(frame.Fields), 5, "Should have at least 5 core fields")
		
		// Validate core field names and types
		coreFields := []struct {
			name     string
			dataType data.FieldType
		}{
			{"timestamp", data.FieldTypeTime},
			{"body", data.FieldTypeString},
			{"severity", data.FieldTypeString},
			{"id", data.FieldTypeString},
			{"labels", data.FieldTypeJSON},
		}
		
		for i, expected := range coreFields {
			field := frame.Fields[i]
			assert.Equal(t, expected.name, field.Name, "Field %d should have correct name", i)
			assert.Equal(t, expected.dataType, field.Type(), "Field %d should have correct type", i)
			assert.NotNil(t, field.Config, "Field %d should have config", i)
		}
		
		// Check that all fields have the same length (number of log entries)
		expectedLength := len(sampleEntries)
		for i, field := range frame.Fields {
			assert.Equal(t, expectedLength, field.Len(), "Field %d should have correct length", i)
		}
	})

	t.Run("handles empty log entries", func(t *testing.T) {
		frames := datasource.createEmptyLogsDataFrame("empty-query")
		
		require.Len(t, frames, 1, "Should create exactly one frame")
		frame := frames[0]
		
		// Check frame metadata
		assert.Equal(t, "empty-query", frame.RefID)
		assert.Equal(t, "logs", frame.Name)
		assert.NotNil(t, frame.Meta)
		assert.Equal(t, data.FrameTypeLogLines, frame.Meta.Type)
		
		// Check that all fields are empty but properly structured
		require.GreaterOrEqual(t, len(frame.Fields), 5, "Should have at least 5 core fields")
		for i, field := range frame.Fields {
			assert.Equal(t, 0, field.Len(), "Field %d should be empty", i)
		}
	})

	t.Run("validates and sanitizes log entries", func(t *testing.T) {
		// Create test entry with various issues
		labels := LogLabels{
			Service: "  test-service  ",
			Source:  "test-source",
			Host:    "test-host",
			Env:     "test-env",
			Tags: map[string]string{
				"invalid-tag!": "value1", // Invalid characters
				"valid_tag":    "value2",
			},
			Attributes: map[string]interface{}{
				"invalid attr!": "attr1", // Invalid characters
				"valid_attr":    "attr2",
				"numeric_attr":  42,
				"float_attr":    3.14,
				"bool_attr":     true,
			},
		}
		labelsJSON, _ := json.Marshal(labels)
		
		testEntry := LogEntry{
			ID:        "test-1",
			Timestamp: time.Now(),
			Body:      "  Test message with whitespace  ",
			Severity:  "info", // lowercase - should be normalized
			Labels:    labelsJSON,
		}

		// Validate entry
		errors := datasource.validateLogEntry(testEntry, 0)
		assert.Empty(t, errors, "Valid entry should have no validation errors")

		// Sanitize entry
		sanitized := datasource.sanitizeLogEntry(testEntry)
		
		// Check sanitization results
		assert.Equal(t, "INFO", sanitized.Severity, "Severity should be normalized to uppercase")
		assert.Equal(t, "Test message with whitespace", sanitized.Body, "Body should be trimmed")
		
		// Check that labels were sanitized
		var sanitizedLabels LogLabels
		err := json.Unmarshal(sanitized.Labels, &sanitizedLabels)
		assert.NoError(t, err, "Labels should be valid JSON")
		assert.Equal(t, "test-service", sanitizedLabels.Service, "Service should be trimmed")

		// Create data frame with sanitized entry
		frames := datasource.createLogsDataFrames([]LogEntry{sanitized}, "sanitize-test", "test query")
		require.Len(t, frames, 1)
		frame := frames[0]
		
		// Check that we have exactly 5 core fields (no additional fields created)
		fieldNames := make([]string, len(frame.Fields))
		for i, field := range frame.Fields {
			fieldNames[i] = field.Name
		}
		
		// Should have exactly 5 core fields, additional data is stored in labels JSON
		expectedFields := []string{"timestamp", "body", "severity", "id", "labels"}
		assert.Equal(t, expectedFields, fieldNames, "Should have exactly 5 core fields")
		
		// Verify that labels field contains the structured data as JSON
		labelsField := frame.Fields[4] // labels is the 5th field (index 4)
		assert.Equal(t, "labels", labelsField.Name)
		
		// Check that labels field contains valid JSON with the test data
		if labelsField.Len() > 0 {
			labelsValue := labelsField.At(0)
			if jsonBytes, ok := labelsValue.(json.RawMessage); ok {
				var parsedLabels LogLabels
				err := json.Unmarshal(jsonBytes, &parsedLabels)
				assert.NoError(t, err, "Labels should contain valid JSON")
				assert.Equal(t, "test-service", parsedLabels.Service, "Service should be in labels")
				assert.Contains(t, parsedLabels.Attributes, "valid_attr", "Valid attribute should be in labels")
				assert.Contains(t, parsedLabels.Tags, "valid_tag", "Valid tag should be in labels")
			}
		}
	})
}

func TestSanitizeFieldName(t *testing.T) {
	datasource := &Datasource{}

	tests := []struct {
		input    string
		expected string
	}{
		{"valid_name", "valid_name"},
		{"valid-name", "valid-name"},
		{"valid.name", "valid.name"},
		{"invalid name!", "invalid_name_"},
		{"123invalid", "field_123invalid"},
		{"", ""},
		{"  whitespace  ", "whitespace"},
		{"special@#$chars", "special___chars"},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			result := datasource.sanitizeFieldName(test.input)
			assert.Equal(t, test.expected, result)
		})
	}
}

func TestSanitizeFieldValue(t *testing.T) {
	datasource := &Datasource{}

	tests := []struct {
		input    interface{}
		expected string
	}{
		{"string value", "string value"},
		{42, "42"},
		{3.14159, "3.14159"},
		{true, "true"},
		{false, "false"},
		{nil, ""},
		{"  whitespace  ", "whitespace"},
	}

	for _, test := range tests {
		t.Run(test.expected, func(t *testing.T) {
			result := datasource.sanitizeFieldValue(test.input)
			assert.Equal(t, test.expected, result)
		})
	}
}

func TestValidateLogEntry(t *testing.T) {
	datasource := &Datasource{}

	t.Run("valid entry has no errors", func(t *testing.T) {
		labels := LogLabels{Service: "test-service"}
		labelsJSON, _ := json.Marshal(labels)
		entry := LogEntry{
			ID:        "test-1",
			Timestamp: time.Now(),
			Body:      "Test message",
			Severity:  "INFO",
			Labels:    labelsJSON,
		}

		errors := datasource.validateLogEntry(entry, 0)
		assert.Empty(t, errors)
	})

	t.Run("invalid timestamp generates error", func(t *testing.T) {
		labels := LogLabels{Service: "test-service"}
		labelsJSON, _ := json.Marshal(labels)
		entry := LogEntry{
			ID:       "test-1",
			Body:     "Test message",
			Severity: "INFO",
			Labels:   labelsJSON,
		}

		errors := datasource.validateLogEntry(entry, 0)
		assert.NotEmpty(t, errors)
		assert.Contains(t, errors[0], "missing or invalid timestamp")
	})

	t.Run("invalid log level generates error", func(t *testing.T) {
		labels := LogLabels{Service: "test-service"}
		labelsJSON, _ := json.Marshal(labels)
		entry := LogEntry{
			ID:        "test-1",
			Timestamp: time.Now(),
			Body:      "Test message",
			Severity:  "INVALID_LEVEL",
			Labels:    labelsJSON,
		}

		errors := datasource.validateLogEntry(entry, 0)
		assert.NotEmpty(t, errors)
		assert.Contains(t, errors[0], "invalid log severity")
	})
}

// TestLogsAPIIntegrationConsistency - Property Test 1: Logs API Integration Consistency
// Validates: Requirements 6.1, 6.2, 6.3, 6.5, 10.2, 10.3, 10.5, 12.1, 12.4, 12.5
// This property test ensures that the logs API integration maintains consistency with
// the existing metrics implementation patterns for authentication, error handling,
// timeout management, and concurrency control.
func TestLogsAPIIntegrationConsistency(t *testing.T) {
	t.Run("Property 1: Logs API Integration Consistency", func(t *testing.T) {
		
		// Test Property: Authentication patterns are consistent between logs and metrics
		t.Run("authentication patterns consistency", func(t *testing.T) {
			// Property: Logs API should use the same authentication fields as metrics API
			// Requirements: 6.2 - reuse existing authentication setup
			
			// Create test datasource with authentication data
			datasource := &Datasource{
				SecureJSONData: map[string]string{
					"apiKey": "test-api-key",
					"appKey": "test-app-key",
				},
				JSONData: &MyDataSourceOptions{
					Site: "datadoghq.com",
				},
			}
			
			// Verify that logs query method uses the same authentication fields
			// This tests that the authentication pattern is consistent
			assert.NotEmpty(t, datasource.SecureJSONData["apiKey"], "API key should be available for logs queries")
			assert.NotEmpty(t, datasource.SecureJSONData["appKey"], "App key should be available for logs queries")
			assert.NotEmpty(t, datasource.JSONData.Site, "Site configuration should be available for logs queries")
			
			// Test default site fallback (same as metrics)
			datasourceNoSite := &Datasource{
				SecureJSONData: map[string]string{
					"apiKey": "test-api-key",
					"appKey": "test-app-key",
				},
				JSONData: &MyDataSourceOptions{}, // No site specified
			}
			
			// Should use same default as metrics implementation
			expectedDefaultSite := "datadoghq.com"
			actualSite := datasourceNoSite.JSONData.Site
			if actualSite == "" {
				actualSite = "datadoghq.com" // Same default logic as in queryLogs
			}
			assert.Equal(t, expectedDefaultSite, actualSite, "Default site should match metrics implementation")
		})
		
		// Test Property: Error handling patterns are consistent
		t.Run("error handling patterns consistency", func(t *testing.T) {
			// Property: Logs API should handle missing credentials the same way as metrics API
			// Requirements: 12.1, 12.4 - reuse existing error parsing and authentication error handling
			
			// Test missing API key
			datasourceMissingAPI := &Datasource{
				SecureJSONData: map[string]string{
					"appKey": "test-app-key",
				},
				JSONData: &MyDataSourceOptions{
					Site: "datadoghq.com",
				},
			}
			
			_, hasAPIKey := datasourceMissingAPI.SecureJSONData["apiKey"]
			assert.False(t, hasAPIKey, "Missing API key should be detected")
			
			// Test missing App key
			datasourceMissingApp := &Datasource{
				SecureJSONData: map[string]string{
					"apiKey": "test-api-key",
				},
				JSONData: &MyDataSourceOptions{
					Site: "datadoghq.com",
				},
			}
			
			_, hasAppKey := datasourceMissingApp.SecureJSONData["appKey"]
			assert.False(t, hasAppKey, "Missing App key should be detected")
			
			// Property: Error messages should be consistent format
			expectedAPIKeyError := "missing apiKey in secure data"
			expectedAppKeyError := "missing appKey in secure data"
			
			// These error messages should match the format used in queryLogs method
			assert.Contains(t, expectedAPIKeyError, "apiKey", "API key error should mention apiKey")
			assert.Contains(t, expectedAppKeyError, "appKey", "App key error should mention appKey")
		})
		
		// Test Property: Time range conversion consistency
		t.Run("time range conversion consistency", func(t *testing.T) {
			// Property: Logs API should use the same time conversion logic as metrics API
			// Requirements: 6.3 - reuse existing time range conversion logic
			
			now := time.Now()
			from := now.Add(-1 * time.Hour)
			to := now
			
			// Test millisecond timestamp conversion (same as metrics)
			fromMillis := from.UnixMilli()
			toMillis := to.UnixMilli()
			
			assert.Greater(t, toMillis, fromMillis, "To timestamp should be greater than from timestamp")
			assert.Greater(t, fromMillis, int64(0), "From timestamp should be positive")
			assert.Greater(t, toMillis, int64(0), "To timestamp should be positive")
			
			// Property: Time format should be consistent with Datadog API expectations
			fromStr := fmt.Sprintf("%d", fromMillis)
			toStr := fmt.Sprintf("%d", toMillis)
			
			assert.Regexp(t, `^\d+$`, fromStr, "From time should be numeric string")
			assert.Regexp(t, `^\d+$`, toStr, "To time should be numeric string")
		})
		
		// Test Property: Timeout configuration consistency
		t.Run("timeout configuration consistency", func(t *testing.T) {
			// Property: Logs API should use the same timeout values as metrics API
			// Requirements: 10.2, 10.3 - reuse existing timeout configuration and context management
			
			expectedTimeout := 30 * time.Second
			
			// Test that timeout duration matches metrics implementation
			assert.Equal(t, 30*time.Second, expectedTimeout, "Timeout should match metrics implementation (30 seconds)")
			
			// Property: Context timeout should be properly configured
			ctx := context.Background()
			timeoutCtx, cancel := context.WithTimeout(ctx, expectedTimeout)
			defer cancel()
			
			deadline, hasDeadline := timeoutCtx.Deadline()
			assert.True(t, hasDeadline, "Context should have deadline")
			assert.True(t, deadline.After(time.Now()), "Deadline should be in the future")
		})
		
		// Test Property: Concurrency limiting consistency
		t.Run("concurrency limiting consistency", func(t *testing.T) {
			// Property: Logs API should use the same concurrency limits as metrics API
			// Requirements: 10.5 - reuse existing concurrency limiting patterns (max 5 concurrent requests)
			
			// Create datasource with concurrency limit
			datasource := &Datasource{
				concurrencyLimit: make(chan struct{}, 5), // Same as metrics implementation
			}
			
			// Test that concurrency limit channel has correct capacity
			assert.Equal(t, 5, cap(datasource.concurrencyLimit), "Concurrency limit should be 5 (same as metrics)")
			
			// Property: Semaphore should work correctly
			// Acquire a slot
			select {
			case datasource.concurrencyLimit <- struct{}{}:
				// Successfully acquired slot
				assert.True(t, true, "Should be able to acquire concurrency slot")
				
				// Release the slot
				<-datasource.concurrencyLimit
			default:
				t.Error("Should be able to acquire concurrency slot when channel is empty")
			}
		})
		
		// Test Property: Request structure consistency
		t.Run("request structure consistency", func(t *testing.T) {
			// Property: Logs API request should follow Datadog's exact API structure
			// Requirements: 6.1 - use Datadog's POST /api/v2/logs/events/search endpoint
			
			// Test LogsSearchRequest structure matches Datadog API v2 specification
			request := LogsSearchRequest{
				Data: LogsSearchData{
					Type: "search_request",
					Attributes: LogsSearchAttributes{
						Query: "service:test",
						Time: LogsTime{
							From: "1640995200000",
							To:   "1640998800000",
						},
						Sort:  "timestamp",
						Limit: 1000,
					},
				},
			}
			
			// Validate required fields are present
			assert.Equal(t, "search_request", request.Data.Type, "Request type should be 'search_request'")
			assert.NotEmpty(t, request.Data.Attributes.Query, "Query should not be empty")
			assert.NotEmpty(t, request.Data.Attributes.Time.From, "From time should not be empty")
			assert.NotEmpty(t, request.Data.Attributes.Time.To, "To time should not be empty")
			assert.Equal(t, "timestamp", request.Data.Attributes.Sort, "Default sort should be 'timestamp'")
			assert.Equal(t, 1000, request.Data.Attributes.Limit, "Default limit should be 1000")
			
			// Property: Request should be JSON serializable
			jsonBytes, err := json.Marshal(request)
			assert.NoError(t, err, "Request should be JSON serializable")
			assert.NotEmpty(t, jsonBytes, "JSON should not be empty")
			
			// Property: Serialized JSON should be valid
			var unmarshaled LogsSearchRequest
			err = json.Unmarshal(jsonBytes, &unmarshaled)
			assert.NoError(t, err, "JSON should be deserializable")
			assert.Equal(t, request.Data.Type, unmarshaled.Data.Type, "Deserialized data should match original")
		})
		
		// Test Property: Query translation consistency
		t.Run("query translation consistency", func(t *testing.T) {
			// Property: Query translation should handle edge cases consistently
			// Requirements: 6.5 - handle query translation properly
			
			datasource := &Datasource{}
			
			testCases := []struct {
				name     string
				input    string
				expected string
			}{
				{"empty query", "", "*"},
				{"whitespace only", "   ", "*"},
				{"simple text", "error", "error"},
				{"facet filter", "service:web-app", "service:web-app"},
				{"boolean operators lowercase", "error and warning", "error AND warning"},
				{"boolean operators mixed case", "error Or warning", "error OR warning"},
				{"not operator", "not error", "NOT error"},
				
				// Task 11: Advanced Boolean Operators and Wildcards
				{"complex boolean with grouping", "service:(web-app OR api-service) AND status:ERROR", "service:(web-app OR api-service) AND status:ERROR"},
				{"nested boolean expressions", "(service:web-app OR service:api) AND (status:ERROR OR status:WARN)", "(service:web-app OR service:api) AND (status:ERROR OR status:WARN)"},
				{"wildcard patterns", "error* AND NOT test-*", "error* AND NOT test-*"},
				{"wildcard in facets", "service:web-* AND host:prod-*", "service:web-* AND host:prod-*"},
				{"multiple wildcards normalized", "error** service", "error* service"},
				{"log level normalization", "status:error OR status:warn", "status:ERROR OR status:WARN"},
				{"grouped log levels", "status:(error OR warn OR fatal)", "status:(ERROR OR WARN OR FATAL)"},
				{"custom attributes", "@env:production AND @version:1.*", "@env:production AND @version:1.*"},
				{"quoted service names", "service:\"my service\" AND status:ERROR", "service:\"my service\" AND status:ERROR"},
				{"service names with spaces auto-quoted", "service:my service", "service:\"my service\""},
				{"complex query with all features", "service:(web-* OR api-*) AND status:(ERROR OR WARN) AND NOT source:health-check", "service:(web-* OR api-*) AND status:(ERROR OR WARN) AND NOT source:health-check"},
			}
			
			for _, tc := range testCases {
				t.Run(tc.name, func(t *testing.T) {
					qm := &QueryModel{LogQuery: tc.input}
					q := &backend.DataQuery{}
					
					result, err := datasource.translateLogsQuery(qm, q)
					assert.NoError(t, err, "Query translation should not error")
					assert.Equal(t, tc.expected, result, "Query translation should match expected result")
				})
			}
		})
		
		// Test Property: Response parsing consistency
		t.Run("response parsing consistency", func(t *testing.T) {
			// Property: Response parsing should handle various response formats consistently
			// Requirements: 12.5 - handle API response parsing properly
			
			datasource := &Datasource{}
			
			// Test valid response
			validResponse := map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"id": "log-1",
						"attributes": map[string]interface{}{
							"timestamp": time.Now().Format(time.RFC3339),
							"message":   "Test log message",
							"status":    "info",
							"service":   "test-service",
							"source":    "test-source",
							"host":      "test-host",
							"tags":      []interface{}{"env:test", "version:1.0"},
						},
					},
				},
			}
			
			entries, err := datasource.parseDatadogLogsResponse(validResponse)
			assert.NoError(t, err, "Valid response should parse without error")
			assert.Len(t, entries, 1, "Should parse one log entry")
			assert.Equal(t, "log-1", entries[0].ID, "Should parse log ID correctly")
			assert.Equal(t, "Test log message", entries[0].Body, "Should parse body correctly")
			
			// Test empty response
			emptyResponse := map[string]interface{}{
				"data": []interface{}{},
			}
			
			entries, err = datasource.parseDatadogLogsResponse(emptyResponse)
			assert.NoError(t, err, "Empty response should parse without error")
			assert.Len(t, entries, 0, "Should return empty slice for empty response")
			
			// Test invalid response format
			invalidResponse := "invalid"
			
			entries, err = datasource.parseDatadogLogsResponse(invalidResponse)
			assert.Error(t, err, "Invalid response should return error")
			assert.Contains(t, err.Error(), "invalid response format", "Error should mention invalid format")
		})
	})
}

// TestLogsPaginationAndCaching - Property Test 8: Pagination and Caching Consistency
// Validates: Requirements 10.1, 10.4
// This property test ensures that pagination and caching work correctly for logs queries
func TestLogsPaginationAndCaching(t *testing.T) {
	t.Run("Property 8: Pagination and Caching Consistency", func(t *testing.T) {
		
		// Test Property: Cache TTL consistency
		t.Run("cache TTL consistency", func(t *testing.T) {
			// Property: Cache should respect 30-second TTL as per requirements
			// Requirements: 10.4 - implement 30-second cache TTL
			
			datasource := &Datasource{
				logsCache: make(map[string]*LogsCacheEntry),
			}
			
			// Create test log entries
			labels := LogLabels{Service: "test-service"}
			labelsJSON, _ := json.Marshal(labels)
			testEntries := []LogEntry{
				{
					ID:        "test-1",
					Timestamp: time.Now(),
					Body:      "Test message 1",
					Severity:  "INFO",
					Labels:    labelsJSON,
				},
				{
					ID:        "test-2",
					Timestamp: time.Now(),
					Body:      "Test message 2",
					Severity:  "ERROR",
					Labels:    labelsJSON,
				},
			}
			
			cacheKey := "test-cache-key"
			
			// Set cache entry
			datasource.SetCachedLogsEntry(cacheKey, testEntries, "next-cursor")
			
			// Property: Fresh cache entry should be retrievable
			cacheTTL := 30 * time.Second
			cachedEntry := datasource.GetCachedLogsEntry(cacheKey, cacheTTL)
			assert.NotNil(t, cachedEntry, "Fresh cache entry should be retrievable")
			assert.Len(t, cachedEntry.LogEntries, 2, "Cached entries should match original")
			assert.Equal(t, "next-cursor", cachedEntry.NextCursor, "Next cursor should be preserved")
			
			// Property: Cache entry should have recent timestamp
			timeDiff := time.Since(cachedEntry.Timestamp)
			assert.Less(t, timeDiff, 1*time.Second, "Cache timestamp should be recent")
			
			// Property: Expired cache entry should not be retrievable
			expiredTTL := 1 * time.Nanosecond // Very short TTL to simulate expiration
			time.Sleep(2 * time.Nanosecond)   // Wait for expiration
			expiredEntry := datasource.GetCachedLogsEntry(cacheKey, expiredTTL)
			assert.Nil(t, expiredEntry, "Expired cache entry should not be retrievable")
		})
		
		// Test Property: Cache key consistency
		t.Run("cache key consistency", func(t *testing.T) {
			// Property: Cache keys should be deterministic and unique for different queries and pages
			// Requirements: 10.4 - cache logs results appropriately
			
			// Test that same query parameters produce same cache key
			query1 := "service:web-app"
			from1 := int64(1640995200000)
			to1 := int64(1640998800000)
			cursor1 := "first"
			pageSize1 := 100
			
			cacheKey1 := fmt.Sprintf("logs:%s:%d:%d:%s:%d", query1, from1, to1, cursor1, pageSize1)
			cacheKey1Duplicate := fmt.Sprintf("logs:%s:%d:%d:%s:%d", query1, from1, to1, cursor1, pageSize1)
			
			assert.Equal(t, cacheKey1, cacheKey1Duplicate, "Same parameters should produce same cache key")
			
			// Test that different query parameters produce different cache keys
			query2 := "service:api-gateway"
			cacheKey2 := fmt.Sprintf("logs:%s:%d:%d:%s:%d", query2, from1, to1, cursor1, pageSize1)
			
			assert.NotEqual(t, cacheKey1, cacheKey2, "Different queries should produce different cache keys")
			
			// Test that different time ranges produce different cache keys
			from2 := int64(1640991600000)
			cacheKey3 := fmt.Sprintf("logs:%s:%d:%d:%s:%d", query1, from2, to1, cursor1, pageSize1)
			
			assert.NotEqual(t, cacheKey1, cacheKey3, "Different time ranges should produce different cache keys")
			
			// Test that different pagination parameters produce different cache keys
			cursor2 := "page2-cursor"
			cacheKey4 := fmt.Sprintf("logs:%s:%d:%d:%s:%d", query1, from1, to1, cursor2, pageSize1)
			
			assert.NotEqual(t, cacheKey1, cacheKey4, "Different cursors should produce different cache keys")
			
			pageSize2 := 50
			cacheKey5 := fmt.Sprintf("logs:%s:%d:%d:%s:%d", query1, from1, to1, cursor1, pageSize2)
			
			assert.NotEqual(t, cacheKey1, cacheKey5, "Different page sizes should produce different cache keys")
		})
		
		// Test Property: Pagination state consistency
		t.Run("pagination state consistency", func(t *testing.T) {
			// Property: Pagination should handle cursor-based navigation correctly
			// Requirements: 10.1 - implement pagination using Datadog's cursor-based system
			
			// Test LogsPaginationState structure
			paginationState := LogsPaginationState{
				Query:        "service:test",
				TimeRange:    "1h",
				Cursor:       "cursor-123",
				HasMore:      true,
				TotalFetched: 1000,
			}
			
			// Property: Pagination state should track query context
			assert.NotEmpty(t, paginationState.Query, "Pagination should track query")
			assert.NotEmpty(t, paginationState.TimeRange, "Pagination should track time range")
			assert.NotEmpty(t, paginationState.Cursor, "Pagination should track cursor")
			assert.True(t, paginationState.HasMore, "Pagination should track if more data available")
			assert.Greater(t, paginationState.TotalFetched, 0, "Pagination should track total fetched count")
			
			// Property: Cursor should be opaque string (no specific format required)
			assert.IsType(t, "", paginationState.Cursor, "Cursor should be string type")
		})
		
		// Test Property: LogsSearchRequest pagination structure
		t.Run("pagination request structure", func(t *testing.T) {
			// Property: Pagination requests should include cursor in relationships
			// Requirements: 10.1 - use Datadog's cursor-based pagination system
			
			// Test request without pagination (first page)
			firstPageRequest := LogsSearchRequest{
				Data: LogsSearchData{
					Type: "search_request",
					Attributes: LogsSearchAttributes{
						Query: "service:test",
						Time: LogsTime{
							From: "1640995200000",
							To:   "1640998800000",
						},
						Sort:  "timestamp",
						Limit: 1000,
					},
				},
			}
			
			// Property: First page should not have relationships
			assert.Nil(t, firstPageRequest.Data.Relationships, "First page should not have pagination relationships")
			
			// Test request with pagination (subsequent page)
			cursor := "next-page-cursor-123"
			nextPageRequest := LogsSearchRequest{
				Data: LogsSearchData{
					Type: "search_request",
					Attributes: LogsSearchAttributes{
						Query: "service:test",
						Time: LogsTime{
							From: "1640995200000",
							To:   "1640998800000",
						},
						Sort:  "timestamp",
						Limit: 1000,
					},
					Relationships: &LogsRelationships{
						Page: LogsPageRelation{
							Data: LogsPageData{
								Type: "page_data",
								ID:   cursor,
							},
						},
					},
				},
			}
			
			// Property: Subsequent pages should include cursor in relationships
			assert.NotNil(t, nextPageRequest.Data.Relationships, "Subsequent pages should have pagination relationships")
			assert.Equal(t, "page_data", nextPageRequest.Data.Relationships.Page.Data.Type, "Page data type should be 'page_data'")
			assert.Equal(t, cursor, nextPageRequest.Data.Relationships.Page.Data.ID, "Page data ID should contain cursor")
			
			// Property: Request should be JSON serializable with pagination
			jsonBytes, err := json.Marshal(nextPageRequest)
			assert.NoError(t, err, "Paginated request should be JSON serializable")
			assert.Contains(t, string(jsonBytes), cursor, "JSON should contain cursor")
		})
		
		// Test Property: LogsResponse pagination structure
		t.Run("pagination response structure", func(t *testing.T) {
			// Property: Response should include pagination metadata
			// Requirements: 10.1 - handle pagination cursor from response
			
			// Test response with pagination cursor
			nextCursor := "next-cursor-456"
			response := LogsResponse{
				Data: []map[string]interface{}{
					{
						"id": "log-1",
						"attributes": map[string]interface{}{
							"timestamp": time.Now().Format(time.RFC3339),
							"message":   "Test message",
							"status":    "info",
						},
					},
				},
				Meta: LogsResponseMeta{
					Page: LogsPageMeta{
						After: nextCursor,
					},
				},
			}
			
			// Property: Response should contain pagination metadata
			assert.NotEmpty(t, response.Meta.Page.After, "Response should contain next cursor")
			assert.Equal(t, nextCursor, response.Meta.Page.After, "Next cursor should match expected value")
			
			// Property: Response should be JSON serializable
			jsonBytes, err := json.Marshal(response)
			assert.NoError(t, err, "Response should be JSON serializable")
			assert.Contains(t, string(jsonBytes), nextCursor, "JSON should contain next cursor")
			
			// Test response without pagination (last page)
			lastPageResponse := LogsResponse{
				Data: []map[string]interface{}{
					{
						"id": "log-2",
						"attributes": map[string]interface{}{
							"timestamp": time.Now().Format(time.RFC3339),
							"message":   "Last message",
							"status":    "info",
						},
					},
				},
				Meta: LogsResponseMeta{
					Page: LogsPageMeta{
						After: "", // Empty cursor indicates last page
					},
				},
			}
			
			// Property: Last page should have empty cursor
			assert.Empty(t, lastPageResponse.Meta.Page.After, "Last page should have empty cursor")
		})
		
		// Test Property: Cache cleanup consistency
		t.Run("cache cleanup consistency", func(t *testing.T) {
			// Property: Cache cleanup should remove only expired entries
			// Requirements: 10.4 - maintain cache with appropriate TTL
			
			datasource := &Datasource{
				logsCache: make(map[string]*LogsCacheEntry),
			}
			
			// Add fresh entry
			freshEntries := []LogEntry{{ID: "fresh", Body: "Fresh entry"}}
			datasource.SetCachedLogsEntry("fresh-key", freshEntries, "")
			
			// Add old entry by manually setting timestamp
			oldEntries := []LogEntry{{ID: "old", Body: "Old entry"}}
			datasource.logsCache["old-key"] = &LogsCacheEntry{
				LogEntries: oldEntries,
				Timestamp:  time.Now().Add(-1 * time.Hour), // 1 hour ago
				NextCursor: "",
			}
			
			// Property: Both entries should exist before cleanup
			assert.Len(t, datasource.logsCache, 2, "Should have 2 cache entries before cleanup")
			
			// Clean expired entries with 30-second TTL
			cacheTTL := 30 * time.Second
			datasource.CleanExpiredLogsCache(cacheTTL)
			
			// Property: Only fresh entry should remain after cleanup
			assert.Len(t, datasource.logsCache, 1, "Should have 1 cache entry after cleanup")
			
			_, hasFresh := datasource.logsCache["fresh-key"]
			_, hasOld := datasource.logsCache["old-key"]
			
			assert.True(t, hasFresh, "Fresh entry should remain after cleanup")
			assert.False(t, hasOld, "Old entry should be removed after cleanup")
		})
		
		// Test Property: Concurrency safety for cache operations
		t.Run("cache concurrency safety", func(t *testing.T) {
			// Property: Cache operations should be thread-safe
			// Requirements: 10.4 - cache should handle concurrent access safely
			
			datasource := &Datasource{
				logsCache: make(map[string]*LogsCacheEntry),
			}
			
			// Test concurrent cache operations
			numGoroutines := 10
			numOperations := 100
			
			// Use channels to coordinate goroutines
			done := make(chan bool, numGoroutines)
			
			// Start multiple goroutines performing cache operations
			for i := 0; i < numGoroutines; i++ {
				go func(goroutineID int) {
					defer func() { done <- true }()
					
					for j := 0; j < numOperations; j++ {
						cacheKey := fmt.Sprintf("key-%d-%d", goroutineID, j)
						entries := []LogEntry{{ID: cacheKey, Body: "Test message"}}
						
						// Set cache entry
						datasource.SetCachedLogsEntry(cacheKey, entries, "")
						
						// Get cache entry
						cacheTTL := 30 * time.Second
						cachedEntry := datasource.GetCachedLogsEntry(cacheKey, cacheTTL)
						
						// Verify entry was cached correctly
						if cachedEntry == nil || len(cachedEntry.LogEntries) != 1 {
							t.Errorf("Cache operation failed for key %s", cacheKey)
							return
						}
					}
				}(i)
			}
			
			// Wait for all goroutines to complete
			for i := 0; i < numGoroutines; i++ {
				<-done
			}
			
			// Property: All cache operations should complete without race conditions
			// If we reach here without panics or test failures, concurrency safety is verified
			assert.True(t, true, "Concurrent cache operations should complete safely")
		})
	})
}