# Query Examples

Real-world query patterns and examples for common monitoring scenarios.

## 🎯 System Monitoring

### CPU Monitoring

**Basic CPU Usage**:
```bash
# Average CPU usage across all hosts
avg:system.cpu.user{*}

# CPU usage by host
avg:system.cpu.user{*} by {host}

# CPU usage for specific environment
avg:system.cpu.user{env:production} by {host}
```

**CPU Breakdown**:
```bash
# User CPU time
avg:system.cpu.user{*} by {host}

# System CPU time  
avg:system.cpu.system{*} by {host}

# I/O wait time
avg:system.cpu.iowait{*} by {host}

# Total CPU usage (formula)
# Query A: avg:system.cpu.user{*} by {host}
# Query B: avg:system.cpu.system{*} by {host}
# Formula: $A + $B
```

**CPU Utilization Percentage**:
```bash
# Query A: CPU usage (user + system)
avg:system.cpu.user{*} by {host} + avg:system.cpu.system{*} by {host}

# Query B: Number of CPU cores
avg:system.cpu.num_cores{*} by {host}

# Formula: CPU utilization percentage
$A * 100 / $B
```

### Memory Monitoring

**Memory Usage**:
```bash
# Memory usage percentage
avg:system.mem.pct_usable{*} by {host}

# Available memory in bytes
avg:system.mem.usable{*} by {host}

# Total memory
avg:system.mem.total{*} by {host}
```

**Memory Breakdown**:
```bash
# Used memory
avg:system.mem.used{*} by {host}

# Cached memory
avg:system.mem.cached{*} by {host}

# Buffer memory
avg:system.mem.buffered{*} by {host}

# Free memory
avg:system.mem.free{*} by {host}
```

**Memory Usage Formula**:
```bash
# Query A: Used memory
avg:system.mem.used{*} by {host}

# Query B: Total memory
avg:system.mem.total{*} by {host}

# Formula: Memory usage percentage
$A * 100 / $B
```

### Disk Monitoring

**Disk Usage**:
```bash
# Disk usage by device
avg:system.disk.used{*} by {host,device}

# Disk usage percentage
avg:system.disk.in_use{*} by {host,device}

# Free disk space
avg:system.disk.free{*} by {host,device}
```

**Disk I/O**:
```bash
# Read operations per second
avg:system.io.r_s{*} by {host,device}

# Write operations per second
avg:system.io.w_s{*} by {host,device}

# Read bytes per second
avg:system.io.rkb_s{*} by {host,device}

# Write bytes per second
avg:system.io.wkb_s{*} by {host,device}
```

### Network Monitoring

**Network Traffic**:
```bash
# Bytes received per second
avg:system.net.bytes_rcvd{*} by {host,interface}

# Bytes sent per second
avg:system.net.bytes_sent{*} by {host,interface}

# Packets received per second
avg:system.net.packets_in.count{*} by {host,interface}

# Packets sent per second
avg:system.net.packets_out.count{*} by {host,interface}
```

**Network Errors**:
```bash
# Receive errors
avg:system.net.packets_in.error{*} by {host,interface}

# Transmit errors
avg:system.net.packets_out.error{*} by {host,interface}

# Dropped packets
avg:system.net.packets_in.drop{*} by {host,interface}
```

## 🐳 Container Monitoring

### Docker Containers

**Container Resource Usage**:
```bash
# CPU usage by container
avg:docker.cpu.usage{*} by {container_name}

# Memory usage by container
avg:docker.mem.usage{*} by {container_name}

# Memory limit by container
avg:docker.mem.limit{*} by {container_name}

# Network I/O by container
avg:docker.net.bytes_rcvd{*} by {container_name}
avg:docker.net.bytes_sent{*} by {container_name}
```

**Container Counts**:
```bash
# Running containers
sum:docker.containers.running{*}

# Stopped containers
sum:docker.containers.stopped{*}

# Total containers
sum:docker.containers.running{*} + sum:docker.containers.stopped{*}
```

**Container Memory Percentage**:
```bash
# Query A: Memory usage
avg:docker.mem.usage{*} by {container_name}

# Query B: Memory limit
avg:docker.mem.limit{*} by {container_name}

# Formula: Memory usage percentage
$A * 100 / $B
```

### Kubernetes

**Pod Monitoring**:
```bash
# CPU usage by pod
avg:kubernetes.cpu.usage{*} by {pod_name,namespace}

# Memory usage by pod
avg:kubernetes.memory.usage{*} by {pod_name,namespace}

# Pod restarts
sum:kubernetes.containers.restarts{*} by {pod_name,namespace}

# Pod status
sum:kubernetes.pods.running{*} by {namespace}
```

**Node Monitoring**:
```bash
# Node CPU usage
avg:kubernetes.cpu.usage{*} by {node}

# Node memory usage
avg:kubernetes.memory.usage{*} by {node}

# Pods per node
count:kubernetes.pods.running{*} by {node}
```

**Namespace Resource Usage**:
```bash
# CPU usage by namespace
sum:kubernetes.cpu.usage{*} by {namespace}

# Memory usage by namespace
sum:kubernetes.memory.usage{*} by {namespace}

# Pod count by namespace
count:kubernetes.pods.running{*} by {namespace}
```

## 🌐 Application Monitoring

### Web Application Metrics

**Request Metrics**:
```bash
# Request rate
sum:trace.web.request.hits{*} by {service}

# Average response time
avg:trace.web.request.duration{*} by {service}

# 95th percentile response time
p95:trace.web.request.duration{*} by {service}

# Error count
sum:trace.web.request.errors{*} by {service}
```

**Error Rate Calculation**:
```bash
# Query A: Error count
sum:trace.web.request.errors{*} by {service}

# Query B: Total requests
sum:trace.web.request.hits{*} by {service}

# Formula: Error rate percentage
$A * 100 / $B
```

**Throughput by Endpoint**:
```bash
# Requests per endpoint
sum:trace.web.request.hits{*} by {service,resource_name}

# Response time by endpoint
avg:trace.web.request.duration{*} by {service,resource_name}

# Error rate by endpoint
sum:trace.web.request.errors{*} by {service,resource_name}
```

### Database Monitoring

**Connection Metrics**:
```bash
# Active connections
avg:postgresql.connections{*} by {db}

# Connection utilization
avg:postgresql.percent_usage_connections{*} by {db}

# Max connections
avg:postgresql.max_connections{*} by {db}
```

**Query Performance**:
```bash
# Query execution time
avg:postgresql.query_time{*} by {db}

# Slow queries
count:postgresql.slow_queries{*} by {db}

# Queries per second
rate:postgresql.queries{*} by {db}
```

**Database Size**:
```bash
# Database size in bytes
sum:postgresql.database_size{*} by {db}

# Table size
sum:postgresql.table_size{*} by {db,table}

# Index size
sum:postgresql.index_size{*} by {db,table}
```

### Cache Monitoring

**Redis Metrics**:
```bash
# Memory usage
avg:redis.mem.used{*} by {redis_host}

# Hit rate
avg:redis.stats.keyspace_hits{*} by {redis_host}

# Miss rate
avg:redis.stats.keyspace_misses{*} by {redis_host}

# Connected clients
avg:redis.net.clients{*} by {redis_host}
```

**Cache Hit Ratio**:
```bash
# Query A: Cache hits
sum:redis.stats.keyspace_hits{*} by {redis_host}

# Query B: Cache misses
sum:redis.stats.keyspace_misses{*} by {redis_host}

# Formula: Hit ratio percentage
$A * 100 / ($A + $B)
```

## 📊 Business Metrics

### E-commerce

**Sales Metrics**:
```bash
# Revenue by region
sum:ecommerce.revenue{*} by {region}

# Orders by product category
count:ecommerce.orders{*} by {category}

# Average order value
avg:ecommerce.order_value{*} by {region}
```

**Conversion Funnel**:
```bash
# Page views
sum:web.page_views{*} by {page}

# Add to cart events
sum:ecommerce.add_to_cart{*}

# Purchases
sum:ecommerce.purchases{*}

# Conversion rate (formula)
# Query A: Purchases
# Query B: Page views
# Formula: $A * 100 / $B
```

### User Analytics

**User Activity**:
```bash
# Active users
count:user.sessions{*} by {platform}

# Session duration
avg:user.session_duration{*} by {platform}

# Page views per session
avg:user.page_views_per_session{*} by {platform}
```

**User Engagement**:
```bash
# Daily active users
count:user.daily_active{*}

# Weekly active users
count:user.weekly_active{*}

# Monthly active users
count:user.monthly_active{*}
```

## 🔧 Advanced Query Patterns

### Boolean Operators

**Multiple Environments**:
```bash
# Production and staging only
avg:system.cpu.user{env IN (production,staging)} by {host}

# Exclude development
avg:system.cpu.user{env NOT IN (development,test)} by {host}

# Multiple services
avg:trace.web.request.duration{service IN (web,api,worker)} by {service}
```

**Complex Filtering**:
```bash
# High-priority services in production
avg:system.cpu.user{env:production AND priority:high} by {service}

# Web or API services
avg:trace.web.request.hits{service:web OR service:api} by {service}

# Production web services excluding canary
avg:system.memory.usage{env:production AND service:web AND version NOT IN (canary)} by {host}
```

### Time-based Aggregation

**Rollup Functions**:
```bash
# 5-minute average
avg:system.cpu.user{*}.rollup(avg, 300) by {host}

# Hourly maximum
max:system.cpu.user{*}.rollup(max, 3600) by {host}

# Daily sum
sum:web.requests{*}.rollup(sum, 86400) by {service}
```

**Rate Calculations**:
```bash
# Requests per second
rate:web.requests{*} by {service}

# Bytes per second
rate:system.net.bytes_sent{*} by {host}

# Errors per minute
rate:application.errors{*}.rollup(sum, 60) by {service}
```

### Percentiles and Statistics

**Response Time Percentiles**:
```bash
# 50th percentile (median)
p50:trace.web.request.duration{*} by {service}

# 95th percentile
p95:trace.web.request.duration{*} by {service}

# 99th percentile
p99:trace.web.request.duration{*} by {service}

# Maximum
max:trace.web.request.duration{*} by {service}
```

**Statistical Functions**:
```bash
# Standard deviation
stddev:system.cpu.user{*} by {host}

# Minimum value
min:system.memory.usage{*} by {host}

# Count of data points
count:system.cpu.user{*} by {host}
```

## 🚨 Alerting Queries

### Threshold-based Alerts

**High CPU Usage**:
```bash
# CPU usage above 80%
avg:system.cpu.user{*} by {host} > 80
```

**Low Disk Space**:
```bash
# Disk usage above 90%
avg:system.disk.in_use{*} by {host,device} > 90
```

**High Error Rate**:
```bash
# Error rate above 5%
# Query A: Errors
sum:trace.web.request.errors{*} by {service}

# Query B: Total requests
sum:trace.web.request.hits{*} by {service}

# Formula: Error rate
$A * 100 / $B > 5
```

### Anomaly Detection

**Sudden Traffic Spikes**:
```bash
# Current request rate vs 1 hour ago
# Query A: Current rate
rate:web.requests{*} by {service}

# Query B: Rate 1 hour ago
rate:web.requests{*}.rollup(avg, 3600) by {service}

# Formula: Percentage increase
($A - $B) * 100 / $B > 200  # 200% increase
```

**Response Time Degradation**:
```bash
# Current response time vs baseline
# Query A: Current p95 response time
p95:trace.web.request.duration{*} by {service}

# Query B: Baseline (24h average)
avg:trace.web.request.duration{*}.rollup(avg, 86400) by {service}

# Formula: Degradation percentage
($A - $B) * 100 / $B > 50  # 50% slower
```

## 📈 Performance Optimization

### Efficient Queries

**Use Specific Filters**:
```bash
# Good: Specific service and environment
avg:system.cpu.user{service:web,env:production} by {host}

# Avoid: Too broad
avg:system.cpu.user{*} by {host}
```

**Appropriate Aggregation**:
```bash
# For rates: Use sum
sum:web.requests{*} by {service}

# For averages: Use avg
avg:system.cpu.user{*} by {host}

# For maximums: Use max
max:system.memory.usage{*} by {host}
```

**Limit Grouping**:
```bash
# Good: Essential grouping
avg:system.cpu.user{*} by {host}

# Avoid: Too many groups
avg:system.cpu.user{*} by {host,service,env,version,datacenter}
```

## 🔗 Related Documentation

- [Query Editor](../features/query-editor.md) - Building queries with autocomplete
- [Formulas](../features/formulas.md) - Mathematical expressions
- [Variables](../features/variables.md) - Dynamic queries
- [Performance](../advanced/performance.md) - Query optimization