# Dashboard Variables

Dashboard variables make your dashboards dynamic and reusable by allowing users to filter and customize the data displayed across multiple panels.

## Overview

The Datadog datasource plugin provides comprehensive support for Grafana dashboard variables, including:

- **Query variables** - Populate from Datadog API data
- **Custom variables** - User-defined values
- **Constant variables** - Fixed values
- **Text box variables** - User input
- **Multi-value selection** - Select multiple values
- **All option** - Include all available values

## Creating Variables

### 1. Basic Setup

1. Go to **Dashboard Settings** → **Variables**
2. Click **Add variable**
3. Configure the variable:
   - **Name**: Variable identifier (e.g., `host`, `service`, `env`)
   - **Type**: Usually "Query" for Datadog data
   - **Label**: Display name for users

### 2. Query Variables

Query variables fetch values from your Datadog data:

#### Host Variable
```
tag_values(system.cpu.user, host)
```
Returns all hosts that have the `system.cpu.user` metric.

#### Service Variable
```
tag_values(trace.web.request, service)
```
Returns all services from trace data.

#### Environment Variable
```
tag_values(*, env)
```
Returns all environment values across all metrics.

#### Conditional Variables
```
tag_values(system.cpu.user, service, env:$environment)
```
Returns services filtered by the selected environment.

### 3. Variable Options

- **Multi-value**: Allow selecting multiple values
- **Include All option**: Add "All" choice to select everything
- **Custom all value**: Define what "All" means (e.g., `*` or `{*}`)
- **Preview of values**: See what values the query returns

## Using Variables in Queries

### Metrics Queries

#### Single Value
```bash
# Variable: $host = "web-01"
avg:system.cpu.user{host:$host}
# Result: avg:system.cpu.user{host:web-01}
```

#### Multiple Values
```bash
# Variable: $host = ["web-01", "web-02"]
avg:system.cpu.user{host IN ($host)} by {host}
# Result: avg:system.cpu.user{host IN (web-01,web-02)} by {host}
```

#### All Values
```bash
# Variable: $host = "All" (custom all value: *)
avg:system.cpu.user{host:$host}
# Result: avg:system.cpu.user{host:*}
```

### Logs Queries

#### Service Filtering
```bash
# Variable: $service = "web-app"
service:$service AND status:ERROR
# Result: service:web-app AND status:ERROR
```

#### Multiple Services
```bash
# Variable: $service = ["web-app", "api-service"]
service:($service) AND status:ERROR
# Result: service:(web-app OR api-service) AND status:ERROR
```

#### Environment Filtering
```bash
# Variable: $env = "production"
@env:$env AND status:ERROR
# Result: @env:production AND status:ERROR
```

## Variable Query Examples

### Common Patterns

#### Get All Hosts
```
tag_values(system.cpu.user, host)
```

#### Get Services by Environment
```
tag_values(trace.web.request, service, env:$environment)
```

#### Get Containers by Service
```
tag_values(container.cpu.usage, container_name, service:$service)
```

#### Get Database Names
```
tag_values(postgresql.connections, db)
```

#### Get Kubernetes Namespaces
```
tag_values(kubernetes.cpu.usage, kube_namespace)
```

### Advanced Queries

#### Filtered by Multiple Conditions
```
tag_values(system.cpu.user, host, env:$env AND service:$service)
```

#### With Regex Filtering
```
tag_values(system.cpu.user, host, host:/web-.*/)
```

#### Cross-Metric Queries
```
tag_values(system.*, host)
```

## Variable Formatting

Variables can be formatted differently depending on context:

### Format Options

- **Default**: `web-01,web-02`
- **Pipe**: `web-01|web-02`
- **Distributed**: `{host:web-01},{host:web-02}`
- **CSV**: `"web-01","web-02"`
- **JSON**: `["web-01","web-02"]`

### Custom Formatting

For complex scenarios, use custom formatting:

```bash
# Custom format for Datadog tags
${host:pipe}
# Result: web-01|web-02

# Custom format for logs
${service:csv}
# Result: "web-app","api-service"
```

## Chaining Variables

Create dependent variables that filter based on other selections:

### Example: Environment → Service → Host

1. **Environment Variable**:
   ```
   tag_values(*, env)
   ```

2. **Service Variable** (depends on environment):
   ```
   tag_values(trace.web.request, service, env:$environment)
   ```

3. **Host Variable** (depends on service and environment):
   ```
   tag_values(system.cpu.user, host, env:$environment AND service:$service)
   ```

## Best Practices

### Performance

1. **Use specific metrics**: `tag_values(system.cpu.user, host)` is faster than `tag_values(*, host)`
2. **Add filters**: Reduce the dataset with conditions
3. **Cache appropriately**: Set reasonable refresh intervals
4. **Limit values**: Use regex or filters to limit large lists

### User Experience

1. **Meaningful names**: Use clear variable names and labels
2. **Logical order**: Order variables from general to specific
3. **Default values**: Set sensible defaults
4. **Multi-value support**: Enable when users might want multiple selections

### Query Design

1. **Consistent naming**: Use the same variable names across panels
2. **Fallback values**: Handle cases where variables might be empty
3. **All option**: Provide "All" option for flexibility
4. **Validation**: Test variables with different selections

## Troubleshooting

### Variable Not Populating

**Issue**: Variable query returns no values
**Solutions**:
1. Test the query in a regular panel first
2. Check if the metric/tag exists in your data
3. Verify time range includes data
4. Check API permissions

### Variable Not Working in Queries

**Issue**: Variable substitution not working
**Solutions**:
1. Check variable name matches exactly (`$host` vs `$Host`)
2. Verify variable scope (dashboard vs panel)
3. Test with simple values first
4. Check for special characters in values

### Performance Issues

**Issue**: Variables loading slowly
**Solutions**:
1. Add more specific filters to variable queries
2. Reduce time range for variable queries
3. Use caching appropriately
4. Consider using constant variables for static values

## Examples

### System Monitoring Dashboard

Variables:
- `$environment`: `tag_values(*, env)`
- `$service`: `tag_values(*, service, env:$environment)`
- `$host`: `tag_values(system.cpu.user, host, env:$environment AND service:$service)`

Queries:
- CPU: `avg:system.cpu.user{env:$environment AND service:$service AND host:$host} by {host}`
- Memory: `avg:system.mem.used{env:$environment AND service:$service AND host:$host} by {host}`

### Application Performance Dashboard

Variables:
- `$service`: `tag_values(trace.web.request, service)`
- `$version`: `tag_values(trace.web.request, version, service:$service)`

Queries:
- Request Rate: `sum:trace.web.request.hits{service:$service AND version:$version} by {service}`
- Response Time: `avg:trace.web.request.duration{service:$service AND version:$version} by {service}`

### Logs Monitoring Dashboard

Variables:
- `$service`: Query from logs API
- `$level`: `["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]` (Custom variable)
- `$host`: Query from logs API filtered by service

Queries:
- Service Logs: `service:$service AND status:$level`
- Error Logs: `service:$service AND status:ERROR`

## Advanced Features

### Template Functions

Use template functions for complex variable manipulation:

```bash
# Regex extraction
${host:regex:/web-(\d+)/}

# Text transformation
${service:upper}

# Default values
${host:default:*}
```

### Variable Interpolation

Variables are interpolated differently based on context:

- **Metrics**: Direct substitution with proper escaping
- **Logs**: Formatted for Datadog logs search syntax
- **Legends**: Template variable expansion

### Global Variables

Use Grafana's built-in global variables:

- `$__from` / `$__to`: Time range in milliseconds
- `$__interval`: Auto-calculated interval
- `$__timeFilter()`: Time range filter function

## Related Documentation

- [Metrics Query Editor](../metrics/query-editor.md) - Using variables in metrics queries
- [Logs Query Syntax](../logs/query-syntax.md) - Using variables in logs queries
- [Dashboard Examples](../examples/) - Real-world variable usage
- [Performance Tips](../advanced/performance.md) - Optimizing variable queries