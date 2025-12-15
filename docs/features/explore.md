# Grafana Explore Integration

Grafana Explore is perfect for ad-hoc investigation, troubleshooting, and exploring your Datadog data without creating permanent dashboards.

## Overview

The Datadog datasource plugin provides full support for Grafana Explore, including:

- **Metrics exploration** with full autocomplete
- **Logs exploration** with search and filtering
- **Query history** and sharing
- **Split view** for correlation analysis
- **Export to dashboard** functionality

## Getting Started with Explore

### Accessing Explore

1. Click **Explore** in the Grafana sidebar
2. Select your **Datadog** datasource from the dropdown
3. Start typing your query with full autocomplete support

### Query Types

Explore supports both metrics and logs queries:

#### Metrics Mode (Default)
- Full Datadog query language support
- Real-time autocomplete for metrics, tags, and functions
- Time series visualization
- Formula support

#### Logs Mode
- Switch query type to "Logs"
- Datadog logs search syntax
- Logs panel visualization
- Volume histogram support

## Metrics Exploration

### Basic Queries

Start with simple metric exploration:

```bash
# Explore CPU usage
system.cpu.user

# With aggregation
avg:system.cpu.user{*}

# Group by host
avg:system.cpu.user{*} by {host}
```

### Advanced Exploration

Use Explore for complex investigations:

```bash
# Compare environments
avg:system.cpu.user{env:prod} by {host}
avg:system.cpu.user{env:staging} by {host}

# Investigate specific issues
avg:system.load.1{host:web-*} by {host}
max:system.disk.used{mount_point:/var/log} by {host}
```

### Formula Exploration

Test formulas before adding to dashboards:

```bash
# Query A: avg:container.memory.usage{service:web}
# Query B: avg:container.memory.limit{service:web}
# Formula: $A * 100 / $B
```

## Logs Exploration

### Basic Log Searches

Explore logs with simple searches:

```bash
# All error logs
status:ERROR

# Service-specific logs
service:web-app

# Time-based filtering
service:web-app AND @timestamp:>now-1h
```

### Advanced Log Exploration

Investigate complex issues:

```bash
# Error correlation
service:web-app AND status:ERROR AND message:"database"

# Performance issues
service:api AND (message:"timeout" OR message:"slow")

# Security investigation
source:nginx AND (status:401 OR status:403)
```

### Log Volume Analysis

Use logs volume histogram to understand patterns:

1. Run a logs query
2. View the volume histogram above the logs
3. Click on time periods to zoom in
4. Correlate volume spikes with specific log entries

## Split View for Correlation

Use split view to correlate metrics and logs:

### Setup Split View

1. Click the **Split** button in Explore
2. Configure different queries in each pane:
   - **Left pane**: Metrics query (e.g., error rate)
   - **Right pane**: Logs query (e.g., error logs)

### Correlation Examples

#### Application Performance Investigation

**Left Pane (Metrics)**:
```bash
# Response time
avg:trace.web.request.duration{service:web-app} by {service}

# Error rate
sum:trace.web.request.errors{service:web-app} by {service}
```

**Right Pane (Logs)**:
```bash
# Error logs
service:web-app AND status:ERROR

# Performance logs
service:web-app AND message:"slow"
```

#### Infrastructure Troubleshooting

**Left Pane (Metrics)**:
```bash
# CPU usage
avg:system.cpu.user{host:web-*} by {host}

# Memory usage
avg:system.mem.used{host:web-*} by {host}
```

**Right Pane (Logs)**:
```bash
# System logs
host:web-* AND source:syslog

# Application logs
host:web-* AND service:web-app
```

## Query History and Sharing

### Query History

Explore automatically saves your query history:

1. Click the **History** tab
2. Browse previous queries
3. Click to rerun or modify queries
4. Star important queries for quick access

### Sharing Investigations

Share your exploration with team members:

1. **Copy Link**: Share the current Explore state
2. **Export to Dashboard**: Create a dashboard panel from your query
3. **Create Alert**: Set up alerting based on your exploration

## Advanced Features

### Time Range Investigation

Use Explore's time controls for investigation:

- **Zoom**: Click and drag on the graph to zoom in
- **Time picker**: Select specific time ranges
- **Refresh**: Auto-refresh for live investigation
- **Relative time**: Use "Last 5 minutes" for real-time monitoring

### Query Inspector

Use the Query Inspector to debug queries:

1. Click the **Query Inspector** button
2. View the actual API request sent to Datadog
3. See response data and timing information
4. Debug autocomplete and query issues

### Keyboard Shortcuts

Speed up your exploration with shortcuts:

- `Cmd+Enter` / `Ctrl+Enter`: Run query
- `Cmd+K` / `Ctrl+K`: Focus query editor
- `Cmd+Shift+D` / `Ctrl+Shift+D`: Export to dashboard
- `Cmd+H` / `Ctrl+H`: Toggle query history

## Use Cases

### Incident Investigation

1. **Start with metrics**: Identify when the issue started
2. **Switch to logs**: Find specific error messages
3. **Use split view**: Correlate metrics spikes with log events
4. **Share findings**: Export to dashboard or share link

### Performance Analysis

1. **Explore response times**: `avg:trace.web.request.duration{*} by {service}`
2. **Check error rates**: `sum:trace.web.request.errors{*} by {service}`
3. **Investigate logs**: `status:ERROR AND message:"performance"`
4. **Create dashboard**: Export successful queries to permanent dashboard

### Capacity Planning

1. **Resource utilization**: `avg:system.cpu.user{*} by {host}`
2. **Growth trends**: Use longer time ranges
3. **Forecast**: Use formulas to project growth
4. **Document findings**: Export to dashboard for ongoing monitoring

### Security Investigation

1. **Failed logins**: `source:auth AND status:401`
2. **Suspicious activity**: `source:nginx AND status:403`
3. **Correlate with metrics**: Check if attacks affect performance
4. **Create alerts**: Set up monitoring for security events

## Best Practices

### Efficient Exploration

1. **Start broad, then narrow**: Begin with general queries, add filters
2. **Use time ranges**: Limit scope to relevant time periods
3. **Leverage autocomplete**: Let the plugin suggest valid options
4. **Save successful queries**: Use history and starring features

### Investigation Workflow

1. **Define the problem**: What are you trying to understand?
2. **Start with metrics**: Get the big picture
3. **Drill down with logs**: Find specific details
4. **Use split view**: Correlate different data types
5. **Document findings**: Export or share results

### Performance Tips

1. **Limit time ranges**: Shorter ranges = faster queries
2. **Use specific filters**: Avoid overly broad queries
3. **Leverage caching**: Repeated queries use cached results
4. **Monitor query performance**: Use Query Inspector for slow queries

## Troubleshooting

### Queries Not Working

**Issue**: Query returns no data in Explore
**Solutions**:
1. Check time range - ensure it covers data period
2. Verify query syntax - use autocomplete for validation
3. Test in dashboard first - ensure basic connectivity
4. Check API permissions - especially for logs queries

### Autocomplete Issues

**Issue**: No autocomplete suggestions
**Solutions**:
1. Verify datasource configuration
2. Check API credentials and scopes
3. Ensure cursor is in correct position
4. Try refreshing the page

### Performance Problems

**Issue**: Explore is slow or unresponsive
**Solutions**:
1. Reduce time range
2. Add more specific filters
3. Avoid overly complex queries
4. Check network connectivity

## Integration with Dashboards

### Export to Dashboard

Convert exploration to permanent monitoring:

1. Perfect your query in Explore
2. Click **Add to Dashboard**
3. Choose existing dashboard or create new
4. Configure panel settings
5. Save dashboard

### From Dashboard to Explore

Investigate dashboard anomalies:

1. Click **Explore** on any dashboard panel
2. Query opens in Explore with same time range
3. Modify query for deeper investigation
4. Use split view for additional context

## Related Documentation

- [Getting Started](../getting-started.md) - Basic query syntax
- [Metrics Autocomplete](../metrics/autocomplete.md) - Metrics exploration features
- [Logs Query Syntax](../logs/query-syntax.md) - Logs exploration features
- [Dashboard Variables](variables.md) - Using variables in Explore
- [Performance Tips](../advanced/performance.md) - Optimizing exploration queries