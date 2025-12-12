# Smart Autocomplete

The intelligent autocomplete system provides context-aware suggestions while writing Datadog queries, making it easy to discover metrics, tags, and build complex queries without memorizing syntax.

## 🧠 Overview

Smart autocomplete features:
- **Context-aware suggestions** - Adapts to cursor position and query structure
- **Real-time validation** - Syntax checking as you type
- **Performance optimized** - Caching and debouncing for smooth experience
- **Keyboard navigation** - Efficient interaction without mouse
- **Secure backend** - All API calls handled by Grafana backend

## 🎯 How It Works

### Context Detection

The autocomplete automatically detects where your cursor is and provides relevant suggestions:

| Context | Trigger | What You Get |
|---------|---------|--------------|
| **Aggregation** | Start of query | `avg`, `sum`, `max`, `min`, `count` |
| **Metric** | After `:` | Available metric names from Datadog |
| **Tag Key** | Inside `{` | Available tag keys for the metric |
| **Tag Value** | After `:` in tags | Available values for the tag key |
| **Group By** | After `by {` | Available tag keys for grouping |

### Smart Suggestions

**Metric Autocomplete**:
```bash
# Type: sys
# Suggestions: system.cpu.user, system.memory.used, system.disk.free
```

**Tag Key Autocomplete**:
```bash
# Query: avg:system.cpu.user{
# Suggestions: host, service, env, availability_zone
```

**Tag Value Autocomplete**:
```bash
# Query: avg:system.cpu.user{host:
# Suggestions: web-01, web-02, db-01, cache-01
```

## ⌨️ Keyboard Navigation

### Essential Shortcuts

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate suggestions |
| `Enter` | Select suggestion and close menu |
| `Tab` | Select suggestion and keep menu open |
| `Escape` | Close autocomplete menu |
| `Cmd+Enter` / `Ctrl+Enter` | Execute query |
| `Cmd+/` / `Ctrl+/` | Toggle line comment |

### Efficient Workflow

1. **Start typing** - Autocomplete appears automatically
2. **Navigate with arrows** - Find the right suggestion
3. **Select with Enter** - Insert and continue typing
4. **Use Tab for chaining** - Select and keep menu open for next part

## 🔍 Query Building Examples

### Building a Basic Query

**Step 1**: Start with aggregation
```bash
# Type: a
# Select: avg
# Result: avg:
```

**Step 2**: Add metric
```bash
# Type: avg:sys
# Select: system.cpu.user
# Result: avg:system.cpu.user
```

**Step 3**: Add filters
```bash
# Type: avg:system.cpu.user{
# Select: service
# Result: avg:system.cpu.user{service:
```

**Step 4**: Add tag value
```bash
# Type: avg:system.cpu.user{service:
# Select: web
# Result: avg:system.cpu.user{service:web}
```

**Step 5**: Add grouping
```bash
# Type: avg:system.cpu.user{service:web} by {
# Select: host
# Result: avg:system.cpu.user{service:web} by {host}
```

### Complex Query Building

**Multi-tag Filtering**:
```bash
# Start: avg:system.cpu.user{
# Add: service:web,env:prod
# Result: avg:system.cpu.user{service:web,env:prod} by {host}
```

**Boolean Operators**:
```bash
# Type: avg:system.cpu.user{service IN (
# Autocomplete helps with: web,api,worker
# Result: avg:system.cpu.user{service IN (web,api)} by {host}
```

## ✅ Real-time Validation

### Syntax Checking

The editor validates your query as you type:

**Valid Query** ✅:
```bash
avg:system.cpu.user{host:web-01} by {host}
```
Shows green checkmark

**Invalid Queries** ❌:
```bash
system.cpu.user{host:web-01}          # Missing aggregation
avg:system.cpu.user{host=web-01}      # Wrong operator (= vs :)
avg:system.cpu.user{host:web-01       # Unmatched brace
```

### Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| "Missing aggregation function" | No `avg:`, `sum:`, etc. | Add aggregation at start |
| "Invalid tag syntax" | Wrong tag format | Use `key:value` not `key=value` |
| "Unmatched braces" | Missing `{` or `}` | Balance your braces |
| "Invalid operator" | Wrong boolean syntax | Use `IN`, `OR`, `AND` |

## 🚀 Performance Features

### Intelligent Caching

- **30-second TTL** - Suggestions cached to reduce API calls
- **Per-metric caching** - Tag suggestions cached by metric
- **Smart invalidation** - Cache refreshes when needed

### Debouncing

- **400ms delay** - Prevents excessive API calls while typing
- **Configurable** - Can be adjusted for different preferences
- **Smooth experience** - No lag or stuttering

### Concurrent Limiting

- **Max 5 requests** - Prevents API overload
- **Request queuing** - Excess requests wait for available slots
- **Graceful degradation** - Continues working under load

## 🔧 Advanced Features

### Context-Aware Filtering

**Metric Filtering**:
```bash
# Type: cpu
# Shows: system.cpu.user, system.cpu.system, container.cpu.usage
# Filters out: memory, disk, network metrics
```

**Tag Filtering**:
```bash
# Query: avg:kubernetes.memory.usage{
# Shows: pod_name, namespace, cluster_name
# Hides: irrelevant tags from other metrics
```

### Smart Completions

**Partial Matching**:
```bash
# Type: mem
# Matches: system.memory.used, container.memory.usage
# Also matches: system.mem.pct_usable (partial word match)
```

**Fuzzy Search**:
```bash
# Type: cpu.usr
# Matches: system.cpu.user (fuzzy matching)
```

## 🎨 UI Features

### Visual Indicators

- 🟢 **Green checkmark** - Valid query syntax
- 🔴 **Red X** - Syntax error detected
- 🔄 **Loading spinner** - Fetching suggestions
- 💡 **Lightbulb** - Autocomplete available

### Suggestion Display

```
┌─────────────────────────────────────────┐
│ avg:system.cpu.user{host:               │
│                         ↑               │
│ ┌─────────────────────────────────────┐ │
│ │ web-01                              │ │
│ │ web-02                          ← Selected
│ │ db-01                               │ │
│ │ cache-01                            │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Responsive Design

- **Adapts to panel size** - Suggestions fit available space
- **Mobile friendly** - Works on touch devices
- **High DPI support** - Crisp on retina displays

## 🔍 Troubleshooting

### Autocomplete Not Appearing

**Possible Causes**:
1. **Datasource not configured** - Check API credentials
2. **Cursor in wrong position** - Move cursor to appropriate location
3. **No suggestions available** - Verify metric exists in Datadog
4. **Network issues** - Check browser console for errors

**Solutions**:
1. Verify datasource configuration and test connection
2. Position cursor after `:`, inside `{`, or after tag `:`
3. Test query in Datadog UI first
4. Check network connectivity and API status

### Slow Performance

**Possible Causes**:
1. **Large metric catalog** - Thousands of metrics slow initial load
2. **Network latency** - Slow connection to Datadog API
3. **API rate limiting** - Too many requests

**Solutions**:
1. Use more specific metric filters
2. Increase debounce timing
3. Reduce concurrent request limit

### Incorrect Suggestions

**Possible Causes**:
1. **Stale cache** - Old suggestions cached
2. **Wrong metric context** - Suggestions for different metric
3. **API changes** - Datadog API returned different data

**Solutions**:
1. Wait 30 seconds for cache refresh or reload page
2. Verify cursor position and query context
3. Check Datadog API documentation for changes

## ⚙️ Configuration

### Debounce Timing

Adjust response speed vs API load:

```typescript
// In useQueryAutocomplete hook
const DEFAULT_DEBOUNCE_MS = 400; // Milliseconds

// Faster (more responsive, more API calls)
const FAST_DEBOUNCE_MS = 200;

// Slower (less responsive, fewer API calls)  
const SLOW_DEBOUNCE_MS = 800;
```

### Cache Settings

Control caching behavior:

```go
// In Go backend
ttl := 30 * time.Second  // Cache duration

// Longer cache (fewer API calls, staler data)
ttl := 300 * time.Second // 5 minutes

// Shorter cache (more API calls, fresher data)
ttl := 10 * time.Second  // 10 seconds
```

### Request Limits

Manage API load:

```go
// Maximum concurrent requests
concurrencyLimit: make(chan struct{}, 5)

// More concurrent (faster, higher load)
concurrencyLimit: make(chan struct{}, 10)

// Fewer concurrent (slower, lower load)
concurrencyLimit: make(chan struct{}, 2)
```

## 🔗 Integration with Other Features

### Variables

Autocomplete works with dashboard variables:

```bash
# Variable: $service
# Query: avg:system.cpu.user{service:$service} by {host}
# Autocomplete still works for host values
```

### Formulas

Base queries get full autocomplete support:

```bash
# Query A: avg:system.cpu.user{*} by {host}  ← Full autocomplete
# Query B: avg:system.cpu.total{*} by {host} ← Full autocomplete  
# Formula: $A * 100 / $B                     ← No autocomplete needed
```

### Comments

Autocomplete respects comments:

```bash
# This is a comment - no autocomplete
avg:system.cpu.user{*} by {host}  # Autocomplete works here
```

## 📚 Best Practices

### Efficient Query Building

1. **Start broad, then narrow** - Begin with basic metric, add filters
2. **Use autocomplete for discovery** - Explore available metrics and tags
3. **Validate as you go** - Watch for syntax errors
4. **Test incrementally** - Build complex queries step by step

### Performance Optimization

1. **Use specific filters** - Reduce data volume with precise tags
2. **Leverage caching** - Repeated queries benefit from cache
3. **Batch similar queries** - Group related metric exploration
4. **Monitor API usage** - Be mindful of rate limits

### Workflow Tips

1. **Learn keyboard shortcuts** - Much faster than mouse
2. **Use Tab for chaining** - Keep menu open for multiple selections
3. **Explore with autocomplete** - Discover new metrics and tags
4. **Validate before running** - Check syntax before execution

## 🔗 Related Documentation

- [Query Editor](query-editor.md) - Complete query editor guide
- [Getting Started](../getting-started.md) - Basic query building
- [Examples](../examples/queries.md) - Real-world query patterns
- [Troubleshooting](../advanced/troubleshooting.md) - Solving common issues