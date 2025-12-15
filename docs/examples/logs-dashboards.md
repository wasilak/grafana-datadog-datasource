# Logs Dashboard Examples

Complete dashboard configurations for common logs monitoring scenarios using the Datadog datasource plugin.

## 🎯 Overview

This guide provides ready-to-use dashboard configurations for:
- **Application monitoring** with logs and metrics correlation
- **Infrastructure monitoring** across services and hosts
- **Security monitoring** with threat detection
- **Business monitoring** with KPI tracking
- **Incident response** with comprehensive views

## 📊 Application Health Dashboard

### Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Application Health - Logs & Metrics",
    "tags": ["logs", "application", "health"],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s",
    "panels": [...]
  }
}
```

### Panel 1: Error Rate Overview

```yaml
Panel Configuration:
  Title: "Error Rate by Service"
  Type: "logs"
  Query: "status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
    wrapLogMessage: true
    enableLogDetails: true
  Transform:
    - Group by: service
    - Count: entries per service
```

### Panel 2: Critical Errors

```yaml
Panel Configuration:
  Title: "Critical Application Errors"
  Type: "logs"
  Query: "service:web-app status:ERROR"
  Visualization: "logs"
  Options:
    maxDataPoints: 100
    showTime: true
    sortOrder: "Descending"
  Alert:
    condition: "count > 10 in 5m"
    notification: "critical-alerts"
```

### Panel 3: Performance Issues

```yaml
Panel Configuration:
  Title: "Slow Requests"
  Type: "logs"
  Query: "service:web-app @http.response_time:>2000"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
    enableLogDetails: true
  Transform:
    - Extract: "@http.response_time"
    - Sort by: response time descending
```

### Panel 4: Database Errors

```yaml
Panel Configuration:
  Title: "Database Connection Issues"
  Type: "logs"
  Query: "service:database (\"connection\" OR \"timeout\" OR \"pool\")"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
  Alert:
    condition: "count > 5 in 10m"
    notification: "database-alerts"
```

### Panel 5: Authentication Failures

```yaml
Panel Configuration:
  Title: "Authentication Failures"
  Type: "logs"
  Query: "service:auth (\"failed login\" OR \"authentication failed\")"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@user.id"
    - Count: failures per user
```

### Variables Configuration

```yaml
Variables:
  - name: "service"
    type: "query"
    query: "# Use logs services autocomplete"
    multi: true
    includeAll: true
    
  - name: "environment"
    type: "query" 
    query: "# Use logs field values for @env"
    multi: false
    includeAll: false
    
  - name: "status"
    type: "custom"
    options: ["ERROR", "WARN", "INFO", "DEBUG"]
    multi: true
    includeAll: true
```

## 🏗️ Infrastructure Monitoring Dashboard

### Dashboard Overview

Monitor infrastructure health across containers, hosts, and services.

### Panel 1: System Errors by Host

```yaml
Panel Configuration:
  Title: "System Errors by Host"
  Type: "logs"
  Query: "source:syslog status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "host"
    - Count: errors per host
  Thresholds:
    - value: 10
      color: "yellow"
    - value: 25
      color: "red"
```

### Panel 2: Container Issues

```yaml
Panel Configuration:
  Title: "Container and Kubernetes Issues"
  Type: "logs"
  Query: "(source:docker OR source:kubernetes) AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
    enableLogDetails: true
  Transform:
    - Group by: "@container.name"
    - Extract: "@kubernetes.pod.name"
```

### Panel 3: Network Connectivity

```yaml
Panel Configuration:
  Title: "Network Connection Issues"
  Type: "logs"
  Query: "\"connection\" AND (\"refused\" OR \"timeout\" OR \"reset\")"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Alert:
    condition: "count > 20 in 5m"
    notification: "network-alerts"
```

### Panel 4: Disk and Storage

```yaml
Panel Configuration:
  Title: "Storage Issues"
  Type: "logs"
  Query: "(\"disk space\" OR \"storage\") AND (\"warning\" OR \"critical\" OR \"full\")"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
  Alert:
    condition: "count > 5 in 15m"
    notification: "storage-alerts"
```

### Panel 5: Web Server Errors

```yaml
Panel Configuration:
  Title: "Web Server Errors (Nginx/Apache)"
  Type: "logs"
  Query: "(source:nginx OR source:apache) AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "source"
    - Extract: "@http.status_code"
```

## 🔒 Security Monitoring Dashboard

### Dashboard Focus

Monitor security events, authentication, and potential threats.

### Panel 1: Failed Authentication Attempts

```yaml
Panel Configuration:
  Title: "Failed Login Attempts"
  Type: "logs"
  Query: "(\"failed login\" OR \"authentication failed\") AND @env:production"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
    enableLogDetails: true
  Transform:
    - Group by: "@network.client.ip"
    - Count: attempts per IP
  Alert:
    condition: "count > 50 in 10m"
    notification: "security-alerts"
```

### Panel 2: Suspicious IP Activity

```yaml
Panel Configuration:
  Title: "Suspicious IP Addresses"
  Type: "logs"
  Query: "@network.client.ip:* AND (status:ERROR OR @http.status_code:>=400)"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@network.client.ip"
    - Count: requests per IP
    - Filter: count > 100
```

### Panel 3: Privilege Escalation

```yaml
Panel Configuration:
  Title: "Privilege Escalation Events"
  Type: "logs"
  Query: "(\"sudo\" OR \"privilege\" OR \"escalation\") AND status:WARN"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
  Alert:
    condition: "count > 5 in 30m"
    notification: "security-alerts"
```

### Panel 4: Security Events

```yaml
Panel Configuration:
  Title: "Security Events"
  Type: "logs"
  Query: "@evt.category:security AND (status:ERROR OR status:WARN)"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
    enableLogDetails: true
  Transform:
    - Group by: "@evt.name"
    - Extract: "@user.id"
```

### Panel 5: Unauthorized Access

```yaml
Panel Configuration:
  Title: "Unauthorized Access Attempts"
  Type: "logs"
  Query: "@http.status_code:403 OR \"unauthorized\" OR \"access denied\""
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@http.url_details.path"
    - Count: attempts per endpoint
```

## 💼 Business Monitoring Dashboard

### Dashboard Purpose

Track business-critical events and KPIs through logs.

### Panel 1: Payment Processing

```yaml
Panel Configuration:
  Title: "Payment Processing Issues"
  Type: "logs"
  Query: "service:payment AND (status:ERROR OR \"payment failed\")"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
    enableLogDetails: true
  Transform:
    - Group by: "@payment.gateway"
    - Extract: "@payment.amount"
  Alert:
    condition: "count > 10 in 5m"
    notification: "business-critical"
```

### Panel 2: Order Processing

```yaml
Panel Configuration:
  Title: "Order Processing Failures"
  Type: "logs"
  Query: "service:order AND (@order.status:failed OR status:ERROR)"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
  Transform:
    - Group by: "@order.type"
    - Extract: "@order.amount"
    - Sum: total failed order value
```

### Panel 3: User Registration

```yaml
Panel Configuration:
  Title: "User Registration Issues"
  Type: "logs"
  Query: "service:auth AND (\"registration\" OR \"signup\") AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@registration.source"
    - Count: failures by source
```

### Panel 4: API Usage Monitoring

```yaml
Panel Configuration:
  Title: "API Rate Limiting Events"
  Type: "logs"
  Query: "@http.status_code:429 OR \"rate limit\" OR \"too many requests\""
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@api.key"
    - Count: rate limit hits per key
```

### Panel 5: Feature Flag Issues

```yaml
Panel Configuration:
  Title: "Feature Flag Errors"
  Type: "logs"
  Query: "@feature.flag:* AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    enableLogDetails: true
  Transform:
    - Group by: "@feature.flag"
    - Extract: "@user.segment"
```

## 🚨 Incident Response Dashboard

### Dashboard Design

Comprehensive view for incident investigation and response.

### Panel 1: Recent Critical Events

```yaml
Panel Configuration:
  Title: "Critical Events (Last Hour)"
  Type: "logs"
  Query: "status:ERROR AND @timestamp:>now-1h"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
    maxDataPoints: 200
    sortOrder: "Descending"
  Transform:
    - Group by: "service"
    - Count: errors per service
```

### Panel 2: Error Timeline

```yaml
Panel Configuration:
  Title: "Error Timeline by Service"
  Type: "logs"
  Query: "status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "service", "time"
    - Histogram: errors over time
```

### Panel 3: Affected Services

```yaml
Panel Configuration:
  Title: "Services with Active Issues"
  Type: "logs"
  Query: "(service:web-app OR service:api OR service:database) AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    enableLogDetails: true
  Transform:
    - Group by: "service"
    - Count: total errors
    - Sort: by count descending
```

### Panel 4: Infrastructure Impact

```yaml
Panel Configuration:
  Title: "Infrastructure Components Affected"
  Type: "logs"
  Query: "host:* AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "host"
    - Extract: "source"
    - Count: errors per host
```

### Panel 5: User Impact Analysis

```yaml
Panel Configuration:
  Title: "User Impact (Errors with User Context)"
  Type: "logs"
  Query: "@user.id:* AND status:ERROR"
  Visualization: "logs"
  Options:
    showTime: true
    enableLogDetails: true
  Transform:
    - Group by: "@user.id"
    - Count: affected users
    - Extract: "@session.id"
```

## 🔄 Performance Analysis Dashboard

### Dashboard Focus

Analyze performance issues through logs correlation.

### Panel 1: Slow Requests by Endpoint

```yaml
Panel Configuration:
  Title: "Slow API Endpoints"
  Type: "logs"
  Query: "service:api @http.response_time:>2000"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@http.url_details.path"
    - Average: "@http.response_time"
    - Sort: by average response time
```

### Panel 2: Database Performance

```yaml
Panel Configuration:
  Title: "Slow Database Queries"
  Type: "logs"
  Query: "service:database @query.duration:>1000"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
  Transform:
    - Extract: "@query.sql"
    - Group by: query pattern
    - Average: "@query.duration"
```

### Panel 3: Cache Performance

```yaml
Panel Configuration:
  Title: "Cache Miss Events"
  Type: "logs"
  Query: "\"cache miss\" OR (@cache.hit_ratio:<0.8 AND service:web-app)"
  Visualization: "logs"
  Options:
    showTime: true
    showLabels: true
  Transform:
    - Group by: "@cache.key_pattern"
    - Count: misses per pattern
```

### Panel 4: Queue Processing

```yaml
Panel Configuration:
  Title: "Queue Processing Delays"
  Type: "logs"
  Query: "\"queue\" AND (\"delay\" OR \"timeout\" OR \"backlog\")"
  Visualization: "logs"
  Options:
    showTime: true
    enableLogDetails: true
  Transform:
    - Group by: "@queue.name"
    - Extract: "@queue.processing_time"
```

### Panel 5: Resource Exhaustion

```yaml
Panel Configuration:
  Title: "Resource Exhaustion Events"
  Type: "logs"
  Query: "(\"memory\" OR \"cpu\" OR \"disk\") AND (\"exceeded\" OR \"limit\" OR \"high\")"
  Visualization: "logs"
  Options:
    showTime: true
    wrapLogMessage: true
  Alert:
    condition: "count > 15 in 10m"
    notification: "performance-alerts"
```

## 🎨 Dashboard Best Practices

### Layout Guidelines

1. **Critical information first**: Errors and alerts at the top
2. **Logical grouping**: Related panels together
3. **Consistent time ranges**: Use global time picker
4. **Appropriate sizing**: Important panels larger

### Color Scheme

```yaml
Color Configuration:
  Error: "#FF0000"      # Red
  Warning: "#FFA500"    # Orange  
  Info: "#0000FF"       # Blue
  Success: "#00FF00"    # Green
  Debug: "#808080"      # Gray
```

### Refresh Strategy

```yaml
Refresh Settings:
  Critical dashboards: "30s"
  Monitoring dashboards: "1m"
  Analysis dashboards: "5m"
  Historical dashboards: "manual"
```

### Alert Integration

```yaml
Alert Configuration:
  Critical: 
    - Immediate notification
    - Multiple channels
    - Escalation policy
    
  Warning:
    - 5-minute delay
    - Primary channel only
    - No escalation
    
  Info:
    - 15-minute aggregation
    - Email only
    - Business hours only
```

## 🔧 Variable Configurations

### Service Variable

```yaml
Variable: service
  Type: Query
  Query: "# Use logs services autocomplete endpoint"
  Multi-value: true
  Include All: true
  Current: "web-app"
  
Usage in Panels:
  Query: "service:$service status:ERROR"
```

### Environment Variable

```yaml
Variable: environment
  Type: Query
  Query: "# Use logs field values for @env"
  Multi-value: false
  Include All: false
  Current: "production"
  
Usage in Panels:
  Query: "service:$service @env:$environment status:ERROR"
```

### Time Range Variable

```yaml
Variable: time_range
  Type: Custom
  Options: ["1h", "6h", "24h", "7d"]
  Multi-value: false
  Current: "1h"
  
Usage in Panels:
  Query: "service:$service status:ERROR @timestamp:>now-$time_range"
```

### Status Level Variable

```yaml
Variable: log_level
  Type: Custom
  Options: ["ERROR", "WARN", "INFO", "DEBUG"]
  Multi-value: true
  Include All: true
  Current: ["ERROR", "WARN"]
  
Usage in Panels:
  Query: "service:$service status:$log_level"
```

## 📊 Panel Configuration Templates

### Standard Logs Panel

```yaml
Panel Template:
  Type: "logs"
  Options:
    showTime: true
    showLabels: true
    wrapLogMessage: true
    enableLogDetails: true
    maxDataPoints: 100
    sortOrder: "Descending"
  Overrides:
    - matcher: "status:ERROR"
      properties:
        color: "red"
    - matcher: "status:WARN"
      properties:
        color: "orange"
```

### Alert-Enabled Panel

```yaml
Panel Template:
  Type: "logs"
  Alert:
    frequency: "10s"
    conditions:
      - query: "A"
        reducer: "count"
        evaluator:
          type: "gt"
          params: [10]
    notifications:
      - uid: "alert-channel-uid"
```

### Performance Panel

```yaml
Panel Template:
  Type: "logs"
  Transform:
    - id: "groupBy"
      options:
        fields: ["service", "@http.response_time"]
    - id: "reduce"
      options:
        reducers: ["mean", "max", "count"]
```

## 🔗 Dashboard Links and Navigation

### Cross-Dashboard Navigation

```yaml
Dashboard Links:
  - title: "Application Health"
    url: "/d/app-health"
    tooltip: "Overall application monitoring"
    
  - title: "Infrastructure"
    url: "/d/infrastructure"
    tooltip: "System and container monitoring"
    
  - title: "Security"
    url: "/d/security"
    tooltip: "Security events and threats"
    
  - title: "Business KPIs"
    url: "/d/business"
    tooltip: "Business metrics and events"
```

### Panel Links

```yaml
Panel Links:
  - title: "View in Explore"
    url: "/explore?query=${__url_time_range}&datasource=${__datasource}"
    
  - title: "Related Metrics"
    url: "/d/metrics-dashboard?service=${service}"
    
  - title: "Runbook"
    url: "https://wiki.company.com/runbooks/${service}"
    targetBlank: true
```

## 📚 Export and Import

### Dashboard JSON Export

```bash
# Export dashboard configuration
curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
  "http://grafana:3000/api/dashboards/uid/dashboard-uid" > dashboard.json
```

### Dashboard Import

```bash
# Import dashboard configuration
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d @dashboard.json \
  "http://grafana:3000/api/dashboards/db"
```

### Provisioning Configuration

```yaml
# dashboards.yml
apiVersion: 1

providers:
  - name: 'logs-dashboards'
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards/logs
```

## 🔧 Troubleshooting Dashboards

### Common Issues

1. **No data showing**:
   - Check time range
   - Verify datasource configuration
   - Confirm logs exist for time period

2. **Slow loading**:
   - Reduce time range
   - Add more specific filters
   - Optimize queries

3. **Missing variables**:
   - Check variable queries
   - Verify datasource permissions
   - Test variable queries in Explore

4. **Alert not firing**:
   - Check alert conditions
   - Verify notification channels
   - Test queries manually

## 📚 Related Documentation

- [Logs Getting Started](../logs/getting-started.md) - Basic logs usage
- [Logs Query Examples](logs-queries.md) - Query patterns
- [Logs Correlation](../logs/correlation.md) - Correlating with metrics
- [Performance Optimization](../advanced/performance.md) - Dashboard optimization