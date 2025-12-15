# Getting Started with Logs

This guide will help you create your first Datadog logs queries and explore log data in Grafana.

## Prerequisites

Before starting, ensure you have:
- ✅ [Installed the plugin](../installation.md)
- ✅ [Configured your datasource](../configuration.md)
- ✅ Valid Datadog API credentials with logs access
- ✅ Log data in your Datadog account
- ✅ API key with `logs_read_data` scope enabled

## 🎯 Your First Logs Query

### Step 1: Create a Dashboard

1. Go to **Dashboards** → **New** → **New Dashboard**
2. Click **Add visualization**
3. Select your **Datadog** datasource from the dropdown

### Step 2: Switch to Logs Query Mode

1. In the query editor, find the **Query Type** dropdown
2. Select **Logs** (instead of Metrics)
3. The interface will switch to logs query mode

### Step 3: Write a Basic Logs Query

Start with a simple error search:

```
error
```

**What this does**:
- Searches for logs containing the word "error"
- Returns recent log entries matching the search term
- Shows results in Grafana's logs panel

Click **Run query** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux).

### Step 4: Add Service Filtering

Filter logs by a specific service:

```
service:web-app error
```

Now you'll see only error logs from the "web-app" service.

## 🔍 Using Logs Autocomplete

The plugin provides intelligent autocomplete for logs queries:

### Service Autocomplete
1. Type: `service:`
2. Autocomplete shows: `web-app`, `api-gateway`, `database`, etc.
3. Select a service: `service:web-app`

### Status Level Autocomplete
1. Type: `status:`
2. Autocomplete shows: `ERROR`, `WARN`, `INFO`, `DEBUG`, etc.
3. Select a level: `status:ERROR`

### Source Autocomplete
1. Type: `source:`
2. Autocomplete shows: `nginx`, `apache`, `application`, etc.
3. Select a source: `source:nginx`

### Keyboard Shortcuts
- `Cmd+Enter` / `Ctrl+Enter` - Execute query
- `Arrow keys` - Navigate suggestions
- `Enter` - Select suggestion
- `Escape` - Close autocomplete

## 🔧 JSON Log Parsing

For logs containing structured JSON data, you can enable JSON parsing to extract individual fields:

### Quick Setup
1. In the query editor, find the **JSON Parsing** section
2. Toggle **Enable JSON Parsing** to `ON`
3. Select which field contains JSON: `message`, `data`, `attributes`, or `whole_log`
4. Run your query to see parsed fields as separate columns

### Example
```bash
# Before: JSON string in message
message: "{\"user_id\":123,\"action\":\"login\",\"result\":\"success\"}"

# After: Individual accessible fields
parsed_user_id: 123
parsed_action: "login"
parsed_result: "success"
```

**Learn more**: [Complete JSON Parsing Guide](json-parsing.md)

## 📊 Logs Query Examples by Use Case

### Application Monitoring

```bash
# Error logs from specific service
service:web-app status:ERROR

# Application errors with stack traces
error AND service:api-gateway

# Failed authentication attempts
"authentication failed" OR "login failed"

# Database connection issues
service:database AND ("connection" OR "timeout")
```

### Infrastructure Monitoring

```bash
# Nginx access logs with errors
source:nginx status:ERROR

# High response times
source:nginx AND @http.response_time:>1000

# SSL certificate issues
"ssl" AND ("certificate" OR "cert") AND ("expired" OR "invalid")

# Disk space warnings
"disk space" OR "storage" AND ("warning" OR "critical")
```

### Security Monitoring

```bash
# Failed login attempts
"failed login" OR "authentication failed"

# Suspicious IP addresses
@network.client.ip:192.168.1.100

# Security events
@evt.name:security AND status:ERROR

# Unauthorized access attempts
"unauthorized" OR "forbidden" OR "access denied"
```

### Performance Monitoring

```bash
# Slow queries
@duration:>5000 AND service:database

# High memory usage
"memory" AND ("high" OR "exceeded" OR "limit")

# Response time issues
@http.response_time:>2000

# Queue processing delays
"queue" AND ("delay" OR "timeout" OR "backlog")
```

## 🎨 Customizing Logs Visualization

### Panel Configuration

1. **Panel Title**: Give your panel a descriptive name like "Application Errors"
2. **Time Range**: Adjust time window as needed
3. **Refresh**: Set auto-refresh interval
4. **Max Data Points**: Control how many log entries to show

### Logs Panel Options

1. **Show Time**: Display timestamps for each log entry
2. **Show Labels**: Display log labels and metadata
3. **Wrap Lines**: Control line wrapping for long log messages
4. **Deduplication**: Remove duplicate log entries

### Log Level Colors

Grafana automatically colors log levels:
- 🔴 **ERROR** - Red
- 🟡 **WARN** - Yellow  
- 🔵 **INFO** - Blue
- ⚪ **DEBUG** - Gray

## 🔧 Advanced Logs Queries

### Boolean Operators

```bash
# Multiple conditions with AND
service:web-app AND status:ERROR AND @env:production

# Alternative conditions with OR
status:ERROR OR status:WARN

# Exclude conditions with NOT
service:web-app AND NOT status:DEBUG

# Complex combinations
(service:web-app OR service:api) AND status:ERROR AND NOT @env:test
```

### Facet Filtering

```bash
# Custom attributes (use @ prefix)
@env:production
@version:1.2.3
@user.id:12345

# Standard facets
service:web-app
source:nginx
host:server-01
status:ERROR
```

### Wildcard Searches

```bash
# Service name patterns
service:web-*

# Host patterns
host:prod-*

# Message content patterns
"error*" AND service:api
```

### Time-based Filtering

```bash
# Recent errors (last hour)
status:ERROR @timestamp:>now-1h

# Specific time range (handled by Grafana time picker)
# Use Grafana's time range selector instead of inline time filters
```

## 📈 Building Your First Logs Dashboard

### 1. Error Monitoring Dashboard

Create panels for:
- **Application Errors**: `service:web-app status:ERROR`
- **Infrastructure Errors**: `source:nginx status:ERROR`
- **Database Errors**: `service:database status:ERROR`
- **Security Events**: `@evt.category:security status:ERROR`

### 2. Service Health Dashboard

Create panels for:
- **Service Logs**: `service:web-app`
- **Error Rate**: `service:web-app status:ERROR`
- **Performance Issues**: `service:web-app @duration:>1000`
- **User Activity**: `service:web-app @http.method:POST`

### 3. Infrastructure Dashboard

Create panels for:
- **System Logs**: `source:syslog`
- **Web Server Logs**: `source:nginx OR source:apache`
- **Container Logs**: `source:docker OR source:kubernetes`
- **Security Logs**: `source:auth OR @evt.category:security`

## 🔍 Using Grafana Explore with Logs

Explore mode is perfect for logs investigation:

1. Go to **Explore** in Grafana
2. Select your Datadog datasource
3. Switch to **Logs** query type
4. Use the same query syntax with full autocomplete
5. Perfect for:
   - Investigating incidents
   - Exploring log patterns
   - Testing queries before adding to dashboards
   - Following log trails during troubleshooting

## 🏷️ Dashboard Variables for Logs

Create dynamic logs dashboards with variables:

### 1. Create Service Variable

1. Go to **Dashboard Settings** → **Variables**
2. Click **Add variable**
3. Configure:
   - **Name**: `service`
   - **Type**: Query
   - **Query**: Use logs service autocomplete

### 2. Use Variables in Logs Queries

```bash
# Use variable in query
service:$service status:ERROR

# Multiple selection
service:$service AND @env:$environment
```

### 3. Variable Query Examples

```bash
# Get all services from logs
# (Use the logs services autocomplete endpoint)

# Get environments for selected service
@env:* AND service:$service

# Get hosts for selected service
host:* AND service:$service
```

## ⚡ Performance Tips for Logs

### Query Optimization

1. **Use specific filters**: `service:web-app` instead of `*`
2. **Limit time range**: Shorter ranges = faster queries
3. **Use status filters**: `status:ERROR` instead of searching all levels
4. **Combine filters**: `service:web-app status:ERROR` is more efficient

### Dashboard Performance

1. **Limit panels**: 5-10 logs panels per dashboard
2. **Use variables**: Reduce duplicate queries
3. **Set refresh intervals**: Don't auto-refresh too frequently
4. **Use appropriate time ranges**: Last 1 hour vs last 7 days

## 🚨 Common Issues

### Query Not Working

**Issue**: No logs showing
**Solutions**:
1. Check time range - ensure it covers when logs exist
2. Verify service/source names exist
3. Check API permissions - ensure `logs_read_data` scope
4. Test query in Datadog UI first

### Autocomplete Not Working

**Issue**: No suggestions appearing
**Solutions**:
1. Check datasource configuration
2. Verify API credentials have logs access
3. Check browser console for errors
4. Ensure cursor is in correct position

### Performance Issues

**Issue**: Queries taking too long
**Solutions**:
1. Reduce time range
2. Add more specific filters
3. Use status/service filters
4. Check Datadog API limits

### Permission Errors

**Issue**: "logs_read_data" permission errors
**Solutions**:
1. Check API key permissions in Datadog
2. Ensure API key has logs access scope
3. Verify App key is correctly configured
4. Contact Datadog admin to grant permissions

## 📚 Next Steps

Now that you've created your first logs queries:

1. **[Explore advanced features](query-syntax.md)** - Complex queries, facets, operators
2. **[Parse JSON logs](json-parsing.md)** - Extract structured data from JSON log fields
3. **[See more examples](../examples/logs-queries.md)** - Real-world query patterns
4. **[Learn about log correlation](correlation.md)** - Connect logs with metrics
5. **[Performance tuning](../advanced/performance.md)** - Optimize your queries

## 🆘 Need Help?

- **Logs Query Syntax**: [Datadog Logs Search Docs](https://docs.datadoghq.com/logs/search_syntax/)
- **Plugin Issues**: [GitHub Issues](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **General Questions**: [GitHub Discussions](https://github.com/wasilak/grafana-datadog-datasource/discussions)