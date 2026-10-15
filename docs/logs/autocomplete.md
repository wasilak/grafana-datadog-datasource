# Logs Autocomplete

The plugin provides intelligent autocomplete for Datadog logs queries, making it easy to discover and build complex log searches without memorizing syntax.

## 🎯 Overview

The logs autocomplete system provides:
- **Context-aware suggestions** based on cursor position
- **Real-time validation** with error highlighting
- **Facet discovery** from your actual log data
- **Smart filtering** based on what you're typing
- **Performance optimization** with caching and debouncing

## 🔍 Autocomplete Features

### Service Autocomplete

When typing `service:`, the plugin fetches actual service names from your logs:

```bash
service:web-app
service:api-gateway
service:database
service:auth-service
service:payment-processor
```

**How it works**:
- Queries recent logs to find unique service values
- Caches results for 10 minutes
- Updates automatically as new services appear in logs

### Source Autocomplete

When typing `source:`, get suggestions for log sources:

```bash
source:nginx
source:apache
source:application
source:docker
source:kubernetes
source:syslog
```

**Sources include**:
- Web servers (nginx, apache)
- Application frameworks
- Container platforms
- System services
- Custom log shippers

### Status Level Autocomplete

When typing `status:`, get standard log levels:

```bash
status:ERROR
status:WARN
status:INFO
status:DEBUG
status:TRACE
status:FATAL
```

**Smart combinations**:
```bash
status:(ERROR OR WARN)
status:(ERROR OR WARN OR FATAL)
status:(INFO OR DEBUG)
```

### Host Autocomplete

When typing `host:`, get actual hostnames from your infrastructure:

```bash
host:web-01
host:api-server-prod
host:db-primary
host:worker-node-*
```

### Custom Attribute Autocomplete

For custom attributes with `@` prefix:

```bash
@env:production
@env:staging
@env:development

@version:1.2.3
@version:2.0.0

@user.role:admin
@user.role:user
@user.role:guest
```

## 🎨 Context-Aware Suggestions

### General Search Context

When starting a new query or in open text:

```bash
# Typing: "err"
error
ERROR
"error message"
service:error-handler
@error.type:*
```

### Facet Context

When typing after a facet name:

```bash
# Typing: "service:web"
service:web-app
service:web-api
service:web-frontend
service:web-*
```

### Boolean Context

After boolean operators:

```bash
# After "service:web-app AND "
status:ERROR
source:nginx
@env:production
host:*
```

### Parentheses Context

Inside grouped expressions:

```bash
# Inside "(service:web-app OR "
service:api-gateway
service:database
service:auth
```

## ⚡ Smart Features

### Fuzzy Matching

The autocomplete uses fuzzy matching to find relevant suggestions:

```bash
# Typing: "webap"
→ service:web-app
→ service:webapp-frontend
→ @app.name:web-application
```

### Prefix Matching

Suggestions prioritize prefix matches:

```bash
# Typing: "web"
→ service:web-app        # Exact prefix match (highest priority)
→ service:web-frontend   # Exact prefix match
→ host:web-server-01     # Exact prefix match
→ service:my-web-app     # Contains match (lower priority)
```

### Contextual Filtering

Suggestions adapt based on what you're typing:

```bash
# In service context, typing "a"
service:api-gateway
service:auth-service
service:analytics

# In status context, typing "e"
status:ERROR
# (no "e" suggestions for status since ERROR is the only match)
```

### Multi-Value Support

Smart handling of multiple values:

```bash
# After "service:(web-app OR "
api-gateway
database
auth-service
# Excludes "web-app" since it's already selected
```

## 🔧 Configuration and Caching

### Cache Behavior

The autocomplete system uses intelligent caching:

- **Services**: Cached for 10 minutes
- **Sources**: Cached for 10 minutes  
- **Levels**: Static list (no caching needed)
- **Hosts**: Cached for 5 minutes
- **Custom attributes**: Cached for 10 minutes

### Cache Invalidation

Caches are automatically invalidated when:
- TTL expires
- API returns new data
- Datasource configuration changes

### Performance Optimization

- **Debouncing**: 300ms delay before triggering autocomplete
- **Request limiting**: Maximum 5 concurrent requests
- **Smart caching**: Avoids redundant API calls
- **Background refresh**: Updates cache in background when possible

## 🎮 Keyboard Navigation

### Basic Navigation

- `↑` / `↓` - Navigate through suggestions
- `Enter` - Select highlighted suggestion
- `Escape` - Close autocomplete menu
- `Tab` - Accept suggestion and continue typing

### Advanced Navigation

- `Cmd/Ctrl + Enter` - Execute query
- `Cmd/Ctrl + /` - Toggle comment
- `Cmd/Ctrl + A` - Select all text
- `Cmd/Ctrl + Z` - Undo last change

### Mouse Interaction

- **Click** - Select suggestion
- **Hover** - Highlight suggestion
- **Scroll** - Navigate long suggestion lists

## 🎯 Usage Examples

### Building Complex Queries

1. **Start typing service name**:
   ```
   service:
   ```
   → Select from service suggestions

2. **Add boolean operator**:
   ```
   service:web-app AND 
   ```
   → Get contextual suggestions

3. **Add status filter**:
   ```
   service:web-app AND status:
   ```
   → Select from status levels

4. **Add custom attribute**:
   ```
   service:web-app AND status:ERROR AND @
   ```
   → Get custom attribute suggestions

### Error Investigation Workflow

1. **Start with service**:
   ```
   service:web-app
   ```

2. **Add error status**:
   ```
   service:web-app status:ERROR
   ```

3. **Filter by environment**:
   ```
   service:web-app status:ERROR @env:production
   ```

4. **Add time constraint**:
   ```
   service:web-app status:ERROR @env:production @timestamp:>now-1h
   ```

### Performance Analysis Workflow

1. **Start with response time**:
   ```
   @http.response_time:>1000
   ```

2. **Add service filter**:
   ```
   @http.response_time:>1000 AND service:api
   ```

3. **Filter by method**:
   ```
   @http.response_time:>1000 AND service:api AND @http.method:POST
   ```

## 🚨 Troubleshooting

### Autocomplete Not Working

**Issue**: No suggestions appearing

**Solutions**:
1. Check datasource configuration
2. Verify API credentials have logs access (`logs_read_data` scope)
3. Check browser console for errors
4. Ensure cursor is in correct position
5. Try refreshing the page

### Slow Autocomplete

**Issue**: Suggestions taking too long to appear

**Solutions**:
1. Check network connection
2. Verify Datadog API is responsive
3. Clear browser cache
4. Check for rate limiting in browser console

### Missing Suggestions

**Issue**: Expected services/sources not appearing

**Solutions**:
1. Verify logs exist for the time range
2. Check if services are active in selected time window
3. Ensure API key has access to relevant log indexes
4. Try expanding time range in Grafana

### Incorrect Suggestions

**Issue**: Autocomplete showing wrong or outdated values

**Solutions**:
1. Wait for cache to expire (10 minutes)
2. Refresh the page to clear cache
3. Check if log data has changed recently
4. Verify time range includes recent data

## 🔗 API Integration

### Backend Endpoints

The autocomplete system uses these backend endpoints:

```bash
# Service names
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/services

# Source names  
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/sources

# Log levels
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/levels

# Field names
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/fields

# Field values
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/field-values/{field}

# Tag names
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/tags

# Tag values
GET /api/datasources/uid/{uid}/resources/autocomplete/logs/tag-values/{tag}
```

### Authentication

All requests use the same authentication as logs queries:
- DD-API-KEY header with Datadog API key
- DD-APPLICATION-KEY header with Datadog App key
- Proper error handling for permission issues

### Rate Limiting

The system respects Datadog API rate limits:
- Maximum 5 concurrent requests
- Exponential backoff on rate limit errors
- Graceful degradation when limits exceeded

## 📊 Performance Metrics

### Response Times

Typical autocomplete response times:
- **Cache hit**: < 50ms
- **API call**: 200-500ms
- **First load**: 500-1000ms

### Cache Efficiency

Expected cache hit rates:
- **Services**: 80-90% (services change infrequently)
- **Sources**: 85-95% (sources are relatively stable)
- **Custom attributes**: 70-80% (more dynamic)

### Request Volume

Typical request patterns:
- **Initial load**: 3-5 requests (services, sources, levels)
- **During typing**: 0-2 requests per keystroke (with debouncing)
- **Cache refresh**: 1-3 requests per 10 minutes

## 🎨 Customization

### Suggestion Formatting

Suggestions include:
- **Name**: The actual value to insert
- **Description**: Helpful context about the value
- **Kind**: Type of suggestion (service, source, etc.)
- **Documentation**: Additional help text

### Visual Indicators

- 🏷️ **Facets**: service, source, status
- 🔧 **Operators**: AND, OR, NOT
- 📊 **Functions**: Aggregation functions
- 🎯 **Values**: Actual field values

## 📚 Best Practices

### Efficient Usage

1. **Let autocomplete guide you**: Don't memorize all service names
2. **Use fuzzy matching**: Type partial names to find services
3. **Leverage context**: Autocomplete adapts to what you're building
4. **Combine with validation**: Real-time error checking helps catch issues

### Query Building Strategy

1. **Start broad**: Begin with service or source
2. **Add specificity**: Use status, environment filters
3. **Refine gradually**: Add custom attributes as needed
4. **Validate continuously**: Check for syntax errors as you type

### Performance Tips

1. **Use caching**: Don't clear cache unnecessarily
2. **Be patient**: Initial load may take a moment
3. **Type efficiently**: Debouncing means you can type quickly
4. **Use keyboard shortcuts**: Faster than mouse navigation

## 🔗 Related Documentation

- [Logs Query Syntax](query-syntax.md) - Complete syntax reference
- [Getting Started with Logs](getting-started.md) - Basic logs usage
- [Performance Optimization](../advanced/performance.md) - General performance tips
- [Troubleshooting](../advanced/troubleshooting.md) - Common issues and solutions