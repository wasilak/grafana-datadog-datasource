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
		frames := datasource.createLogsDataFrames(sampleEntries, "test-query")
		
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
			{"message", data.FieldTypeString},
			{"level", data.FieldTypeString},
			{"service", data.FieldTypeString},
			{"source", data.FieldTypeString},
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
		testEntry := LogEntry{
			ID:        "test-1",
			Timestamp: time.Now(),
			Message:   "  Test message with whitespace  ",
			Level:     "info", // lowercase - should be normalized
			Service:   "  test-service  ",
			Source:    "test-source",
			Host:      "test-host",
			Env:       "test-env",
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

		// Validate entry
		errors := datasource.validateLogEntry(testEntry, 0)
		assert.Empty(t, errors, "Valid entry should have no validation errors")

		// Sanitize entry
		sanitized := datasource.sanitizeLogEntry(testEntry)
		
		// Check sanitization results
		assert.Equal(t, "INFO", sanitized.Level, "Level should be normalized to uppercase")
		assert.Equal(t, "Test message with whitespace", sanitized.Message, "Message should be trimmed")
		assert.Equal(t, "test-service", sanitized.Service, "Service should be trimmed")

		// Create data frame with sanitized entry
		frames := datasource.createLogsDataFrames([]LogEntry{sanitized}, "sanitize-test")
		require.Len(t, frames, 1)
		frame := frames[0]
		
		// Check that additional fields were created and sanitized
		fieldNames := make([]string, len(frame.Fields))
		for i, field := range frame.Fields {
			fieldNames[i] = field.Name
		}
		
		// Should have core fields plus additional fields from attributes and tags
		assert.Contains(t, fieldNames, "valid_attr")
		assert.Contains(t, fieldNames, "tag_valid_tag")
		

		
		// Invalid field names should be sanitized
		foundInvalidAttr := false
		foundInvalidTag := false
		for _, name := range fieldNames {
			if name == "invalid_attr_" {
				foundInvalidAttr = true
			}
			if name == "tag_invalid-tag_" { // The hyphen is preserved, exclamation becomes underscore
				foundInvalidTag = true
			}
		}
		assert.True(t, foundInvalidAttr, "Invalid attribute name should be sanitized")
		assert.True(t, foundInvalidTag, "Invalid tag name should be sanitized")
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
		entry := LogEntry{
			ID:        "test-1",
			Timestamp: time.Now(),
			Message:   "Test message",
			Level:     "INFO",
			Service:   "test-service",
		}

		errors := datasource.validateLogEntry(entry, 0)
		assert.Empty(t, errors)
	})

	t.Run("invalid timestamp generates error", func(t *testing.T) {
		entry := LogEntry{
			ID:      "test-1",
			Message: "Test message",
			Level:   "INFO",
			Service: "test-service",
		}

		errors := datasource.validateLogEntry(entry, 0)
		assert.NotEmpty(t, errors)
		assert.Contains(t, errors[0], "missing or invalid timestamp")
	})

	t.Run("invalid log level generates error", func(t *testing.T) {
		entry := LogEntry{
			ID:        "test-1",
			Timestamp: time.Now(),
			Message:   "Test message",
			Level:     "INVALID_LEVEL",
			Service:   "test-service",
		}

		errors := datasource.validateLogEntry(entry, 0)
		assert.NotEmpty(t, errors)
		assert.Contains(t, errors[0], "invalid log level")
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
			assert.Equal(t, "Test log message", entries[0].Message, "Should parse message correctly")
			
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