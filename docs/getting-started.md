# Getting Started Guide

This guide will help you create your first Datadog queries and dashboards in Grafana.

## Prerequisites

Before starting, ensure you have:
- ✅ [Installed the plugin](installation.md)
- ✅ [Configured your datasource](configuration.md)
- ✅ Valid Datadog API credentials with `logs_read_data` scope
- ✅ Metrics and/or logs data in your Datadog account

## 🎯 Your First Query

### Step 1: Create a Dashboard

1. Go to **Dashboards** → **New** → **New Dashboard**
2. Click **Add visualization**
3. Select your **Datadog** datasource from the dropdown

### Step 2: Choose Query Type

The plugin supports both **Metrics** and **Logs** queries:

#### Metrics Query (Default)

Start with a simple CPU usage query:

```
avg:system.cpu.user{*}
```

**What this does**:
- `avg` - Aggregation function (average)
- `system.cpu.user` - Metric name
- `{*}` - Tag filter (all hosts)

#### Logs Query

Switch to logs mode and search for errors:

```
status:ERROR
```

**What this does**:
- `status:ERROR` - Find all logs with ERROR status
- Results show in a logs panel with timestamps and messages

### Step 3: Add Grouping (Metrics)

Group by host to see individual servers:

```
avg:system.cpu.user{*} by {host}
```

Now you'll see separate lines for each host.

### Step 3: Add Filtering (Logs)

Filter logs by service and level:

```
service:web-app AND (status:ERROR OR status:WARN)
```

Now you'll see only error and warning logs from the web-app service.

Click **Run query** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux).

## 🔍 Using Autocomplete

The plugin provides intelligent autocomplete to help you build queries:

### Metric Autocomplete
1. Start typing: `sys`
2. Autocomplete shows: `system.cpu.user`, `system.memory.used`, etc.
3. Use arrow keys to navigate, Enter to select

### Tag Autocomplete
1. Type: `avg:system.cpu.user{`
2. Autocomplete shows available tags: `host`, `service`, `env`, etc.
3. Select a tag: `avg:system.cpu.user{host:`
4. Autocomplete shows tag values: `web-01`, `db-01`, etc.

### Keyboard Shortcuts
- `Cmd+Enter` / `Ctrl+Enter` - Execute query
- `Arrow keys` - Navigate suggestions
- `Enter` - Select suggestion
- `Escape` - Close autocomplete
- `Cmd+/` / `Ctrl+/` - Toggle comment

## 📊 Query Examples by Use Case

### System Monitoring (Metrics)

```bash
# CPU usage by host
avg:system.cpu.user{*} by {host}

# Memory usage percentage
avg:system.mem.pct_usable{*} by {host}

# Disk usage
avg:system.disk.used{*} by {host,device}

# Network traffic
avg:system.net.bytes_rcvd{*} by {host}
```

### Container Monitoring (Metrics)

```bash
# Container CPU usage
avg:container.cpu.usage{*} by {container_name}

# Container memory usage
avg:container.memory.usage{*} by {container_name}

# Running containers count
sum:docker.containers.running{*}

# Container restarts
sum:kubernetes.containers.restarts{*} by {pod_name}
```

### Application Monitoring (Metrics)

```bash
# Request rate
sum:trace.web.request.hits{*} by {service}

# Response time
avg:trace.web.request.duration{*} by {service}

# Error rate
sum:trace.web.request.errors{*} by {service}

# Database connections
avg:postgresql.connections{*} by {db}
```

### Logs Monitoring

```bash
# Error logs across all services
status:ERROR

# Service-specific logs
service:web-app

# Application errors with context
service:web-app AND status:ERROR

# Database connection issues
source:postgresql AND message:"connection"

# High-severity issues
status:(ERROR OR FATAL) AND NOT message:"test"

# Performance issues
message:"timeout" OR message:"slow query"

# Security-related logs
source:nginx AND (status:401 OR status:403)

# Container logs
source:kubernetes AND pod_name:web-*
```

## 🎨 Customizing Visualizations

### Legend Configuration

**Auto Mode** (default):
- Shows: `avg:system.cpu.user{host:web-01} by {host} {host:web-01}`
- Includes metric name and all labels

**Custom Mode**:
- Template: `CPU: {{host}}`
- Shows: `CPU: web-01`

### Panel Options

1. **Panel Title**: Give your panel a descriptive name
2. **Unit**: Set appropriate units (percent, bytes, etc.)
3. **Thresholds**: Add warning/critical thresholds
4. **Time Range**: Adjust time window as needed

## 🔧 Advanced Queries

### Boolean Operators

```bash
# Multiple services
avg:system.cpu.user{service IN (web,api)} by {host}

# Exclude staging
avg:system.cpu.user{env NOT IN (staging,dev)} by {host}

# Complex conditions
avg:system.load.1{env:prod AND service:web OR service:api} by {host}
```

### Mathematical Expressions

Create formulas using multiple queries:

**Query A**: `sum:container.memory.usage{service:web}`
**Query B**: `sum:container.memory.limit{service:web}`
**Formula**: `$A * 100 / $B`

Result: Memory usage percentage

### Time Aggregation

```bash
# 5-minute average
avg:system.cpu.user{*}.rollup(avg, 300)

# Maximum over 1 hour
max:system.cpu.user{*}.rollup(max, 3600)

# Sum over 15 minutes
sum:custom.metric{*}.rollup(sum, 900)
```

## 📈 Building Your First Dashboard

### 1. System Overview Dashboard

Create panels for:
- **CPU Usage**: `avg:system.cpu.user{*} by {host}`
- **Memory Usage**: `avg:system.mem.pct_usable{*} by {host}`
- **Disk Usage**: `avg:system.disk.used{*} by {host}`
- **Network I/O**: `avg:system.net.bytes_sent{*} by {host}`

### 2. Application Performance Dashboard

Create panels for:
- **Request Rate**: `sum:trace.web.request.hits{*} by {service}`
- **Response Time**: `avg:trace.web.request.duration{*} by {service}`
- **Error Rate**: `sum:trace.web.request.errors{*} by {service}`
- **Throughput**: Formula combining multiple metrics

### 3. Container Dashboard

Create panels for:
- **Running Containers**: `sum:docker.containers.running{*}`
- **CPU by Container**: `avg:container.cpu.usage{*} by {container_name}`
- **Memory by Container**: `avg:container.memory.usage{*} by {container_name}`
- **Container Restarts**: `sum:kubernetes.containers.restarts{*} by {pod_name}`

### 4. Logs Monitoring Dashboard

Create panels for:
- **Error Logs**: `status:ERROR` (Logs panel)
- **Service Logs**: `service:web-app` (Logs panel)
- **Log Volume**: `*` (Logs panel with volume histogram)
- **Critical Issues**: `status:(ERROR OR FATAL)` (Logs panel)

**Pro Tip**: Use logs panels for detailed log inspection and combine with metrics panels for correlation.

## 🔍 Using Grafana Explore

Explore mode is perfect for ad-hoc investigation:

1. Go to **Explore** in Grafana
2. Select your Datadog datasource
3. Use the same query syntax with full autocomplete
4. Perfect for:
   - Investigating incidents
   - Exploring new metrics
   - Testing queries before adding to dashboards

## 🏷️ Dashboard Variables

Create dynamic dashboards with variables:

### 1. Create a Variable

1. Go to **Dashboard Settings** → **Variables**
2. Click **Add variable**
3. Configure:
   - **Name**: `host`
   - **Type**: Query
   - **Query**: Use the variable query editor

### 2. Use Variables in Queries

```bash
# Use variable in query
avg:system.cpu.user{host:$host} by {host}

# Multiple selection
avg:system.cpu.user{host IN ($host)} by {host}
```

### 3. Variable Query Examples

```bash
# Get all hosts
tag_values(system.cpu.user, host)

# Get services for selected environment
tag_values(trace.web.request, service, env:$env)

# Get environments
tag_values(*, env)
```

## ⚡ Performance Tips

### Metrics Query Optimization

1. **Use specific tags**: `{host:web-01}` instead of `{*}`
2. **Limit time range**: Shorter ranges = faster queries
3. **Use appropriate aggregation**: `avg` vs `sum` vs `max`
4. **Group wisely**: Too many groups = slow queries

### Logs Query Optimization

1. **Use specific filters**: `service:web-app` instead of `*`
2. **Limit time range**: Logs queries can be expensive over long periods
3. **Use facet filters**: `status:ERROR` is faster than free-text search
4. **Combine filters**: `service:web-app AND status:ERROR` is more efficient

### Dashboard Performance

1. **Limit panels**: 10-15 panels per dashboard
2. **Use variables**: Reduce duplicate queries
3. **Set refresh intervals**: Don't auto-refresh too frequently
4. **Cache queries**: Both metrics and logs APIs have built-in caching
5. **Mix panel types**: Use logs panels for detailed inspection, metrics for trends

## 🚨 Common Issues

### Metrics Query Not Working

**Issue**: No metrics data showing
**Solutions**:
1. Check time range - ensure it covers when data exists
2. Verify metric name spelling
3. Check tag filters - ensure tags exist
4. Test in Datadog UI first

### Logs Query Not Working

**Issue**: No logs data showing
**Solutions**:
1. Verify API key has `logs_read_data` scope
2. Check time range - logs may not exist in selected period
3. Verify log query syntax (use Datadog logs search syntax)
4. Test query in Datadog Logs Explorer first

### Autocomplete Not Working

**Issue**: No suggestions appearing
**Solutions**:
1. Check datasource configuration
2. Verify API credentials and scopes
3. Check browser console for errors
4. Ensure cursor is in correct position
5. For logs: verify `logs_read_data` scope is enabled

### Performance Issues

**Issue**: Queries taking too long
**Solutions**:
1. Reduce time range
2. Add more specific filters (metrics: tags, logs: facets)
3. Use fewer grouping tags (metrics only)
4. Check Datadog API limits
5. For logs: use facet filters instead of free-text search

### Permission Errors

**Issue**: "API key missing required permissions"
**Solutions**:
1. For metrics: ensure API key is valid
2. For logs: ensure API key has `logs_read_data` scope
3. Check API key hasn't been rotated in Datadog
4. Verify correct Datadog site (US vs EU)

## 📚 Next Steps

Now that you've created your first queries:

1. **[Explore metrics features](metrics/)** - Formulas, variables, legends
2. **[Learn logs syntax](logs/)** - Complete logs search guide
3. **[See more examples](examples/)** - Real-world query patterns
4. **[Performance tuning](advanced/performance.md)** - Optimize your queries
5. **[Troubleshooting](advanced/troubleshooting.md)** - Solve common issues

## 🆘 Need Help?

- **Query Syntax**: [Datadog Query Language Docs](https://docs.datadoghq.com/dashboards/querying/)
- **Plugin Issues**: [GitHub Issues](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **General Questions**: [GitHub Discussions](https://github.com/wasilak/grafana-datadog-datasource/discussions)