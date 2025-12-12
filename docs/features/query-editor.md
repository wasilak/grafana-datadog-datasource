# Query Editor

The advanced query editor provides a modern interface for building Datadog queries with intelligent autocomplete, validation, and enhanced features.

## 🎯 Overview

The query editor includes:
- **Smart Autocomplete** - Context-aware suggestions
- **Real-time Validation** - Syntax checking as you type
- **Formula Support** - Mathematical expressions across queries
- **Legend Configuration** - Custom series naming
- **Keyboard Shortcuts** - Efficient query building
- **Inline Comments** - Document your queries

## 🔧 Query Structure

### Basic Query Format

```
aggregation:metric.name{tag_filters} by {group_by_tags}
```

**Components**:
- `aggregation` - How to combine data points (avg, sum, max, min, count)
- `metric.name` - The metric to query
- `{tag_filters}` - Filter by specific tag values
- `by {group_by_tags}` - Group results by tag keys

### Examples

```bash
# Basic CPU usage
avg:system.cpu.user{*}

# CPU usage by host
avg:system.cpu.user{*} by {host}

# CPU usage for specific service
avg:system.cpu.user{service:web} by {host}

# CPU usage for multiple environments
avg:system.cpu.user{env IN (prod,staging)} by {host}
```

## 🧠 Smart Autocomplete

### Context Detection

The editor automatically detects where your cursor is and provides relevant suggestions:

| Context | Trigger | Suggestions |
|---------|---------|-------------|
| **Aggregation** | Start of query | `avg`, `sum`, `max`, `min`, `count` |
| **Metric** | After `:` | Available metric names |
| **Tag Key** | Inside `{` | Available tag keys for the metric |
| **Tag Value** | After `:` in tags | Available values for the tag key |
| **Group By** | After `by {` | Available tag keys |

### Autocomplete Features

**Real-time Suggestions**:
- Type to see filtered suggestions
- Arrow keys to navigate
- Enter or Tab to select
- Escape to close

**Performance Optimized**:
- 400ms debounce to prevent excessive API calls
- 30-second caching for repeated queries
- Maximum 5 concurrent requests to Datadog API

**Keyboard Navigation**:
- `↑/↓` - Navigate suggestions
- `Enter` - Select and close menu
- `Tab` - Select and keep menu open
- `Escape` - Close menu

## ✅ Real-time Validation

### Syntax Validation

The editor validates your query syntax as you type:

**Valid Query** ✅:
```
avg:system.cpu.user{host:web-01} by {host}
```
Shows green checkmark

**Invalid Query** ❌:
```
system.cpu.user{host:web-01}
```
Shows red error: "Missing aggregation function"

### Common Validation Errors

| Error | Cause | Solution |
|-------|-------|---------|
| "Missing aggregation function" | No aggregation at start | Add `avg:`, `sum:`, etc. |
| "Invalid tag syntax" | Wrong tag format | Use `key:value` not `key=value` |
| "Unmatched braces" | Missing `{` or `}` | Balance your braces |
| "Invalid operator" | Wrong boolean operator | Use `IN`, `OR`, `AND`, `NOT IN` |

## 🧮 Formula Support

### Creating Formulas

Formulas allow mathematical operations across multiple queries:

**Step 1**: Create base queries
- **Query A**: `sum:container.memory.usage{service:web}`
- **Query B**: `sum:container.memory.limit{service:web}`

**Step 2**: Add formula query
- **Type**: Select "Expression"
- **Expression**: `$A * 100 / $B`

**Result**: Memory usage percentage

### Formula Examples

**CPU Usage Percentage**:
```bash
# Query A: Used CPU
sum:system.cpu.user{*} by {host}

# Query B: Total CPU cores
avg:system.cpu.num_cores{*} by {host}

# Formula: CPU percentage
$A * 100 / $B
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

**Growth Rate**:
```bash
# Query A: Current value
avg:custom.metric{*}

# Query B: Previous value (offset)
avg:custom.metric{*}.rollup(avg, 3600)

# Formula: Growth percentage
($A - $B) * 100 / $B
```

### Formula Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `$A + $B` |
| `-` | Subtraction | `$A - $B` |
| `*` | Multiplication | `$A * 100` |
| `/` | Division | `$A / $B` |
| `()` | Grouping | `($A + $B) / $C` |

## 🏷️ Legend Configuration

### Legend Modes

**Auto Mode** (default):
- Format: `metric_name {tag1:value1, tag2:value2}`
- Example: `avg:system.cpu.user{host:web-01} by {host} {host:web-01}`
- Shows complete context

**Custom Mode**:
- Use template variables: `{{tag_name}}`
- Example template: `CPU: {{host}}`
- Result: `CPU: web-01`

### Legend Templates

**Basic Templates**:
```bash
# Simple host name
{{host}}

# Service and host
{{service}} - {{host}}

# With static text
CPU Usage: {{host}}
```

**Advanced Templates**:
```bash
# Multiple tags
{{service}} on {{host}} ({{env}})

# Conditional formatting
{{host}}{{#availability_zone}} - {{availability_zone}}{{/availability_zone}}

# With units
Memory: {{host}} ({{container_name}})
```

### Template Variables

Available variables depend on your query's group-by tags:

```bash
# Query: avg:system.cpu.user{*} by {host,service}
# Available: {{host}}, {{service}}

# Query: avg:container.memory.usage{*} by {container_name,pod_name}
# Available: {{container_name}}, {{pod_name}}
```

## ⚙️ Query Options

### Interval Override

Control the resolution of your queries:

**Auto** (default):
- Datadog automatically selects appropriate interval
- Based on time range and panel size

**Custom Interval**:
- Set specific interval in milliseconds
- Example: `300000` = 5 minutes
- Affects all queries in the panel

**Use Cases**:
- High-resolution monitoring: `60000` (1 minute)
- Long-term trends: `3600000` (1 hour)
- Reduce data points: `1800000` (30 minutes)

### Time Aggregation

Use rollup functions for time-based aggregation:

```bash
# 5-minute average
avg:system.cpu.user{*}.rollup(avg, 300)

# Maximum over 1 hour
max:system.cpu.user{*}.rollup(max, 3600)

# Sum over 15 minutes
sum:custom.events{*}.rollup(sum, 900)
```

## ⌨️ Keyboard Shortcuts

### Query Execution
- `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux) - Run query
- `Shift+Enter` - Run all queries in dashboard

### Editing
- `Cmd+/` / `Ctrl+/` - Toggle line comment
- `Cmd+A` / `Ctrl+A` - Select all text
- `Cmd+Z` / `Ctrl+Z` - Undo
- `Cmd+Y` / `Ctrl+Y` - Redo

### Autocomplete
- `↑/↓` - Navigate suggestions
- `Enter` - Select suggestion
- `Tab` - Select and continue
- `Escape` - Close autocomplete

## 💬 Inline Comments

Document your queries with comments:

```bash
# This query shows CPU usage across all hosts
avg:system.cpu.user{*} by {host}

# Memory usage for production services only
# Excludes development and staging environments
avg:system.mem.pct_usable{env:prod} by {host}
```

**Comment Features**:
- Lines starting with `#` are ignored
- Use `Cmd+/` / `Ctrl+/` to toggle comments
- Comments are preserved when saving
- Useful for documentation and debugging

## 🔍 Query Debugging

### Testing Queries

**In Query Editor**:
1. Write your query
2. Check for validation errors (red indicators)
3. Use autocomplete to verify metric/tag names
4. Run query to see results

**In Datadog UI**:
1. Copy your query
2. Test in Datadog's metric explorer
3. Verify data exists and syntax is correct
4. Copy back to Grafana

### Common Issues

**No Data Showing**:
1. Check time range covers data period
2. Verify metric name exists (use autocomplete)
3. Check tag filters aren't too restrictive
4. Test without tag filters first

**Autocomplete Not Working**:
1. Verify datasource configuration
2. Check API credentials
3. Look for errors in browser console
4. Ensure cursor is in correct position

**Query Too Slow**:
1. Add more specific tag filters
2. Reduce time range
3. Use fewer group-by tags
4. Consider using rollup functions

## 🎨 Query Editor UI

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Query Editor                                                │
├─────────────────────────────────────────────────────────────┤
│ [Query Type: Metrics ▼] [Format: Time series ▼]           │
├─────────────────────────────────────────────────────────────┤
│ Query: avg:system.cpu.user{*} by {host}              [✓]   │
│        ↑ Autocomplete suggestions appear here              │
├─────────────────────────────────────────────────────────────┤
│ Legend: [Auto ▼] Template: {{host}}                       │
├─────────────────────────────────────────────────────────────┤
│ Options: Interval: [Auto] ms                               │
└─────────────────────────────────────────────────────────────┘
```

### Visual Indicators

- ✅ **Green checkmark** - Valid query
- ❌ **Red X** - Syntax error
- 🔄 **Loading spinner** - Fetching suggestions
- 💡 **Lightbulb** - Autocomplete available

## 📚 Advanced Features

### Query Chaining

Build complex queries step by step:

```bash
# Start simple
system.cpu.user

# Add aggregation (autocomplete suggests)
avg:system.cpu.user

# Add filters (autocomplete shows available tags)
avg:system.cpu.user{service:web}

# Add grouping (autocomplete shows group-by options)
avg:system.cpu.user{service:web} by {host}
```

### Multi-Query Panels

Combine multiple queries in one panel:

1. **Query A**: `avg:system.cpu.user{*} by {host}`
2. **Query B**: `avg:system.cpu.system{*} by {host}`
3. **Query C**: `avg:system.cpu.iowait{*} by {host}`

Result: Complete CPU breakdown by component

### Query Templates

Save common query patterns:

**System Monitoring Template**:
```bash
# CPU
avg:system.cpu.user{env:$env} by {host}

# Memory
avg:system.mem.pct_usable{env:$env} by {host}

# Disk
avg:system.disk.used{env:$env} by {host}
```

## 🔗 Related Documentation

- [Autocomplete Guide](autocomplete.md) - Detailed autocomplete features
- [Formulas & Expressions](formulas.md) - Mathematical operations
- [Legend Configuration](legends.md) - Custom series naming
- [Variables](variables.md) - Dynamic dashboards
- [Query Examples](../examples/queries.md) - Real-world patterns