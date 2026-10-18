# Log Analytics

A Log Analytics query has Datadog count or aggregate logs and returns numbers, such as requests over time or a p95 latency. Datadog does the aggregation, so the result covers every matching log. A **Logs** query, by contrast, returns at most 1,000 raw entries.

These queries use Datadog's [timeseries](https://docs.datadoghq.com/api/latest/metrics/#query-timeseries-data-across-multiple-products) and [scalar](https://docs.datadoghq.com/api/latest/metrics/#query-scalar-data-across-multiple-products) query APIs with the `logs` data source. Field names follow Datadog's [Log Analytics](https://docs.datadoghq.com/logs/explorer/analytics/). The API key needs the `logs_read_data` scope.

## 🎯 Writing a Query

Set **Query Type** to **Log Analytics**.

| Field | Description |
|---|---|
| **Search** | A Datadog [logs search](https://docs.datadoghq.com/logs/explorer/search_syntax/), such as `service:web status:error`. Leave it empty to match all logs. Dashboard variables work the same as in Logs queries. |
| **Aggregation** | `Count` (default), `Count unique`, `Sum`, `Min`, `Max`, `Avg`, or a percentile from `pc75` to `pc99`. |
| **Measure** | The attribute to aggregate, such as `@duration_ms`. Required for every aggregation except Count. |
| **Group by** | One or more facets to split results by, such as `@http.status_code` or `service`. **Limit** sets how many groups to return (Datadog's default is 10). Groups are ranked by the query's aggregation, highest first. |
| **Format** | **Timeseries** for values over time, or **Scalar** for one value per group over the whole time range. |
| **Options** | Legend mode and template, and an interval override for timeseries queries. |

### Timeseries or Scalar

Use **Timeseries** in time series panels, for example requests per interval or p95 latency over time.

Use **Scalar** in stat, bar gauge and table panels. Datadog computes each value from all the logs in the time range, so a scalar p95 or unique count is exact. Reducing timeseries points in Grafana can give a different number, because each point is already rolled up for its interval.

A scalar query returns a table with one column per group-by facet, such as `@http.status_code`, and a value column. Datadog sorts the rows by group, not by value. To rank them, add the **Sort by** transformation.

### Legends

Series labels use Datadog's facet names, including the `@` on attributes, such as `@http.status_code`. Custom legend templates accept either spelling: `{{@http.status_code}}` or `{{http.status_code}}`. Without a template, a series is named the way Datadog names it, such as `pc95(@duration_ms)`.

## 📊 Examples

| Goal | Search | Aggregation | Measure | Group by | Format |
|---|---|---|---|---|---|
| Requests over time | `service:web` | Count | | | Timeseries |
| Requests by status code | `service:web` | Count | | `@http.status_code` | Timeseries |
| p95 latency over time | `service:web` | pc95 | `@duration_ms` | | Timeseries |
| p95 latency for the time range | `service:web` | pc95 | `@duration_ms` | | Scalar |
| Unique users | `service:web` | Count unique | `@usr.id` | | Scalar |
| Slowest 10 endpoints | `service:web` | pc90 | `@duration_ms` | `@http.url_details.path`, limit 10 | Scalar |
| Log volume by level | `service:web` | Count | | `status` | Timeseries |

## 🧮 Formulas

Use Grafana [expressions](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries/) to combine Log Analytics queries with each other or with metrics queries. For example, an error rate:

1. Query **A**: search `service:web status:error`, Count, Scalar
2. Query **B**: search `service:web`, Count, Scalar
3. Expression **Math**: `100 * $A / $B`

Math matches series by label, so both inputs need the same group-by, or none. To show only the result, add the **Filter data by query refId** transformation. Don't hide A and B instead: hidden queries return no data, so the expression gets no input.

A Math expression over a timeseries query and a scalar query applies the scalar value to every point of the series. If the scalar query matches nothing, the expression returns no data rather than an error.

## 🔀 Datadog Features Without a Direct Equivalent

| In Datadog | In Grafana |
|---|---|
| Exclude missing (hide the group for logs without the facet) | Add `<facet>:*` to the search, such as `@http.status_code:*`. This drops the same logs. |
| A query table that joins several queries by group | Add one scalar query per column, each grouped by the same facet, with a limit higher than the number of groups. Then add the transformations **Join by field** (outer join on the facet), **Add field from calculation** for formula columns, **Organize fields**, **Sort by** and **Limit**. |
| `default_zero()` | Set the panel's **No value** option to `0`. |

## ⚠️ Known Limitations

- Facets and measures have no autocomplete yet.
