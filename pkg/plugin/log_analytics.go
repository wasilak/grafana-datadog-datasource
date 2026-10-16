package plugin

import (
	"fmt"

	"github.com/DataDog/datadog-api-client-go/v2/api/datadogV2"
)

// LogAnalyticsQueryType is the queryType of Log Analytics queries: logs
// aggregated by Datadog (counts, percentiles, unique counts) through the v2
// query API, instead of the raw log entries the "logs" query type returns.
const LogAnalyticsQueryType = "log-analytics"

// logAnalyticsLabel names a Log Analytics query the way Datadog does,
// e.g. "count" or "pc95(@duration_ms)".
func logAnalyticsLabel(qm *QueryModel) string {
	compute, _, _ := logAnalyticsParts(qm)
	if compute.Metric == nil {
		return string(compute.Aggregation)
	}
	return fmt.Sprintf("%s(%s)", compute.Aggregation, *compute.Metric)
}

// logAnalyticsParts returns the compute, group-by and search of a Log Analytics
// query with the defaults filled in: count when no compute is set, "*" when the
// search is empty, and groups ranked by the query's own compute, highest first,
// when no sort is set. Group-by rows without a facet are dropped.
func logAnalyticsParts(qm *QueryModel) (datadogV2.EventsCompute, []datadogV2.EventsGroupBy, *datadogV2.EventsSearch) {
	compute := datadogV2.EventsCompute{Aggregation: datadogV2.EVENTSAGGREGATION_COUNT}
	if qm.Compute != nil {
		compute = *qm.Compute
	}

	groupBy := make([]datadogV2.EventsGroupBy, 0, len(qm.GroupBy))
	for _, g := range qm.GroupBy {
		// The editor saves a row before its facet is filled in
		if g.Facet == "" {
			continue
		}
		if g.Sort == nil {
			g.Sort = &datadogV2.EventsGroupBySort{
				Aggregation: compute.Aggregation,
				Metric:      compute.Metric,
				Order:       datadogV2.QUERYSORTORDER_DESC.Ptr(),
			}
		}
		groupBy = append(groupBy, g)
	}

	search := qm.LogQuery
	if search == "" {
		search = "*"
	}
	return compute, groupBy, &datadogV2.EventsSearch{Query: &search}
}

// logAnalyticsTimeseriesQuery builds the timeseries query for a Log Analytics
// query, named after its refID so formulas and responses can refer to it.
func logAnalyticsTimeseriesQuery(qm *QueryModel) datadogV2.TimeseriesQuery {
	compute, groupBy, search := logAnalyticsParts(qm)
	name := qm.RefID
	return datadogV2.TimeseriesQuery{EventsTimeseriesQuery: &datadogV2.EventsTimeseriesQuery{
		DataSource: datadogV2.EVENTSDATASOURCE_LOGS,
		Compute:    compute,
		GroupBy:    groupBy,
		Indexes:    qm.Indexes,
		Search:     search,
		Name:       &name,
	}}
}

// logAnalyticsScalarQuery builds the scalar query for a Log Analytics query.
func logAnalyticsScalarQuery(qm *QueryModel) datadogV2.ScalarQuery {
	compute, groupBy, search := logAnalyticsParts(qm)
	name := qm.RefID
	return datadogV2.ScalarQuery{EventsScalarQuery: &datadogV2.EventsScalarQuery{
		DataSource: datadogV2.EVENTSDATASOURCE_LOGS,
		Compute:    compute,
		GroupBy:    groupBy,
		Indexes:    qm.Indexes,
		Search:     search,
		Name:       &name,
	}}
}
