# JSON Log Parsing

This guide covers the JSON parsing feature that allows you to parse structured JSON data from log fields and access individual properties as separate columns in Grafana.

## 🎯 Overview

The JSON parsing feature addresses the common scenario where applications log structured data as JSON strings, but you need to access individual fields for filtering, visualization, and analysis. Instead of seeing escaped JSON strings, you can parse them into structured data with accessible fields.

### What JSON Parsing Does

- **Converts JSON strings** → **Structured data columns**
- **Enables field-level filtering** on nested JSON properties
- **Improves log exploration** with individual field access
- **Maintains original data** alongside parsed fields
- **Handles various JSON structures** dynamically

### What You Get Automatically

```bash
# Datadog logs automatically include structured data:
attributes: {
  "service": "web-app",
  "env": "production", 
  "user_id": 123,
  "request_id": "abc-123"
}

tags: {
  "version": "1.2.3",
  "datacenter": "us-east-1",
  "team": "backend"
}

# These become individual columns in Grafana for filtering/aggregation:
service: "web-app"           ← Individual column for filtering
env: "production"            ← Individual column for filtering  
user_id: 123                 ← Individual column for filtering
request_id: "abc-123"        ← Individual column for filtering
version: "1.2.3"             ← Individual column for filtering
datacenter: "us-east-1"      ← Individual column for filtering
team: "backend"              ← Individual column for filtering
```

### Optional Message Parsing

```bash
# If your log message contains JSON:
message: "{\"action\":\"login\",\"result\":\"success\",\"duration_ms\":45}"

# Enable message parsing to get:
parsed_action: "login"
parsed_result: "success"
parsed_duration_ms: 45
```

## 🚀 Getting Started

### Step 1: Automatic Parsing (Always Enabled)

**Attributes and tags are automatically parsed** - no configuration needed! Datadog logs already come with structured JSON data in these fields.

### Step 2: Optional Message Parsing

1. Open the **Logs Query Editor**
2. Look for the **Parse Message JSON** section below the main query input
3. Click **Parse Message as JSON** to enable parsing of the log message field

### Step 3: Run Your Query

Execute your logs query as normal. You'll see:
- **Automatic fields**: All attributes and tags as individual columns
- **Optional fields**: Parsed message content (if enabled)

## 📋 Configuration Options

### Automatic Parsing (Always Enabled)

| Field | Description | Status |
|-------|-------------|--------|
| `attributes` | All log attributes from Datadog | ✅ Always parsed automatically |
| `tags` | All log tags from Datadog | ✅ Always parsed automatically |

### Optional Message Parsing

| Field Option | Description | Configuration |
|--------------|-------------|---------------|
| `message` | Parse JSON content from log message | Toggle on/off as needed |

### Built-in Safeguards

The JSON parser includes automatic protections:

- **Size Limits**: Large JSON objects are limited to prevent memory issues
- **Depth Limits**: Deeply nested structures are limited to prevent performance degradation  
- **Timeout Protection**: Parsing operations timeout to prevent query blocking
- **Error Handling**: Invalid JSON preserves original data and continues processing

## 🔧 Field Structure and Naming

### Flattened Field Names

Nested JSON objects are flattened using dot notation:

```json
// Original JSON
{
  "user": {
    "profile": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  },
  "session": {
    "id": "sess_123",
    "duration": 3600
  }
}

// Resulting fields
parsed_user.profile.name: "John Doe"
parsed_user.profile.email: "john@example.com"
parsed_user.preferences.theme: "dark"
parsed_user.preferences.notifications: true
parsed_session.id: "sess_123"
parsed_session.duration: 3600
```

### Array Handling

JSON arrays are serialized as JSON strings for display:

```json
// Original JSON
{
  "tags": ["production", "web-app", "critical"],
  "errors": [
    {"code": 500, "message": "Internal error"},
    {"code": 404, "message": "Not found"}
  ]
}

// Resulting fields
parsed_tags: "[\"production\",\"web-app\",\"critical\"]"
parsed_errors: "[{\"code\":500,\"message\":\"Internal error\"},{\"code\":404,\"message\":\"Not found\"}]"
```

### Field Name Conflicts

When parsed field names conflict with existing log fields, they are prefixed with `parsed_`:

```bash
# If log already has a "user" field
user: "original-user-field"           # Original field preserved
parsed_user: "parsed-json-user-data"  # Parsed field prefixed
```

## 📊 Common JSON Parsing Patterns

### Application Logs

```bash
# Structured application logging
{
  "level": "ERROR",
  "timestamp": "2023-12-01T10:00:00Z",
  "service": "user-service",
  "trace_id": "abc123",
  "user_id": 12345,
  "action": "login_attempt",
  "result": "failed",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username or password incorrect"
  },
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "session_id": "sess_789"
  }
}

# Parsed fields available for filtering
parsed_service: "user-service"
parsed_trace_id: "abc123"
parsed_user_id: 12345
parsed_action: "login_attempt"
parsed_result: "failed"
parsed_error.code: "INVALID_CREDENTIALS"
parsed_error.message: "Username or password incorrect"
parsed_metadata.ip_address: "192.168.1.100"
parsed_metadata.session_id: "sess_789"
```

### API Gateway Logs

```bash
# HTTP request/response logging
{
  "request": {
    "method": "POST",
    "path": "/api/users",
    "headers": {
      "content-type": "application/json",
      "authorization": "Bearer ***"
    },
    "body_size": 256
  },
  "response": {
    "status": 201,
    "headers": {
      "content-type": "application/json"
    },
    "body_size": 128,
    "duration_ms": 45
  },
  "client": {
    "ip": "10.0.1.50",
    "user_agent": "curl/7.68.0"
  }
}

# Parsed fields for analysis
parsed_request.method: "POST"
parsed_request.path: "/api/users"
parsed_response.status: 201
parsed_response.duration_ms: 45
parsed_client.ip: "10.0.1.50"
```

### Database Query Logs

```bash
# Database operation logging
{
  "operation": "SELECT",
  "table": "users",
  "query": "SELECT * FROM users WHERE active = true",
  "execution_time_ms": 125,
  "rows_affected": 1500,
  "connection": {
    "pool_id": "pool_1",
    "connection_id": "conn_456"
  },
  "performance": {
    "cpu_time_ms": 89,
    "io_time_ms": 36,
    "cache_hits": 12,
    "cache_misses": 3
  }
}

# Parsed fields for performance monitoring
parsed_operation: "SELECT"
parsed_table: "users"
parsed_execution_time_ms: 125
parsed_rows_affected: 1500
parsed_performance.cpu_time_ms: 89
parsed_performance.io_time_ms: 36
parsed_performance.cache_hits: 12
```

## 🔍 Filtering and Aggregation in Grafana UI

### Individual Columns Enable Grafana Operations

Each attribute and tag becomes an individual column in Grafana, enabling:

**Filtering**:
- Click column headers to filter by specific values
- Use Grafana's filter controls in the logs panel
- Create dashboard variables from column values

**Aggregation**:
- Group logs by service, environment, version, etc.
- Count occurrences by any attribute or tag
- Create metrics from log field values

**Sorting**:
- Sort logs by any attribute or tag value
- Order by timestamp, service, severity, etc.

### Query-based Filtering

You can also filter using query syntax:

```bash
# Filter by service (individual column)
service:web-app

# Filter by environment (individual column)  
env:production

# Filter by user ID (individual column)
user_id:12345

# Filter by version (individual column)
version:1.2.3

# Filter by parsed message fields (if message parsing enabled)
service:web-app parsed_action:login parsed_result:success

# Complex filtering across multiple columns
service:web-app env:production user_id:12345 parsed_error.code:TIMEOUT
```

### Dashboard Integration

Use individual columns for:
- **Variables**: Create dropdowns from service, env, version columns
- **Panels**: Group and aggregate by any attribute or tag
- **Alerts**: Set conditions based on specific field values
- **Transformations**: Use field values for calculations and grouping

### Combining Original and Parsed Fields

```bash
# Mix original log fields with parsed JSON fields
service:web-app status:ERROR parsed_error.code:DATABASE_CONNECTION

# Use both message content and parsed metadata
"connection timeout" parsed_database.host:prod-db-01

# Filter by original timestamp and parsed session data
@timestamp:>now-1h parsed_session.duration:>3600
```

## ⚡ Performance Considerations

### Optimization Guidelines

1. **Automatic Parsing is Optimized**
   - Attributes and tags parsing is always enabled and optimized
   - No performance impact from automatic parsing
   - These fields are already structured from Datadog

2. **Message Parsing Considerations**
   - Only enable message parsing when log messages contain JSON
   - Message parsing adds minimal overhead for valid JSON
   - Disable message parsing for plain text logs

3. **Monitor Query Performance**
   - Large JSON objects may increase query response time
   - Deep nesting levels can impact parsing performance
   - Consider time range limits for heavy JSON parsing queries

### Built-in Safeguards

The JSON parser includes automatic performance protections:

- **Size Limits**: Objects exceeding size limits are skipped with preserved original data
- **Depth Limits**: Deeply nested structures are limited to prevent stack overflow
- **Timeout Protection**: Parsing operations timeout to prevent query blocking
- **Memory Management**: Efficient parsing prevents memory exhaustion

### Performance Tips

```bash
# Good: Specific field parsing
# Enable JSON parsing for "message" field only
service:web-app status:ERROR

# Better: Combined with specific filters
# Parse JSON and filter immediately
service:web-app parsed_error.code:DATABASE_ERROR

# Best: Targeted queries with time limits
# Limit scope for better performance
service:web-app parsed_error.code:DATABASE_ERROR @timestamp:>now-1h
```

## 🚨 Error Handling and Troubleshooting

### Common Issues and Solutions

#### 1. No Parsed Fields Appearing

**Symptoms**: Expected structured fields don't appear in logs panel

**Automatic Fields (Should Always Appear)**:
- Attributes and tags from Datadog are always parsed automatically
- Look for fields like `service`, `env`, `host`, `source`, etc.
- These come from Datadog's structured log data

**Message Parsing Issues**:
- Message field doesn't contain valid JSON
- JSON syntax errors in message content
- Message parsing not enabled

**Solutions**:
```bash
# Check automatic fields first
# These should always be present from Datadog
service:web-app env:production

# For message parsing, verify JSON content
# Copy message to JSON validator to check syntax

# Enable message parsing if needed
# Use "Parse Message as JSON" toggle
```

#### 2. Partial Field Parsing

**Symptoms**: Some JSON fields parse correctly, others don't

**Possible Causes**:
- Mixed valid/invalid JSON in logs
- Size or depth limits reached
- Special characters in field names

**Solutions**:
- Check original JSON structure for validity
- Look for parsing error messages in browser console
- Verify JSON doesn't exceed size/depth limits

#### 3. Performance Issues

**Symptoms**: Queries with JSON parsing are slow

**Possible Causes**:
- Large JSON objects in logs
- Deep nesting levels
- Parsing entire log instead of specific field

**Solutions**:
```bash
# Reduce time range
@timestamp:>now-1h

# Use specific field instead of whole_log
# Change from "whole_log" to "message"

# Add more specific filters
service:web-app status:ERROR parsed_user_id:12345
```

#### 4. Field Name Conflicts

**Symptoms**: Expected parsed fields are missing or incorrect

**Possible Causes**:
- Parsed field names conflict with existing log fields
- Field names contain special characters

**Solutions**:
- Look for `parsed_` prefixed versions of fields
- Check for dots in field names (nested structure)
- Verify original field is preserved alongside parsed version

### Error Messages

Common error scenarios and their handling:

| Error Type | Behavior | User Impact |
|------------|----------|-------------|
| Invalid JSON Syntax | Preserve original field, log warning | Original data remains accessible |
| Size Limit Exceeded | Skip parsing, preserve original | Large objects remain as strings |
| Depth Limit Reached | Parse to limit, preserve rest | Partial parsing with original backup |
| Parsing Timeout | Abort parsing, preserve original | No parsed fields, original data intact |
| Field Not Found | No parsing attempted | No impact, normal log processing |

### Debugging Tips

1. **Check Browser Console**
   ```bash
   # Look for JSON parsing warnings/errors
   # Open browser developer tools → Console tab
   ```

2. **Verify JSON Structure**
   ```bash
   # Test JSON validity in external tool
   # Copy log content to JSON validator
   ```

3. **Compare Original vs Parsed**
   ```bash
   # Look for both original and parsed_ fields
   # Verify data consistency between versions
   ```

4. **Test with Simple JSON**
   ```bash
   # Start with basic JSON structure
   # Gradually increase complexity
   ```

## 📈 Dashboard Integration

### Using Parsed Fields in Dashboards

1. **Create Variables from Parsed Fields**
   ```bash
   # Variable query for parsed user IDs
   # Use parsed_user_id values for dropdown
   
   # Variable query for parsed error codes
   # Use parsed_error.code values for selection
   ```

2. **Build Panels with Parsed Data**
   ```bash
   # Error rate by parsed service
   service:$service parsed_error.code:*
   
   # Performance metrics from parsed data
   service:$service parsed_response.duration_ms:>$threshold
   
   # User activity analysis
   service:$service parsed_user.role:$role parsed_action:$action
   ```

3. **Combine with Grafana Transformations**
   - Use parsed fields for grouping and aggregation
   - Create calculated fields from parsed numeric data
   - Build time series from parsed timestamp fields

### Dashboard Examples

#### Application Health Dashboard
```bash
# Error panel
service:web-app status:ERROR parsed_error.code:*

# Performance panel  
service:web-app parsed_response.duration_ms:>1000

# User activity panel
service:web-app parsed_user.action:login parsed_result:success
```

#### Infrastructure Monitoring Dashboard
```bash
# Database performance
service:database parsed_execution_time_ms:>500

# API gateway health
service:gateway parsed_response.status:>=400

# Service dependencies
service:* parsed_downstream.service:$service parsed_downstream.status:error
```

## 🔗 Integration with Other Features

### Autocomplete Support

Parsed fields are automatically available in query autocomplete:

- Type `parsed_` to see all available parsed fields
- Autocomplete suggests field names based on recent parsing results
- Nested field paths are suggested with dot notation

### Variable Support

Use parsed fields in dashboard variables:

```bash
# Service variable from parsed data
parsed_service:*

# User role variable
parsed_user.role:*

# Error code variable
parsed_error.code:*
```

### Alerting Integration

Create alerts based on parsed field values:

```bash
# Alert on specific error codes
service:web-app parsed_error.code:CRITICAL_ERROR

# Alert on performance thresholds
service:api parsed_response.duration_ms:>5000

# Alert on user activity patterns
service:auth parsed_user.failed_attempts:>5
```

## 📚 Best Practices

### When to Use JSON Parsing

✅ **Good Use Cases**:
- Structured application logs with consistent JSON format
- API request/response logging with nested data
- Performance metrics embedded in log messages
- User activity tracking with detailed metadata
- Error logs with structured error information

❌ **Avoid When**:
- Logs are already in plain text format
- JSON structure varies significantly between entries
- Performance is critical and structured access isn't needed
- Working with simple key-value pairs (use facets instead)

### Configuration Best Practices

1. **Start Simple**
   ```bash
   # Begin with message field parsing
   # Expand to other fields as needed
   ```

2. **Test with Small Datasets**
   ```bash
   # Verify parsing works correctly
   # Check performance impact
   ```

3. **Document Field Meanings**
   ```bash
   # Keep track of what parsed fields represent
   # Share field documentation with team
   ```

4. **Monitor Performance Impact**
   ```bash
   # Compare query times with/without JSON parsing
   # Adjust time ranges if needed
   ```

### Query Optimization

1. **Combine Filters Effectively**
   ```bash
   # Use original fields for broad filtering
   service:web-app status:ERROR
   
   # Use parsed fields for specific filtering
   service:web-app parsed_error.code:DATABASE_ERROR
   ```

2. **Leverage Field Hierarchy**
   ```bash
   # Filter by top-level parsed fields first
   parsed_service:web-app parsed_user.role:admin
   
   # Then add nested field filters
   parsed_service:web-app parsed_user.profile.department:engineering
   ```

## 🆘 Getting Help

### Documentation Resources

- **[Logs Query Syntax](query-syntax.md)** - Complete query syntax reference
- **[Logs Getting Started](getting-started.md)** - Basic logs usage guide
- **[Performance Guide](../advanced/performance.md)** - Query optimization tips
- **[Troubleshooting](../advanced/troubleshooting.md)** - Common issues and solutions

### Community Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **GitHub Discussions**: [Ask questions and share tips](https://github.com/wasilak/grafana-datadog-datasource/discussions)
- **Grafana Community**: [General Grafana support](https://community.grafana.com/)

### Example Queries

For more JSON parsing examples, see:
- **[Logs Query Examples](../examples/logs-queries.md)** - Real-world query patterns
- **[Dashboard Examples](../examples/logs-dashboards.md)** - Complete dashboard configurations

---

**💡 Pro Tip**: Start with simple JSON structures and gradually increase complexity as you become familiar with the parsing behavior and performance characteristics.