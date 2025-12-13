package plugin

import (
	"testing"
	"time"

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