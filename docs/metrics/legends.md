# Legend Configuration

Customize how your time series are named and displayed with powerful legend templating and automatic formatting options.

## 🏷️ Overview

Legend configuration controls:
- **Series naming** - How each time series is labeled
- **Template variables** - Dynamic labels using tag values
- **Auto formatting** - Intelligent default naming
- **Custom templates** - Full control over series names

## 🎯 Legend Modes

### Auto Mode (Default)

**Format**: `metric_name {tag1:value1, tag2:value2}`

**Example Query**: `avg:system.cpu.user{*} by {host}`
**Auto Legend**: `avg:system.cpu.user{host:web-01} by {host} {host:web-01}`

**Benefits**:
- Shows complete context
- Includes metric name and all tags
- No configuration required
- Consistent across all queries

**When to Use**:
- Exploring new metrics
- Debugging queries
- When you want full context
- Default dashboards

### Custom Mode

**Format**: User-defined template with variables

**Example Query**: `avg:system.cpu.user{*} by {host}`
**Custom Template**: `CPU: {{host}}`
**Result**: `CPU: web-01`

**Benefits**:
- Clean, readable names
- Focus on important information
- Consistent branding
- Space-efficient

**When to Use**:
- Production dashboards
- Executive summaries
- Space-constrained panels
- Branded reports

## 🔧 Template Variables

### Basic Variables

Use `{{tag_name}}` to insert tag values:

```bash
# Query: avg:system.cpu.user{*} by {host}
# Available variables: {{host}}

# Templates:
{{host}}                    # Result: "web-01"
CPU: {{host}}              # Result: "CPU: web-01"
{{host}} CPU Usage         # Result: "web-01 CPU Usage"
```

### Multiple Variables

```bash
# Query: avg:container.cpu.usage{*} by {service,host}
# Available variables: {{service}}, {{host}}

# Templates:
{{service}} on {{host}}                    # "web on server-01"
{{service}}: {{host}}                      # "web: server-01"
[{{service}}] {{host}}                     # "[web] server-01"
{{service}} ({{host}})                     # "web (server-01)"
```

### Advanced Templates

**Conditional Text**:
```bash
# Show environment only if not production
{{service}}{{#env}}{{^prod}} ({{env}}){{/prod}}{{/env}}

# Result: "web" for prod, "web (staging)" for staging
```

**Static Text with Variables**:
```bash
# Infrastructure monitoring
CPU Usage: {{host}} ({{availability_zone}})
Memory: {{host}} - {{container_name}}
Network: {{interface}} on {{host}}

# Application monitoring  
{{service}} Response Time ({{method}} {{endpoint}})
Error Rate: {{service}} {{version}}
Throughput: {{service}} [{{datacenter}}]
```

## 📊 Real-World Examples

### System Monitoring

**CPU Usage Dashboard**:
```bash
# Query: avg:system.cpu.user{*} by {host,env}
# Template: "{{host}} ({{env}})"
# Result: "web-01 (production)"
```

**Memory Usage**:
```bash
# Query: avg:system.mem.pct_usable{*} by {host}
# Template: "Memory: {{host}}"
# Result: "Memory: web-01"
```

**Disk Usage**:
```bash
# Query: avg:system.disk.used{*} by {host,device}
# Template: "{{device}} on {{host}}"
# Result: "/dev/sda1 on web-01"
```

### Container Monitoring

**Container CPU**:
```bash
# Query: avg:container.cpu.usage{*} by {container_name,pod_name}
# Template: "{{container_name}} ({{pod_name}})"
# Result: "nginx (web-pod-123)"
```

**Kubernetes Pods**:
```bash
# Query: avg:kubernetes.memory.usage{*} by {pod_name,namespace}
# Template: "{{namespace}}/{{pod_name}}"
# Result: "production/web-deployment-abc123"
```

### Application Monitoring

**Request Rate**:
```bash
# Query: sum:trace.web.request.hits{*} by {service,env}
# Template: "{{service}} Requests ({{env}})"
# Result: "api Requests (production)"
```

**Response Time**:
```bash
# Query: avg:trace.web.request.duration{*} by {service,endpoint}
# Template: "{{service}}: {{endpoint}}"
# Result: "api: /users/profile"
```

**Error Rate**:
```bash
# Query: sum:trace.web.request.errors{*} by {service,status_code}
# Template: "{{service}} {{status_code}} Errors"
# Result: "api 500 Errors"
```

### Business Metrics

**Sales by Region**:
```bash
# Query: sum:sales.revenue{*} by {region,product}
# Template: "{{product}} Sales - {{region}}"
# Result: "Premium Sales - US-West"
```

**User Activity**:
```bash
# Query: count:user.sessions{*} by {platform,country}
# Template: "{{platform}} Users ({{country}})"
# Result: "Mobile Users (US)"
```

## 🎨 Legend Styling Tips

### Readability

**Use Clear Separators**:
```bash
# Good separators
{{service}} - {{host}}        # Dash
{{service}} | {{host}}        # Pipe
{{service}} :: {{host}}       # Double colon
{{service}} → {{host}}        # Arrow
```

**Consistent Formatting**:
```bash
# Consistent case and spacing
{{service}} on {{host}}       # All lowercase connectors
{{service}} On {{host}}       # Title case connectors
{{service}}_{{host}}          # Underscore separator
```

### Information Hierarchy

**Most Important First**:
```bash
# Service-focused
{{service}}: {{host}} ({{env}})

# Host-focused  
{{host}}: {{service}} [{{env}}]

# Environment-focused
[{{env}}] {{service}} on {{host}}
```

**Progressive Detail**:
```bash
# Basic: Just the key identifier
{{host}}

# Detailed: Add context
{{host}} ({{service}})

# Full context: All available info
{{service}} on {{host}} in {{env}}
```

### Space Efficiency

**Short Templates for Small Panels**:
```bash
# Very compact
{{host}}

# Compact with context
{{service}}/{{host}}

# Abbreviated
{{service}} ({{host}})
```

**Longer Templates for Large Panels**:
```bash
# Full descriptive names
{{service}} Response Time on {{host}} in {{datacenter}}

# Business context
{{product}} Revenue from {{region}} via {{channel}}
```

## 🔧 Configuration UI

### Setting Legend Mode

1. **In Query Editor**:
   - Find "Legend" section
   - Select mode: "Auto" or "Custom"
   - Enter template if using Custom mode

2. **Auto Mode**:
   - No additional configuration needed
   - Uses intelligent default formatting
   - Shows metric name + all tags

3. **Custom Mode**:
   - Enter template in "Template" field
   - Use `{{tag_name}}` for variables
   - Preview shows example result

### Template Validation

**Valid Templates** ✅:
```bash
{{host}}                      # Simple variable
CPU: {{host}}                # With static text
{{service}} on {{host}}      # Multiple variables
```

**Invalid Templates** ❌:
```bash
{host}                       # Missing double braces
{{nonexistent_tag}}         # Tag not in query grouping
{{host                      # Unclosed braces
```

## 🔍 Troubleshooting

### Common Issues

**Template Variables Not Working**:
- **Cause**: Tag not included in query's `by {tags}` clause
- **Solution**: Add tag to grouping: `by {host,service}`

**Empty Legend Names**:
- **Cause**: Tag values are null or empty
- **Solution**: Add fallback text or use different tags

**Legend Too Long**:
- **Cause**: Template includes too much information
- **Solution**: Shorten template or use abbreviations

**Inconsistent Naming**:
- **Cause**: Different queries use different templates
- **Solution**: Standardize templates across related queries

### Debugging Templates

**Test with Known Data**:
1. Use simple query with known tag values
2. Test template with expected results
3. Gradually add complexity

**Check Available Variables**:
1. Look at query's `by {tags}` clause
2. Only those tags are available as variables
3. Verify tag names match exactly (case-sensitive)

**Preview Results**:
1. Use query editor preview
2. Check legend shows expected format
3. Test with different tag values

## 📈 Best Practices

### Template Design

1. **Keep it concise** - Long legends clutter visualizations
2. **Use consistent patterns** - Same format across related panels
3. **Include essential context** - Service, host, environment
4. **Avoid redundant information** - Don't repeat panel title
5. **Consider your audience** - Technical vs business users

### Performance Considerations

1. **Legend complexity doesn't affect query performance**
2. **More variables = more detailed legends**
3. **Auto mode includes all available context**
4. **Custom mode can be more efficient for display**

### Maintenance

1. **Document template patterns** - Maintain consistency
2. **Update when tags change** - Adapt to new tag structures
3. **Test with new data** - Verify templates work with new services
4. **Review periodically** - Ensure legends remain useful

## 🔗 Integration with Other Features

### Variables

Use dashboard variables in legends:

```bash
# Query uses variable: avg:system.cpu.user{service:$service} by {host}
# Template can reference: "{{host}} ($service CPU)"
# Note: $service is dashboard variable, {{host}} is query tag
```

### Formulas

Legends work with formula results:

```bash
# Formula: $A * 100 / $B
# Base queries have their own legends
# Formula inherits from Query A by default
# Can override with custom template
```

### Alerts

Legend templates affect alert notifications:

```bash
# Template: "{{service}} on {{host}}"
# Alert shows: "High CPU: api on web-01"
# Clear, actionable alert context
```

## 🔗 Related Documentation

- [Query Editor](query-editor.md) - Building queries with grouping
- [Variables](variables.md) - Dashboard-level variables
- [Examples](../examples/queries.md) - More legend examples
- [Troubleshooting](../advanced/troubleshooting.md) - Solving legend issues