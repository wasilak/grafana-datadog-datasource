# Logs Query Examples

A comprehensive collection of real-world Datadog logs query examples for common monitoring and troubleshooting scenarios.

## 🚀 Quick Start Examples

### Basic Text Search

```bash
# Simple error search
error

# Exact phrase search
"connection timeout"

# Multiple terms (AND by default)
error database connection

# Case insensitive
ERROR error Error  # All equivalent
```

### Service Filtering

```bash
# Specific service
service:web-app

# Multiple services
service:web-app OR service:api-gateway

# Service pattern matching
service:web-*

# Exclude services
NOT service:test-*
```

### Status Level Filtering

```bash
# Error logs only
status:ERROR

# Warnings and errors
status:ERROR OR status:WARN

# All except debug
NOT status:DEBUG

# Critical levels
status:ERROR OR status:FATAL
```

## 🔍 Application Monitoring

### Error Tracking

```bash
# Application errors by service
service:web-app status:ERROR

# Database connection errors
service:database ("connection" OR "timeout" OR "pool")

# Authentication failures
"authentication failed" OR "login failed" OR @http.status_code:401

# Payment processing errors
service:payment AND (status:ERROR OR "payment failed")

# API rate limiting
@http.status_code:429 OR "rate limit" OR "too many requests"

# Memory issues
"OutOfMemoryError" OR "memory" AND ("exceeded" OR "limit" OR "leak")
```

### Performance Issues

```bash
# Slow API requests
service:api @http.response_time:>2000

# Database slow queries
service:database @duration:>5000

# High CPU usage alerts
"cpu" AND ("high" OR "exceeded" OR @cpu.usage:>80)

# Cache performance issues
"cache miss" OR (@cache.hit_ratio:<0.8 AND service:web-app)

# Queue processing delays
"queue" AND ("delay" OR "timeout" OR "backlog")

# Response time degradation
@http.response_time:>1000 AND @env:production AND @timestamp:>now-1h
```

### Deployment Monitoring

```bash
# Deployment events
@deployment.version:1.2.3

# Post-deployment errors
@version:1.2.3 AND status:ERROR AND @timestamp:>now-1h

# Rollback indicators
"rollback" OR "revert" OR @deployment.status:failed

# Health check failures after deployment
"health check" AND ("failed" OR "timeout") AND @version:1.2.3

# Configuration errors
"configuration" AND ("invalid" OR "missing" OR "error")
```

## 🏗️ Infrastructure Monitoring

### Web Server Logs

```bash
# Nginx error logs
source:nginx status:ERROR

# Apache access logs with errors
source:apache @http.status_code:>=400

# High response times
source:nginx @http.response_time:>1000

# SSL/TLS issues
source:nginx ("ssl" OR "tls") AND ("certificate" OR "handshake")

# Upstream server issues
source:nginx ("upstream" OR "backend") AND ("down" OR "unavailable")

# Rate limiting
source:nginx "limiting requests"
```

### Container and Orchestration

```bash
# Docker container issues
source:docker ("container" OR "image") AND status:ERROR

# Kubernetes pod failures
source:kubernetes "pod" AND ("failed" OR "error" OR "crashloopbackoff")

# Container restarts
source:kubernetes "container" AND ("restart" OR "killed")

# Resource limits
source:kubernetes ("memory" OR "cpu") AND ("limit" OR "exceeded")

# Image pull failures
source:kubernetes "image" AND ("pull" OR "failed")

# Service mesh issues
source:istio OR source:envoy AND status:ERROR
```

### Database Monitoring

```bash
# PostgreSQL connection issues
service:postgresql ("connection" OR "pool" OR "timeout")

# MySQL slow queries
service:mysql @query.duration:>1000

# Redis connection problems
service:redis ("connection" OR "timeout" OR "refused")

# Database deadlocks
service:database "deadlock"

# Replication lag
service:database "replication" AND ("lag" OR "delay")

# Backup failures
service:database "backup" AND ("failed" OR "error")
```

### System and OS Logs

```bash
# System errors
source:syslog status:ERROR

# Disk space issues
"disk space" OR "storage" AND ("warning" OR "critical" OR "full")

# Network connectivity
"connection" AND ("refused" OR "timeout" OR "reset")

# Authentication events
source:auth OR @evt.category:authentication

# Kernel messages
source:kernel AND status:ERROR

# Service startup failures
"systemd" AND ("failed" OR "error") AND "service"
```

## 🔒 Security Monitoring

### Authentication and Authorization

```bash
# Failed login attempts
("failed login" OR "authentication failed") AND @env:production

# Brute force attacks
"brute force" OR (@http.status_code:401 AND @user.id:*)

# Privilege escalation
("sudo" OR "privilege" OR "escalation") AND status:WARN

# Unauthorized access attempts
@http.status_code:403 OR "unauthorized" OR "access denied"

# Account lockouts
"account locked" OR "user locked" OR "lockout"

# Password policy violations
"password" AND ("policy" OR "complexity" OR "expired")
```

### Network Security

```bash
# Suspicious IP addresses
@network.client.ip:192.168.1.100 OR @network.client.ip:/10\.0\..*/

# DDoS indicators
"ddos" OR (@http.status_code:429 AND @request.rate:>1000)

# Firewall blocks
source:firewall AND ("blocked" OR "denied")

# Intrusion detection
source:ids OR @evt.category:intrusion_detection

# VPN connection issues
"vpn" AND ("connection" OR "authentication") AND status:ERROR

# Certificate issues
("certificate" OR "cert") AND ("expired" OR "invalid" OR "revoked")
```

### Compliance and Audit

```bash
# Security events
@evt.category:security AND (status:ERROR OR status:WARN)

# Data access events
@evt.category:data_access AND @user.role:admin

# Configuration changes
@evt.category:configuration AND ("changed" OR "modified")

# Privileged operations
@user.role:admin AND @evt.category:authorization

# Compliance violations
"compliance" AND ("violation" OR "failed" OR "error")

# Audit trail events
@evt.category:audit AND @timestamp:>now-24h
```

## 📊 Business Logic Monitoring

### E-commerce Applications

```bash
# Order processing failures
service:order AND (status:ERROR OR @order.status:failed)

# Payment gateway issues
service:payment AND ("gateway" OR "processor") AND status:ERROR

# Inventory management
service:inventory AND ("out of stock" OR "low inventory")

# Shopping cart abandonment indicators
service:cart AND "timeout" AND @user.session:*

# Pricing calculation errors
service:pricing AND ("calculation" OR "discount") AND status:ERROR

# Shipping integration issues
service:shipping AND ("carrier" OR "tracking") AND status:ERROR
```

### Financial Services

```bash
# Transaction processing errors
service:transaction AND (status:ERROR OR @transaction.status:failed)

# Fraud detection alerts
service:fraud AND ("suspicious" OR "flagged" OR @risk.score:>80)

# Regulatory compliance issues
"compliance" AND ("sox" OR "pci" OR "gdpr") AND status:ERROR

# Account balance discrepancies
service:account AND ("balance" OR "reconciliation") AND status:ERROR

# Trading system issues
service:trading AND ("order" OR "execution") AND status:ERROR

# Risk management alerts
service:risk AND ("limit" OR "threshold" OR "exceeded")
```

### SaaS Applications

```bash
# User onboarding issues
service:onboarding AND status:ERROR

# Subscription management
service:billing AND ("subscription" OR "payment") AND status:ERROR

# Feature flag issues
@feature.flag:* AND status:ERROR

# Multi-tenant isolation problems
@tenant.id:* AND ("isolation" OR "cross-tenant") AND status:ERROR

# API usage tracking
service:api AND @api.key:* AND @usage.limit:exceeded

# License validation failures
service:license AND ("validation" OR "expired") AND status:ERROR
```

## 🔧 Development and Testing

### Development Environment

```bash
# Development errors
@env:development status:ERROR

# Test failures
@env:test AND ("test" OR "spec") AND ("failed" OR "error")

# Build pipeline issues
service:ci AND ("build" OR "compile") AND status:ERROR

# Code quality issues
service:sonar AND ("quality" OR "coverage") AND status:WARN

# Dependency issues
"dependency" AND ("missing" OR "conflict" OR "version")

# Local development setup
@env:local AND ("setup" OR "configuration") AND status:ERROR
```

### Staging Environment

```bash
# Staging deployment issues
@env:staging AND @deployment.status:failed

# Integration test failures
@env:staging AND "integration" AND ("test" OR "failed")

# Performance test results
@env:staging AND "performance" AND (@response_time:>1000 OR status:ERROR)

# Data migration issues
@env:staging AND "migration" AND ("failed" OR "error")

# Third-party integration testing
@env:staging AND "integration" AND ("api" OR "webhook") AND status:ERROR
```

### Production Readiness

```bash
# Production deployment validation
@env:production AND @deployment.version:* AND @timestamp:>now-30m

# Health check monitoring
"health check" AND @env:production AND ("failed" OR "timeout")

# Circuit breaker activations
"circuit breaker" AND ("open" OR "tripped") AND @env:production

# Feature toggle validation
@feature.flag:* AND @env:production AND status:ERROR

# Canary deployment monitoring
@deployment.strategy:canary AND status:ERROR
```

## 📈 Performance Analysis

### Response Time Analysis

```bash
# Slow endpoints by service
service:api @http.response_time:>2000 AND @http.url_details.path:*

# Database query performance
service:database @query.duration:>1000

# Cache performance analysis
service:cache AND (@hit_ratio:<0.8 OR @response_time:>100)

# CDN performance issues
service:cdn @response_time:>500

# Third-party API performance
@external.api:* @response_time:>3000

# Background job performance
service:worker @job.duration:>300000
```

### Resource Utilization

```bash
# High memory usage
@memory.usage:>90 AND service:*

# CPU spike analysis
@cpu.usage:>80 AND @timestamp:>now-1h

# Disk I/O bottlenecks
@disk.io.wait:>50 AND service:database

# Network bandwidth issues
@network.bytes_sent:>1000000000 OR @network.bytes_received:>1000000000

# Connection pool exhaustion
@connection.pool.active:>90 AND service:database

# Thread pool saturation
@thread.pool.active:>95 AND service:web-app
```

### Scalability Monitoring

```bash
# Auto-scaling events
"autoscaling" AND ("scale up" OR "scale down")

# Load balancer health
source:loadbalancer AND ("health check" OR "backend")

# Queue depth monitoring
@queue.depth:>1000 AND service:*

# Rate limiting activation
@rate.limit:exceeded AND service:api

# Circuit breaker patterns
"circuit breaker" AND ("open" OR "half-open" OR "closed")

# Capacity planning indicators
@utilization:>80 AND (@cpu OR @memory OR @disk)
```

## 🎯 Troubleshooting Workflows

### Incident Response

```bash
# Step 1: Identify affected services
status:ERROR AND @timestamp:>now-1h

# Step 2: Focus on critical services
(service:web-app OR service:api OR service:database) AND status:ERROR

# Step 3: Look for error patterns
service:web-app status:ERROR AND ("timeout" OR "connection" OR "memory")

# Step 4: Check dependencies
service:database status:ERROR AND @timestamp:>now-1h

# Step 5: Correlate with deployments
@deployment.version:* AND status:ERROR AND @timestamp:>now-2h
```

### Root Cause Analysis

```bash
# Timeline reconstruction
service:web-app AND @timestamp:[2023-12-01T14:00:00 TO 2023-12-01T15:00:00]

# Error correlation across services
(service:web-app OR service:api OR service:database) AND status:ERROR AND @trace_id:*

# Infrastructure correlation
host:web-* AND status:ERROR AND @timestamp:>now-1h

# User impact analysis
@user.id:* AND status:ERROR AND service:web-app

# External dependency analysis
@external.service:* AND (status:ERROR OR @response_time:>5000)
```

### Performance Investigation

```bash
# Identify performance regression
service:web-app @http.response_time:>2000 AND @timestamp:>now-1h

# Compare with baseline
service:web-app @http.response_time:>2000 AND @timestamp:[now-2d TO now-1d]

# Analyze by endpoint
service:web-app @http.response_time:>2000 AND @http.url_details.path:/api/users

# Check resource correlation
service:web-app AND (@cpu.usage:>80 OR @memory.usage:>90)

# Database performance impact
service:database @query.duration:>1000 AND @timestamp:>now-1h
```

## 🔄 Advanced Query Patterns

### Complex Boolean Logic

```bash
# Nested conditions
((service:web-app OR service:api) AND status:ERROR) AND NOT @env:test

# Multiple exclusions
service:web-app AND NOT (status:DEBUG OR status:TRACE OR @env:development)

# Conditional filtering
(service:web-app AND @env:production) OR (service:api AND @env:staging)

# Pattern combinations
(service:web-* AND status:ERROR) OR (@http.status_code:>=500 AND source:nginx)
```

### Time-based Patterns

```bash
# Business hours only
service:web-app status:ERROR AND @timestamp:>now-8h AND @timestamp:<now

# Weekend analysis
service:web-app status:ERROR AND @timestamp:[now-2d TO now] AND @day_of_week:(Saturday OR Sunday)

# Peak hours analysis
service:web-app @http.response_time:>1000 AND @hour:[9 TO 17]

# Off-hours incidents
status:ERROR AND @hour:[0 TO 6] AND @env:production
```

### Aggregation Patterns

```bash
# Error rate calculation (conceptual)
# Count errors: service:web-app status:ERROR
# Count total: service:web-app
# Rate = errors / total

# Top error sources
service:* status:ERROR  # Group by service in visualization

# Error distribution by environment
status:ERROR  # Group by @env in visualization

# Hourly error patterns
status:ERROR AND @timestamp:>now-24h  # Group by hour in visualization
```

## 📊 Dashboard Query Sets

### Application Health Dashboard

```yaml
Error Rate Panel:
  Query: service:web-app status:ERROR
  Visualization: Logs
  
Warning Rate Panel:
  Query: service:web-app status:WARN
  Visualization: Logs
  
Performance Issues Panel:
  Query: service:web-app @http.response_time:>2000
  Visualization: Logs
  
Database Errors Panel:
  Query: service:database status:ERROR
  Visualization: Logs
```

### Infrastructure Overview Dashboard

```yaml
System Errors Panel:
  Query: source:syslog status:ERROR
  Visualization: Logs
  
Container Issues Panel:
  Query: source:docker OR source:kubernetes AND status:ERROR
  Visualization: Logs
  
Network Problems Panel:
  Query: "connection" AND ("refused" OR "timeout") AND status:ERROR
  Visualization: Logs
  
Security Events Panel:
  Query: @evt.category:security AND status:WARN
  Visualization: Logs
```

### Business Monitoring Dashboard

```yaml
Payment Failures Panel:
  Query: service:payment status:ERROR
  Visualization: Logs
  
Order Processing Issues Panel:
  Query: service:order AND (@order.status:failed OR status:ERROR)
  Visualization: Logs
  
User Authentication Panel:
  Query: service:auth AND ("login" OR "authentication") AND status:ERROR
  Visualization: Logs
  
API Rate Limiting Panel:
  Query: @http.status_code:429 OR "rate limit"
  Visualization: Logs
```

## 🎨 Query Optimization Tips

### Performance Best Practices

```bash
# Good: Specific service first
service:web-app status:ERROR

# Avoid: Broad search first
error service:web-app

# Good: Use status filters
service:web-app status:ERROR

# Avoid: Text search for levels
service:web-app error

# Good: Specific time ranges
service:web-app status:ERROR @timestamp:>now-1h

# Avoid: Very broad time ranges without filters
status:ERROR @timestamp:>now-7d
```

### Query Structure

```bash
# Order by selectivity (most selective first)
service:specific-service @env:production status:ERROR

# Use parentheses for clarity
(service:web-app OR service:api) AND status:ERROR

# Combine related filters
service:web-app @env:production status:ERROR @timestamp:>now-1h
```

## 🔧 JSON Parsing Examples

### Application Logs with JSON Parsing

Enable JSON parsing for structured application logs:

```bash
# Configuration: Enable JSON parsing, target field: "message"

# Original log message (JSON string):
# message: "{\"user_id\":123,\"action\":\"login\",\"result\":\"success\",\"ip\":\"192.168.1.100\"}"

# After JSON parsing - filter by parsed fields:
service:web-app parsed_user_id:123
service:web-app parsed_action:login parsed_result:failed
service:web-app parsed_ip:192.168.1.100

# Complex filtering with parsed and original fields:
service:web-app status:ERROR parsed_error.code:DATABASE_CONNECTION
service:web-app parsed_user.role:admin parsed_action:delete
```

### API Gateway Logs with JSON Parsing

Parse HTTP request/response data:

```bash
# Configuration: Enable JSON parsing, target field: "data"

# Filter by parsed HTTP data:
service:gateway parsed_request.method:POST
service:gateway parsed_response.status:>=500
service:gateway parsed_response.duration_ms:>2000

# Performance analysis with parsed fields:
service:gateway parsed_request.path:/api/users parsed_response.duration_ms:>1000
service:gateway parsed_client.ip:10.0.1.* parsed_response.status:403

# Error investigation:
service:gateway parsed_response.status:500 parsed_error.type:timeout
```

### Database Query Logs with JSON Parsing

Analyze database performance:

```bash
# Configuration: Enable JSON parsing, target field: "attributes"

# Query performance analysis:
service:database parsed_execution_time_ms:>5000
service:database parsed_table:users parsed_operation:SELECT
service:database parsed_rows_affected:>10000

# Connection and resource monitoring:
service:database parsed_connection.pool_id:pool_1 parsed_connection.wait_time_ms:>100
service:database parsed_performance.cpu_time_ms:>1000
service:database parsed_performance.cache_hits:<10
```

### Microservices with JSON Parsing

Trace requests across services:

```bash
# Configuration: Enable JSON parsing, target field: "message"

# Distributed tracing with parsed fields:
parsed_trace_id:abc123  # Find all logs for a trace
parsed_span_id:def456 parsed_service:user-service
parsed_parent_span_id:* parsed_operation:database_query

# Service dependency analysis:
parsed_downstream.service:payment-service parsed_downstream.status:error
parsed_upstream.service:api-gateway parsed_response.latency_ms:>500

# Business transaction tracking:
parsed_transaction.id:tx_789 parsed_transaction.status:failed
parsed_order.id:order_456 parsed_payment.status:declined
```

### Security Logs with JSON Parsing

Monitor security events:

```bash
# Configuration: Enable JSON parsing, target field: "data"

# Authentication analysis:
service:auth parsed_event.type:login_attempt parsed_result:failed
service:auth parsed_user.id:* parsed_auth.method:password parsed_attempts:>3

# Access control monitoring:
service:auth parsed_event.type:authorization parsed_resource.type:admin_panel
service:auth parsed_user.role:user parsed_requested.permission:admin

# Threat detection:
service:security parsed_event.category:suspicious_activity
service:security parsed_threat.level:high parsed_action.taken:blocked
```

### Error Tracking with JSON Parsing

Structured error analysis:

```bash
# Configuration: Enable JSON parsing, target field: "message"

# Error categorization:
status:ERROR parsed_error.category:validation
status:ERROR parsed_error.category:network parsed_error.retry_count:>3
status:ERROR parsed_error.category:business_logic parsed_error.severity:critical

# Stack trace analysis:
status:ERROR parsed_error.stack_trace:*NullPointerException*
status:ERROR parsed_error.file:*UserService.java* parsed_error.line_number:>100

# Error correlation:
status:ERROR parsed_correlation_id:* parsed_error.upstream_service:database
status:ERROR parsed_session_id:* parsed_user.id:12345
```

### Performance Monitoring with JSON Parsing

Application performance insights:

```bash
# Configuration: Enable JSON parsing, target field: "attributes"

# Response time analysis:
service:web-app parsed_metrics.response_time_ms:>2000
service:web-app parsed_metrics.db_query_time_ms:>500
service:web-app parsed_metrics.external_api_time_ms:>1000

# Resource utilization:
service:web-app parsed_metrics.memory_usage_mb:>512
service:web-app parsed_metrics.cpu_usage_percent:>80
service:web-app parsed_metrics.active_connections:>100

# Business metrics:
service:web-app parsed_business.conversion_rate:<0.05
service:web-app parsed_business.cart_abandonment_rate:>0.7
```

### JSON Parsing Best Practices

```bash
# Start with specific services and fields:
service:web-app parsed_user_id:123  # Good: specific service + parsed field

# Combine original and parsed field filtering:
service:web-app status:ERROR parsed_error.code:TIMEOUT  # Efficient combination

# Use parsed fields for precise filtering:
parsed_response.status:>=500 parsed_response.duration_ms:>1000  # Precise conditions

# Leverage nested field structure:
parsed_user.profile.department:engineering parsed_user.role:admin  # Hierarchical filtering

# Time-based analysis with parsed timestamps:
parsed_event.timestamp:>now-1h parsed_event.type:error  # Time + event filtering
```

## 📚 Related Documentation

- [Logs Query Syntax](../logs/query-syntax.md) - Complete syntax reference
- [JSON Log Parsing](../logs/json-parsing.md) - Parse structured JSON from log fields
- [Logs Autocomplete](../logs/autocomplete.md) - Autocomplete features
- [Logs Correlation](../logs/correlation.md) - Correlating with metrics
- [Performance Optimization](../advanced/performance.md) - Query optimization