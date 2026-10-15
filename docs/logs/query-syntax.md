# Logs Query Syntax

This guide covers the complete Datadog logs search syntax supported by the plugin, with examples and best practices.

## 🔍 Basic Search Syntax

### Text Search

```bash
# Simple text search
error

# Phrase search (exact match)
"connection timeout"

# Multiple words (AND by default)
error database connection

# Case insensitive by default
ERROR error Error  # All equivalent
```

### Wildcards

```bash
# Wildcard at end
error*

# Wildcard in middle
data*base

# Multiple wildcards
*connection*timeout*

# Note: Wildcards at the beginning (*error) may be slower
```

## 🏷️ Facet Filtering

### Standard Facets

```bash
# Service name
service:web-app
service:api-gateway
service:database

# Log status/level
status:ERROR
status:WARN
status:INFO
status:DEBUG

# Source (where logs come from)
source:nginx
source:apache
source:application
source:docker
source:kubernetes

# Host/server
host:web-01
host:prod-server-*

# Environment (custom attribute)
@env:production
@env:staging
@env:development
```

### Custom Attributes

Use `@` prefix for custom attributes:

```bash
# User information
@user.id:12345
@user.email:john@example.com
@user.role:admin

# HTTP request details
@http.method:POST
@http.status_code:500
@http.url_details.path:/api/users
@http.response_time:>1000

# Application metadata
@version:1.2.3
@build.number:456
@deployment.id:abc123

# Custom business logic
@transaction.id:tx_789
@order.amount:>100
@feature.flag:enabled
```

### Numeric Comparisons

```bash
# Greater than
@http.response_time:>1000
@order.amount:>100.50

# Less than
@http.response_time:<500
@user.age:<18

# Range
@http.response_time:[100 TO 1000]
@timestamp:[2023-01-01 TO 2023-12-31]

# Exact match
@http.status_code:404
@user.id:12345
```

## 🔗 Boolean Operators

### AND Operator

```bash
# Explicit AND
service:web-app AND status:ERROR

# Implicit AND (space)
service:web-app status:ERROR

# Multiple conditions
service:web-app AND status:ERROR AND @env:production
```

### OR Operator

```bash
# Simple OR
status:ERROR OR status:WARN

# Multiple services
service:web-app OR service:api-gateway

# Complex OR with grouping
(service:web-app OR service:api) AND status:ERROR
```

### NOT Operator

```bash
# Exclude condition
service:web-app AND NOT status:DEBUG

# Exclude multiple
service:web-app AND NOT (status:DEBUG OR status:TRACE)

# Exclude pattern
service:web-app AND NOT host:test-*
```

### Grouping with Parentheses

```bash
# Group OR conditions
(service:web-app OR service:api) AND status:ERROR

# Complex grouping
(service:web-app AND @env:prod) OR (service:api AND @env:staging)

# Nested grouping
((service:web-app OR service:api) AND status:ERROR) AND NOT @env:test
```

## 📊 Advanced Filtering

### Existence Checks

```bash
# Check if field exists
_exists_:@user.id

# Check if field doesn't exist
NOT _exists_:@user.id

# Combine with other conditions
service:web-app AND _exists_:@transaction.id
```

### Array and Object Filtering

```bash
# Array contains value
@tags:production

# Object field access
@http.request.headers.user-agent:*Chrome*

# Nested object fields
@kubernetes.pod.name:web-*
@docker.container.name:app-*
```

### Regular Expressions

```bash
# Basic regex (limited support)
@user.email:/.*@company\.com/

# IP address patterns
@network.client.ip:/192\.168\..*/

# Note: Full regex support may be limited, use wildcards when possible
```

## 🕒 Time-based Filtering

### Relative Time

```bash
# Last hour
@timestamp:>now-1h

# Last 24 hours
@timestamp:>now-1d

# Last week
@timestamp:>now-7d

# Between relative times
@timestamp:[now-2h TO now-1h]
```

### Absolute Time

```bash
# Specific date
@timestamp:>2023-12-01

# Specific datetime
@timestamp:>2023-12-01T10:00:00

# Time range
@timestamp:[2023-12-01T09:00:00 TO 2023-12-01T17:00:00]
```

**Note**: It's recommended to use Grafana's time picker instead of inline time filters for better performance and consistency.

## 🎯 Query Examples by Use Case

### Application Monitoring

```bash
# Application errors with context
service:web-app status:ERROR @env:production

# Slow API requests
service:api @http.response_time:>2000 @http.method:POST

# Failed authentication
"authentication failed" OR "login failed" OR @http.status_code:401

# Database connection issues
service:database ("connection" OR "timeout" OR "pool")

# Memory issues
"OutOfMemoryError" OR "memory" AND ("exceeded" OR "limit")

# Deployment issues
@version:1.2.3 AND status:ERROR AND @timestamp:>now-1h
```

### Infrastructure Monitoring

```bash
# Web server errors
source:nginx @http.status_code:>=500

# Container restarts
source:kubernetes "container" AND ("restart" OR "killed")

# Disk space issues
"disk space" OR "storage" AND ("warning" OR "critical" OR "full")

# Network connectivity
"connection" AND ("refused" OR "timeout" OR "reset")

# SSL/TLS issues
("ssl" OR "tls") AND ("certificate" OR "handshake" OR "expired")

# Load balancer health
source:nginx ("upstream" OR "backend") AND ("down" OR "unavailable")
```

### Security Monitoring

```bash
# Failed login attempts
("failed login" OR "authentication failed") AND @env:production

# Suspicious IP addresses
@network.client.ip:192.168.1.100 OR @network.client.ip:/10\.0\..*/

# Privilege escalation
("sudo" OR "privilege" OR "escalation") AND status:WARN

# Unauthorized access
@http.status_code:403 OR "unauthorized" OR "access denied"

# Security events
@evt.category:security AND (status:ERROR OR status:WARN)

# Brute force attacks
"brute force" OR (@http.status_code:401 AND @user.id:*)
```

### Performance Monitoring

```bash
# Slow database queries
service:database @duration:>5000

# High CPU usage
"cpu" AND ("high" OR "exceeded" OR @cpu.usage:>80)

# Memory leaks
"memory leak" OR (@memory.usage:>90 AND service:web-app)

# Queue processing delays
"queue" AND ("delay" OR "timeout" OR "backlog" OR @queue.size:>1000)

# Cache misses
"cache miss" OR (@cache.hit_ratio:<0.8 AND service:web-app)

# Response time degradation
@http.response_time:>1000 AND @env:production AND @timestamp:>now-1h
```

### Business Logic Monitoring

```bash
# Payment failures
service:payment AND (status:ERROR OR "payment failed")

# Order processing issues
@order.status:failed OR (@order.amount:>1000 AND status:ERROR)

# User registration problems
service:auth AND ("registration" OR "signup") AND status:ERROR

# Feature flag issues
@feature.flag:* AND status:ERROR

# A/B test monitoring
@experiment.variant:* AND @conversion.rate:<0.05
```

## 🔧 Query Optimization Tips

### Performance Best Practices

1. **Use Specific Filters First**
   ```bash
   # Good: Specific service first
   service:web-app status:ERROR
   
   # Avoid: Broad search first
   error service:web-app
   ```

2. **Limit Wildcard Usage**
   ```bash
   # Good: Specific wildcards
   service:web-*
   
   # Avoid: Leading wildcards
   service:*-app
   ```

3. **Use Status Filters**
   ```bash
   # Good: Filter by status
   service:web-app status:ERROR
   
   # Avoid: Search all levels
   service:web-app error
   ```

4. **Combine Related Filters**
   ```bash
   # Good: Combined filters
   service:web-app @env:production status:ERROR
   
   # Less efficient: Separate queries
   service:web-app
   @env:production
   status:ERROR
   ```

### Query Structure

1. **Order Filters by Selectivity**
   ```bash
   # Most selective first
   service:specific-service @env:production status:ERROR
   ```

2. **Use Parentheses for Clarity**
   ```bash
   # Clear grouping
   (service:web-app OR service:api) AND status:ERROR
   ```

3. **Avoid Redundant Conditions**
   ```bash
   # Good
   service:web-app status:ERROR
   
   # Redundant
   service:web-app AND service:web-app status:ERROR
   ```

## 🚨 Common Query Patterns

### Error Investigation

```bash
# Start broad, then narrow down
service:web-app status:ERROR
service:web-app status:ERROR @env:production
service:web-app status:ERROR @env:production @timestamp:>now-1h
service:web-app status:ERROR @env:production @timestamp:>now-1h @user.id:12345
```

### Performance Analysis

```bash
# Identify slow requests
@http.response_time:>2000

# Find bottlenecks
@http.response_time:>2000 AND service:api

# Analyze by endpoint
@http.response_time:>2000 AND @http.url_details.path:/api/users

# Check specific time period
@http.response_time:>2000 AND @timestamp:[now-2h TO now-1h]
```

### Security Audit

```bash
# Authentication events
@evt.category:authentication

# Failed attempts
@evt.category:authentication AND status:ERROR

# Successful logins from new IPs
@evt.category:authentication AND status:INFO AND @network.client.ip:*

# Privilege changes
@evt.category:authorization AND ("privilege" OR "role" OR "permission")
```

## 📝 Query Validation

### Syntax Checking

The plugin provides real-time validation:

- ✅ **Valid**: `service:web-app status:ERROR`
- ❌ **Invalid**: `service:web-app AND AND status:ERROR`
- ❌ **Invalid**: `service:web-app status:ERROR"`
- ❌ **Invalid**: `service:(web-app OR api`

### Common Syntax Errors

1. **Unmatched Quotes**
   ```bash
   # Wrong
   "error message
   
   # Correct
   "error message"
   ```

2. **Unmatched Parentheses**
   ```bash
   # Wrong
   (service:web-app OR service:api
   
   # Correct
   (service:web-app OR service:api)
   ```

3. **Invalid Operators**
   ```bash
   # Wrong
   service:web-app && status:ERROR
   
   # Correct
   service:web-app AND status:ERROR
   ```

4. **Malformed Facets**
   ```bash
   # Wrong
   service web-app
   
   # Correct
   service:web-app
   ```

## 🔗 Integration with Grafana

### Variables in Queries

```bash
# Use dashboard variables
service:$service status:$status

# Multiple selection variables
service:$service AND @env:$environment

# Text variables with wildcards
@user.email:*$domain
```

### Time Range Integration

```bash
# Let Grafana handle time range (recommended)
service:web-app status:ERROR

# Manual time filtering (use sparingly)
service:web-app status:ERROR @timestamp:>now-1h
```

### Panel Configuration

- Use **Logs** visualization type
- Set appropriate **Max Data Points**
- Configure **Deduplication** if needed
- Enable **Show Time** for timestamps

## 📚 Additional Resources

- [Datadog Logs Search Syntax](https://docs.datadoghq.com/logs/search_syntax/)
- [Datadog Log Facets](https://docs.datadoghq.com/logs/explorer/facets/)
- [Grafana Logs Panel](https://grafana.com/docs/grafana/latest/panels/visualizations/logs/)
- [Plugin Examples](../examples/logs-queries.md)