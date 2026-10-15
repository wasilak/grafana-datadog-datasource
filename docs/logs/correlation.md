# Logs Correlation

Learn how to correlate logs with metrics and other observability data to get complete insights into your applications and infrastructure.

## 🎯 Overview

Logs correlation allows you to:
- **Connect logs with metrics** to understand performance impacts
- **Link logs across services** to trace request flows
- **Correlate with infrastructure data** to identify root causes
- **Build comprehensive dashboards** with multiple data types
- **Investigate incidents effectively** using all available data

## 🔗 Correlation Strategies

### 1. Service-Based Correlation

Correlate logs and metrics for the same service:

**Logs Query**:
```bash
service:web-app status:ERROR
```

**Metrics Query**:
```bash
avg:trace.web.request.errors{service:web-app} by {service}
```

**Use Case**: See error logs alongside error rate metrics to understand both what's failing and how often.

### 2. Host-Based Correlation

Correlate application logs with infrastructure metrics:

**Logs Query**:
```bash
host:web-01 status:ERROR
```

**Metrics Query**:
```bash
avg:system.cpu.user{host:web-01}
avg:system.mem.pct_usable{host:web-01}
```

**Use Case**: Determine if application errors correlate with resource exhaustion.

### 3. Time-Based Correlation

Use synchronized time ranges to correlate events:

**Logs Query**:
```bash
service:database "connection timeout"
```

**Metrics Query**:
```bash
avg:postgresql.connections{service:database}
avg:postgresql.max_connections{service:database}
```

**Use Case**: See if connection timeouts occur when approaching connection limits.

### 4. Trace-Based Correlation

Correlate logs using trace and span IDs:

**Logs Query**:
```bash
@trace_id:abc123 OR @span_id:def456
```

**Metrics Query**:
```bash
avg:trace.web.request.duration{trace_id:abc123}
```

**Use Case**: Follow a specific request through multiple services using distributed tracing.

## 📊 Dashboard Correlation Patterns

### Application Health Dashboard

Combine logs and metrics for comprehensive application monitoring:

```yaml
Panels:
  - Error Rate (Metrics):
      Query: sum:trace.web.request.errors{service:web-app}
      Visualization: Time series
      
  - Error Logs (Logs):
      Query: service:web-app status:ERROR
      Visualization: Logs
      
  - Response Time (Metrics):
      Query: avg:trace.web.request.duration{service:web-app}
      Visualization: Time series
      
  - Slow Request Logs (Logs):
      Query: service:web-app @http.response_time:>2000
      Visualization: Logs
```

### Infrastructure Correlation Dashboard

Link system metrics with application logs:

```yaml
Panels:
  - CPU Usage (Metrics):
      Query: avg:system.cpu.user{host:web-*} by {host}
      Visualization: Time series
      
  - Memory Usage (Metrics):
      Query: avg:system.mem.pct_usable{host:web-*} by {host}
      Visualization: Time series
      
  - System Errors (Logs):
      Query: host:web-* status:ERROR
      Visualization: Logs
      
  - Application Errors (Logs):
      Query: service:web-app status:ERROR
      Visualization: Logs
```

### Service Dependency Dashboard

Track requests across multiple services:

```yaml
Panels:
  - Frontend Errors (Logs):
      Query: service:frontend status:ERROR
      Visualization: Logs
      
  - API Errors (Logs):
      Query: service:api status:ERROR
      Visualization: Logs
      
  - Database Errors (Logs):
      Query: service:database status:ERROR
      Visualization: Logs
      
  - Request Flow (Metrics):
      Query: sum:trace.web.request.hits{*} by {service}
      Visualization: Time series
```

## 🔍 Investigation Workflows

### Performance Issue Investigation

1. **Start with metrics** to identify the problem:
   ```bash
   # High response time detected
   avg:trace.web.request.duration{service:web-app}
   ```

2. **Correlate with error logs**:
   ```bash
   service:web-app status:ERROR @timestamp:>now-1h
   ```

3. **Check infrastructure metrics**:
   ```bash
   avg:system.cpu.user{service:web-app}
   avg:system.mem.pct_usable{service:web-app}
   ```

4. **Look for specific error patterns**:
   ```bash
   service:web-app ("timeout" OR "connection" OR "memory")
   ```

### Error Spike Investigation

1. **Identify the spike time** from metrics dashboard

2. **Filter logs to that time period**:
   ```bash
   service:web-app status:ERROR @timestamp:[2023-12-01T14:00:00 TO 2023-12-01T14:30:00]
   ```

3. **Group errors by type**:
   ```bash
   service:web-app status:ERROR "database"
   service:web-app status:ERROR "timeout"
   service:web-app status:ERROR "memory"
   ```

4. **Check upstream dependencies**:
   ```bash
   service:database status:ERROR @timestamp:[2023-12-01T14:00:00 TO 2023-12-01T14:30:00]
   ```

### Deployment Impact Analysis

1. **Check deployment logs**:
   ```bash
   @deployment.version:1.2.3 @timestamp:>now-2h
   ```

2. **Monitor error rates after deployment**:
   ```bash
   service:web-app status:ERROR @version:1.2.3
   ```

3. **Compare with previous version**:
   ```bash
   service:web-app status:ERROR @version:1.2.2
   ```

4. **Check rollback indicators**:
   ```bash
   "rollback" OR "revert" OR @deployment.status:failed
   ```

## 🏷️ Using Variables for Correlation

### Service Variable

Create a service variable to correlate across panels:

```yaml
Variable Configuration:
  Name: service
  Type: Query
  Query: # Use logs services autocomplete
  
Panel Queries:
  Logs: service:$service status:ERROR
  Metrics: avg:trace.web.request.errors{service:$service}
```

### Environment Variable

Filter all data by environment:

```yaml
Variable Configuration:
  Name: environment
  Type: Query
  Query: # Use logs field values for @env
  
Panel Queries:
  Logs: service:web-app @env:$environment status:ERROR
  Metrics: avg:system.cpu.user{env:$environment,service:web-app}
```

### Time Range Synchronization

Ensure all panels use the same time range:
- Use Grafana's global time picker
- Avoid inline time filters in queries
- Set appropriate refresh intervals

## 🔧 Advanced Correlation Techniques

### Log-Derived Metrics

Create metrics from log data for better correlation:

**Example**: Error rate from logs
```bash
# This would be a custom metric derived from logs
count(service:web-app status:ERROR) / count(service:web-app)
```

**Use Case**: When you have detailed logs but limited metrics, derive key metrics from log patterns.

### Trace ID Correlation

Use trace IDs to follow requests across services:

**Frontend Logs**:
```bash
service:frontend @trace_id:abc123
```

**API Logs**:
```bash
service:api @trace_id:abc123
```

**Database Logs**:
```bash
service:database @trace_id:abc123
```

**Use Case**: Debug specific user requests or transactions end-to-end.

### Anomaly Correlation

Correlate log anomalies with metric anomalies:

1. **Identify metric anomaly**:
   ```bash
   avg:trace.web.request.duration{service:web-app}
   # Notice spike at 14:30
   ```

2. **Check logs during anomaly**:
   ```bash
   service:web-app @timestamp:[2023-12-01T14:25:00 TO 2023-12-01T14:35:00]
   ```

3. **Look for error patterns**:
   ```bash
   service:web-app status:ERROR @timestamp:[2023-12-01T14:25:00 TO 2023-12-01T14:35:00]
   ```

### Business Metric Correlation

Correlate technical logs with business metrics:

**Technical Logs**:
```bash
service:payment status:ERROR
```

**Business Impact**:
```bash
# Custom metrics for business KPIs
sum:payment.transactions.failed{*}
sum:payment.revenue.lost{*}
```

**Use Case**: Understand how technical issues impact business outcomes.

## 📈 Correlation Patterns

### Error Correlation Matrix

| Log Pattern | Metric Correlation | Investigation Focus |
|-------------|-------------------|-------------------|
| `status:ERROR` | High error rate | Application bugs |
| `"timeout"` | High response time | Performance issues |
| `"memory"` | High memory usage | Resource exhaustion |
| `"connection"` | High connection count | Database issues |
| `"disk"` | High disk usage | Storage problems |

### Performance Correlation Matrix

| Log Pattern | Metric Correlation | Root Cause |
|-------------|-------------------|------------|
| `@http.response_time:>2000` | High CPU usage | CPU bottleneck |
| `"slow query"` | High DB connections | Database performance |
| `"cache miss"` | High memory usage | Cache efficiency |
| `"queue full"` | High queue depth | Processing backlog |

## 🎨 Visualization Best Practices

### Panel Layout

1. **Metrics first**: Show quantitative data prominently
2. **Logs second**: Provide qualitative context
3. **Group related data**: Keep correlated panels together
4. **Use consistent time ranges**: Synchronize all panels

### Color Coordination

- **Red**: Errors and critical issues
- **Yellow**: Warnings and performance issues  
- **Green**: Success and healthy states
- **Blue**: Information and normal operations

### Annotation Strategy

Use annotations to mark:
- Deployment events
- Configuration changes
- Known incidents
- Maintenance windows

## 🚨 Common Correlation Pitfalls

### Time Synchronization Issues

**Problem**: Logs and metrics show different timestamps
**Solution**: 
- Ensure all systems use NTP
- Account for timezone differences
- Use UTC timestamps consistently

### Sampling Differences

**Problem**: Logs show all events, metrics are sampled
**Solution**:
- Understand sampling rates
- Use appropriate aggregation periods
- Consider log-derived metrics for consistency

### Cardinality Mismatches

**Problem**: Log facets don't match metric tags
**Solution**:
- Standardize naming conventions
- Use mapping variables when needed
- Document tag/facet relationships

### Context Loss

**Problem**: Correlation loses important context
**Solution**:
- Include relevant metadata in both logs and metrics
- Use structured logging
- Maintain trace context across services

## 📊 Correlation Metrics

### Effectiveness Indicators

Track these metrics to measure correlation effectiveness:

1. **Mean Time to Detection (MTTD)**:
   - Time from issue occurrence to detection
   - Should decrease with better correlation

2. **Mean Time to Resolution (MTTR)**:
   - Time from detection to resolution
   - Should decrease with comprehensive correlation

3. **False Positive Rate**:
   - Alerts that don't indicate real issues
   - Should decrease with better correlation logic

4. **Coverage**:
   - Percentage of issues detected through correlation
   - Should increase over time

## 🔗 Integration Examples

### Grafana Explore Workflow

1. **Start in Explore** with a metric query
2. **Switch to logs** using the same time range
3. **Use service/host filters** to correlate
4. **Copy successful queries** to dashboards

### Alert Correlation

Create alerts that consider both logs and metrics:

```yaml
Alert Rule:
  Condition: 
    - Metric: avg:trace.web.request.errors{service:web-app} > 10
    - AND
    - Log Count: count(service:web-app status:ERROR) > 50 in 5m
  
  Action: Send notification with both metric value and recent error logs
```

### Automated Correlation

Use Grafana's alerting to automatically correlate:

1. **Metric threshold exceeded**
2. **Automatically query related logs**
3. **Include log samples in alert**
4. **Provide correlation dashboard link**

## 📚 Next Steps

- [Advanced Dashboards](../examples/logs-dashboards.md) - Complete dashboard examples
- [Performance Optimization](../advanced/performance.md) - Optimize correlation queries
- [Troubleshooting](../advanced/troubleshooting.md) - Debug correlation issues