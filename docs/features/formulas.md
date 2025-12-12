# Formulas & Expressions

Create powerful mathematical expressions across multiple Datadog queries to calculate percentages, ratios, growth rates, and complex metrics.

## 🧮 Overview

Formulas allow you to:
- **Calculate percentages** - Memory usage, error rates, etc.
- **Create ratios** - Success/failure rates, efficiency metrics
- **Compute growth rates** - Period-over-period comparisons
- **Build complex metrics** - Combine multiple data sources
- **Normalize data** - Scale metrics for comparison

## 🚀 Quick Start

### Basic Formula Setup

1. **Create base queries**:
   - **Query A**: `sum:container.memory.usage{service:web}`
   - **Query B**: `sum:container.memory.limit{service:web}`

2. **Add formula query**:
   - Click **Add Query**
   - Select **Expression** type
   - Enter formula: `$A * 100 / $B`

3. **Result**: Memory usage percentage

### Formula Syntax

```bash
# Reference queries with $A, $B, $C, etc.
$A * 100 / $B

# Use parentheses for order of operations
($A + $B) / $C

# Combine with constants
$A * 1024  # Convert KB to bytes
```

## 📊 Common Formula Patterns

### Percentage Calculations

**Memory Usage Percentage**:
```bash
# Query A: Used memory
sum:system.mem.used{*} by {host}

# Query B: Total memory  
sum:system.mem.total{*} by {host}

# Formula: Usage percentage
$A * 100 / $B
```

**CPU Utilization**:
```bash
# Query A: CPU user time
avg:system.cpu.user{*} by {host}

# Query B: CPU system time
avg:system.cpu.system{*} by {host}

# Formula: Total CPU usage
($A + $B) * 100
```

**Error Rate**:
```bash
# Query A: Error count
sum:trace.web.request.errors{*} by {service}

# Query B: Total requests
sum:trace.web.request.hits{*} by {service}

# Formula: Error rate percentage
$A * 100 / $B
```

### Ratio Calculations

**Success Rate**:
```bash
# Query A: Successful requests
sum:http.requests{status:2xx} by {service}

# Query B: Total requests
sum:http.requests{*} by {service}

# Formula: Success rate
$A / $B
```

**Cache Hit Ratio**:
```bash
# Query A: Cache hits
sum:cache.hits{*} by {service}

# Query B: Cache misses
sum:cache.misses{*} by {service}

# Formula: Hit ratio
$A / ($A + $B)
```

**Efficiency Ratio**:
```bash
# Query A: Completed tasks
sum:tasks.completed{*} by {worker}

# Query B: CPU usage
avg:system.cpu.user{*} by {worker}

# Formula: Tasks per CPU unit
$A / $B
```

### Growth Rate Calculations

**Period-over-Period Growth**:
```bash
# Query A: Current period
sum:sales.revenue{*}

# Query B: Previous period (use time shift)
sum:sales.revenue{*}.rollup(sum, 86400)  # Daily rollup

# Formula: Growth rate percentage
($A - $B) * 100 / $B
```

**Rate of Change**:
```bash
# Query A: Current value
avg:custom.metric{*}

# Query B: Value 1 hour ago
avg:custom.metric{*}.rollup(avg, 3600)

# Formula: Hourly change rate
($A - $B) / $B
```

### Normalization

**Per-Unit Metrics**:
```bash
# Query A: Total requests
sum:http.requests{*} by {service}

# Query B: Number of instances
count:service.instances{*} by {service}

# Formula: Requests per instance
$A / $B
```

**Density Calculations**:
```bash
# Query A: Total memory usage
sum:container.memory.usage{*} by {cluster}

# Query B: Number of containers
count:container.running{*} by {cluster}

# Formula: Average memory per container
$A / $B
```

## 🔧 Advanced Formula Features

### Mathematical Operations

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `$A + $B` |
| `-` | Subtraction | `$A - $B` |
| `*` | Multiplication | `$A * 100` |
| `/` | Division | `$A / $B` |
| `()` | Grouping | `($A + $B) / $C` |

### Constants and Scaling

```bash
# Convert bytes to MB
$A / 1048576

# Convert seconds to minutes
$A / 60

# Scale percentage
$A * 100

# Add offset
$A + 1000
```

### Complex Expressions

**Multi-step Calculations**:
```bash
# Query A: CPU user
# Query B: CPU system  
# Query C: CPU cores
# Formula: CPU usage per core
($A + $B) / $C
```

**Weighted Averages**:
```bash
# Query A: Response time service 1
# Query B: Request count service 1
# Query C: Response time service 2
# Query D: Request count service 2
# Formula: Weighted average response time
($A * $B + $C * $D) / ($B + $D)
```

## 🎯 Real-World Examples

### Infrastructure Monitoring

**Disk Usage Forecast**:
```bash
# Query A: Current disk usage
avg:system.disk.used{*} by {host}

# Query B: Disk usage 24h ago
avg:system.disk.used{*}.rollup(avg, 86400) by {host}

# Formula: Daily growth rate
($A - $B) / $B

# Use result to forecast when disk will be full
```

**Network Utilization**:
```bash
# Query A: Bytes sent
sum:system.net.bytes_sent{*} by {host}

# Query B: Bytes received
sum:system.net.bytes_rcvd{*} by {host}

# Formula: Total network traffic
$A + $B
```

### Application Performance

**Apdex Score**:
```bash
# Query A: Satisfied requests (< 0.5s)
sum:trace.web.request{duration:<0.5} by {service}

# Query B: Tolerating requests (0.5s - 2s)
sum:trace.web.request{duration:0.5-2} by {service}

# Query C: Total requests
sum:trace.web.request{*} by {service}

# Formula: Apdex score
($A + $B/2) / $C
```

**Throughput Efficiency**:
```bash
# Query A: Successful requests
sum:http.requests{status:2xx} by {service}

# Query B: CPU usage
avg:system.cpu.user{*} by {service}

# Formula: Requests per CPU unit
$A / $B
```

### Business Metrics

**Conversion Rate**:
```bash
# Query A: Conversions
sum:ecommerce.purchases{*}

# Query B: Visitors
sum:web.visitors{*}

# Formula: Conversion rate percentage
$A * 100 / $B
```

**Revenue per User**:
```bash
# Query A: Total revenue
sum:revenue.total{*}

# Query B: Active users
count:users.active{*}

# Formula: Revenue per user
$A / $B
```

## 🔍 Formula Debugging

### Testing Formulas

**Step 1: Verify Base Queries**
1. Test each query individually
2. Ensure they return expected data
3. Check time ranges align
4. Verify grouping tags match

**Step 2: Test Formula Logic**
1. Start with simple operations
2. Add complexity gradually
3. Use known values to verify calculations
4. Check for division by zero

**Step 3: Validate Results**
1. Compare with manual calculations
2. Test edge cases (zero values, nulls)
3. Verify units and scaling
4. Check time alignment

### Common Issues

**Division by Zero**:
```bash
# Problem: $A / $B where $B might be 0
# Solution: Add small constant
$A / ($B + 0.001)
```

**Mismatched Time Series**:
```bash
# Problem: Queries have different time ranges
# Solution: Ensure same time range and grouping
# Query A: avg:metric1{*} by {host}
# Query B: avg:metric2{*} by {host}  # Same grouping
```

**Unit Mismatches**:
```bash
# Problem: Mixing bytes and MB
# Solution: Convert to same units
# $A (bytes) / ($B * 1048576)  # Convert MB to bytes
```

### Debugging Tips

1. **Test queries separately** before combining
2. **Use simple test data** to verify logic
3. **Check for null values** that might break calculations
4. **Verify time alignment** between queries
5. **Use constants** to test formula logic

## 📈 Visualization Tips

### Legend Configuration

**Show Formula Result**:
```bash
# Formula: $A * 100 / $B
# Legend: "Memory Usage: {{host}}"
# Result: "Memory Usage: web-01"
```

**Include Calculation Context**:
```bash
# Legend: "{{service}} Error Rate ({{errors}}/{{total}})"
# Shows both the rate and raw numbers
```

### Panel Configuration

**Units**: Set appropriate units for formula results
- Percentages: `percent (0-100)`
- Ratios: `short`
- Rates: `ops` or `reqps`

**Thresholds**: Add meaningful thresholds
- Error rates: Warning at 1%, Critical at 5%
- Memory usage: Warning at 80%, Critical at 95%

**Time Range**: Ensure sufficient data for calculations
- Growth rates need historical data
- Ratios need concurrent data points

## 🔗 Integration with Variables

### Dynamic Formulas

Use dashboard variables in base queries:

```bash
# Query A: sum:requests{service:$service,env:$env}
# Query B: sum:errors{service:$service,env:$env}
# Formula: $A * 100 / $B

# Result: Error rate for selected service and environment
```

### Multi-Service Comparisons

```bash
# Query A: avg:response_time{service:web}
# Query B: avg:response_time{service:api}
# Formula: ($A - $B) / $B

# Result: Performance difference between services
```

## 📚 Best Practices

### Formula Design

1. **Keep formulas simple** - Complex expressions are hard to debug
2. **Use meaningful query names** - A, B, C become confusing
3. **Document your logic** - Add comments explaining calculations
4. **Test edge cases** - Zero values, missing data, etc.
5. **Validate results** - Compare with known good calculations

### Performance Optimization

1. **Minimize query count** - Each query adds API overhead
2. **Use specific filters** - Reduce data volume
3. **Align time ranges** - Ensure queries cover same period
4. **Cache results** - Use appropriate refresh intervals

### Maintenance

1. **Monitor formula accuracy** - Verify results periodically
2. **Update for metric changes** - Adapt when underlying metrics change
3. **Document assumptions** - Note any business logic or constants used
4. **Version control** - Track formula changes over time

## 🔗 Related Documentation

- [Query Editor](query-editor.md) - Building base queries
- [Variables](variables.md) - Dynamic formulas
- [Examples](../examples/queries.md) - More formula examples
- [Performance](../advanced/performance.md) - Optimization tips