package plugin

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MetricsResponseParser handles conversion from Datadog Metrics API response to Grafana data frames
// Refactored from existing metrics response logic into parser
// Ensures consistent error handling patterns
// Requirements: 5.1, 5.2
type MetricsResponseParser struct {
	datasource *Datasource
}

// NewMetricsResponseParser creates a new MetricsResponseParser instance
func NewMetricsResponseParser(datasource *Datasource) *MetricsResponseParser {
	return &MetricsResponseParser{
		datasource: datasource,
	}
}

// ParseTimeseriesResponse processes Datadog timeseries response and creates frames for each query/formula
// Refactored from existing processTimeseriesResponse method
func (p *MetricsResponseParser) ParseTimeseriesResponse(
	resp *datadogV2.TimeseriesFormulaQueryResponse,
	queryModels map[string]QueryModel,
	response *backend.QueryDataResponse,
) error {
	logger := log.New()

	if resp == nil {
		logger.Error("Received nil response from Datadog API")
		// Return error for all queries
		for refID := range queryModels {
			response.Responses[refID] = backend.ErrDataResponse(backend.StatusBadRequest, "No data received from Datadog API")
		}
		return fmt.Errorf("nil response received from Datadog API")
	}

	// Check if response has series data
	series := resp.GetData()
	if len(series.Attributes.Series) == 0 {
		// Return empty responses for all queries
		for refID := range queryModels {
			response.Responses[refID] = backend.DataResponse{Frames: data.Frames{}}
		}
		return nil
	}

	times := resp.GetData().Attributes.GetTimes()
	values := resp.GetData().Attributes.GetValues()

	logger.Info("Processing Datadog series", 
		"seriesCount", len(series.Attributes.Series),
		"timesCount", len(times),
		"valuesCount", len(values))

	// Map query indices to refIDs for legend formatting
	queryList := make([]string, 0, len(queryModels))
	for refID := range queryModels {
		queryList = append(queryList, refID)
	}
	sort.Strings(queryList) // Ensure consistent ordering

	// Group frames by query index (which corresponds to refID)
	framesByQuery := make(map[int]data.Frames)

	for i := range series.Attributes.GetSeries() {
		s := &series.Attributes.Series[i]
		
		// Get the query index to determine which refID this belongs to
		queryIndex := int(*s.QueryIndex)
		
		// Check if we have data for this series index
		if i >= len(values) {
			logger.Warn("Series index out of bounds", "seriesIndex", i, "valuesCount", len(values))
			continue
		}

		pointlist := values[i]
		if len(pointlist) == 0 {
			logger.Debug("Empty pointlist for series", "seriesIndex", i)
			continue
		}

		// Extract timestamps and values
		timeValues := make([]time.Time, 0)
		numberValues := make([]float64, 0)

		for j, timeVal := range times {
			if j >= len(pointlist) {
				break
			}
			point := pointlist[j]
			if point != nil {
				timestamp := time.UnixMilli(timeVal)
				timeValues = append(timeValues, timestamp)
				numberValues = append(numberValues, *point)
			}
		}

		if len(timeValues) == 0 {
			logger.Debug("No valid time values for series", "seriesIndex", i)
			continue
		}

		// Build series name and labels
		labels := map[string]string{}
		tagSet := s.GetGroupTags()
		
		if len(tagSet) > 0 {
			for _, tag := range tagSet {
				parts := strings.SplitN(tag, ":", 2)
				if len(parts) == 2 {
					labels[parts[0]] = parts[1]
				}
			}
		}

		// Get the query model for this query to determine legend formatting
		refID := queryList[queryIndex]
		qm, exists := queryModels[refID]
		if !exists {
			logger.Warn("Query model not found for refID", "refID", refID)
			continue
		}

		// Build series name using legend configuration
		seriesName := p.buildSeriesName(qm, labels)
		
		// Create data frame
		frame := data.NewFrame(
			seriesName,
			data.NewField("Time", nil, timeValues),
			data.NewField("Value", labels, numberValues),
		)

		// Configure the display name to ensure it shows the formatted name
		frame.Fields[1].Config = &data.FieldConfig{
			DisplayName: seriesName, // Explicitly set display name to our formatted series name
		}

		// Set metadata
		frame.Meta = &data.FrameMeta{
			Type: data.FrameTypeTimeSeriesMulti,
		}

		// Add to the appropriate query group
		framesByQuery[queryIndex] = append(framesByQuery[queryIndex], frame)
	}

	// Assign frames to responses by refID
	for queryIndex, frames := range framesByQuery {
		if queryIndex < len(queryList) {
			refID := queryList[queryIndex]
			response.Responses[refID] = backend.DataResponse{
				Frames: frames,
			}
		}
	}

	return nil
}

// buildSeriesName builds a series name using legend configuration
func (p *MetricsResponseParser) buildSeriesName(qm QueryModel, labels map[string]string) string {
	// Build series name using legend configuration (same logic as original)
	metric := qm.QueryText // Default to the query text if no custom legend
	seriesName := metric
	
	// Determine legend template based on legend mode
	var legendTemplate string
	if qm.LegendMode == "custom" && qm.LegendTemplate != "" {
		legendTemplate = qm.LegendTemplate
	} else if qm.LegendMode != "auto" {
		// Only use legacy fields when NOT in auto mode
		if qm.InterpolatedLabel != "" {
			// Backward compatibility: use interpolated label if available
			legendTemplate = qm.InterpolatedLabel
		} else if qm.Label != "" {
			// Backward compatibility: fall back to old label field
			legendTemplate = qm.Label
		}
	}
	// If LegendMode is "auto" or empty, legendTemplate remains empty and we use auto format
	
	if legendTemplate != "" {
		// Use the legend template, replacing template variables with label values
		seriesName = p.replaceTemplateVariables(legendTemplate, labels)
	} else if len(labels) > 0 {
		// Auto mode: use default format with metric + labels
		var labelStrings []string
		for k, v := range labels {
			labelStrings = append(labelStrings, k+":"+v)
		}
		seriesName = metric + " {" + strings.Join(labelStrings, ", ") + "}"
	}
	
	return seriesName
}

// replaceTemplateVariables replaces template variables in legend template with label values
func (p *MetricsResponseParser) replaceTemplateVariables(template string, labels map[string]string) string {
	result := template
	for key, value := range labels {
		placeholder := "{{" + key + "}}"
		result = strings.ReplaceAll(result, placeholder, value)
	}
	return result
}



// ParseError parses Datadog API errors and returns user-friendly error messages
// Reuses existing error handling patterns for consistency
func (p *MetricsResponseParser) ParseError(err error, httpStatus int, responseBody string) string {
	// Delegate to existing error parsing logic for consistency
	return p.datasource.parseDatadogError(err, httpStatus, responseBody)
}

// ValidateResponse validates the structure of a Datadog metrics response
func (p *MetricsResponseParser) ValidateResponse(resp *datadogV2.TimeseriesFormulaQueryResponse) error {
	if resp == nil {
		return fmt.Errorf("response is nil")
	}

	series := resp.GetData()
	if len(series.Attributes.Series) == 0 {
		return fmt.Errorf("no series data in response")
	}

	times := resp.GetData().Attributes.GetTimes()
	values := resp.GetData().Attributes.GetValues()

	// Validate that times and values have consistent lengths
	if len(values) > 0 {
		expectedLength := len(times)
		for i, column := range values {
			if len(column) != expectedLength {
				return fmt.Errorf("series %d length mismatch: expected %d, got %d", 
					i, expectedLength, len(column))
			}
		}
	}

	return nil
}

// CreateEmptyResponse creates an empty metrics response for error cases
func (p *MetricsResponseParser) CreateEmptyResponse(queryModels map[string]QueryModel) *backend.QueryDataResponse {
	response := backend.NewQueryDataResponse()
	
	for refID, qm := range queryModels {
		if qm.Hide {
			response.Responses[refID] = backend.DataResponse{}
		} else {
			// Create empty frame
			frame := data.NewFrame("metrics")
			frame.RefID = refID
			response.Responses[refID] = backend.DataResponse{
				Frames: []*data.Frame{frame},
			}
		}
	}
	
	return response
}

// SanitizeMetricName sanitizes metric names for use in Grafana
func (p *MetricsResponseParser) SanitizeMetricName(name string) string {
	// Remove leading/trailing whitespace
	name = strings.TrimSpace(name)
	
	// Return empty if name is empty or too long
	if name == "" || len(name) > 200 {
		return ""
	}
	
	// Replace invalid characters with underscores
	// Keep alphanumeric, underscore, hyphen, dot, and colon
	var result strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || 
		   (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' || r == ':' {
			result.WriteRune(r)
		} else {
			result.WriteRune('_')
		}
	}
	
	sanitized := result.String()
	
	// Ensure it doesn't start with a number
	if len(sanitized) > 0 && sanitized[0] >= '0' && sanitized[0] <= '9' {
		sanitized = "metric_" + sanitized
	}
	
	return sanitized
}

// FormatMetricValue formats metric values for display
func (p *MetricsResponseParser) FormatMetricValue(value *float64) string {
	if value == nil {
		return "null"
	}
	
	// Handle special float values
	if *value != *value { // NaN check
		return "NaN"
	}
	
	// Format with appropriate precision
	if *value == float64(int64(*value)) {
		// Integer value
		return strconv.FormatInt(int64(*value), 10)
	}
	
	// Float value with reasonable precision
	return strconv.FormatFloat(*value, 'g', 6, 64)
}