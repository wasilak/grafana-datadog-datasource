# Migration Guide

This guide helps you migrate from older versions of the plugin or from other Datadog integrations.

## 🔄 Upgrading from Previous Versions

### From v0.3.x to v0.4.x

**Major Changes**:
- ✨ Added formula support (`$A * 100 / $B`)
- ✨ Enhanced autocomplete with context awareness
- ✨ Improved legend configuration
- ✨ Added interval override option
- 🔧 Backend API changes for better performance

**Breaking Changes**: None - fully backward compatible

**Migration Steps**:
1. [Install the new version](installation.md)
2. Existing queries continue to work unchanged
3. New features available immediately

**New Features to Explore**:
- **Formulas**: Create mathematical expressions across queries
- **Enhanced Legends**: Better auto-formatting and custom templates
- **Interval Override**: Control query resolution
- **Improved Autocomplete**: Context-aware suggestions

### From v0.2.x to v0.4.x

**Major Changes**:
- 🔄 Complete rewrite of query editor
- ✨ Added autocomplete functionality
- ✨ Added variable support
- 🔧 New backend architecture

**Breaking Changes**:
- Query syntax remains the same
- Datasource configuration unchanged
- All existing dashboards continue to work

**Migration Steps**:
1. [Install the new version](installation.md)
2. Test existing dashboards
3. Explore new autocomplete features
4. Consider using variables for dynamic dashboards

### From v0.1.x to v0.4.x

**Major Changes**:
- 🔄 Complete plugin rewrite
- ✨ Modern Grafana plugin architecture
- ✨ Advanced query editor with autocomplete
- ✨ Full variable support
- ✨ Formula support

**Breaking Changes**: None for basic queries

**Migration Steps**:
1. **Backup existing dashboards**:
   ```bash
   # Export dashboards before upgrading
   curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
        http://localhost:3000/api/dashboards/uid/$DASHBOARD_UID
   ```

2. **Install new version** following [installation guide](installation.md)

3. **Test all dashboards** to ensure they work correctly

4. **Update queries** to take advantage of new features

## 🔄 Migrating from Official Datadog Plugin

### Why Migrate?

| Feature | Official Plugin | This Plugin |
|---------|----------------|-------------|
| **Cost** | Grafana Enterprise Required | Free & Open Source |
| **Autocomplete** | Basic | Advanced context-aware |
| **Formulas** | Limited | Full mathematical expressions |
| **Variables** | Limited | Complete support |
| **Query Editor** | Basic | Modern with validation |
| **Community** | Enterprise support | Active open source |

### Migration Process

**Step 1: Install This Plugin**
1. Follow the [installation guide](installation.md)
2. Keep the official plugin installed during migration

**Step 2: Create New Datasource**
1. Go to **Connections** → **Data Sources**
2. Click **Add data source**
3. Select **Datadog** (this plugin)
4. Configure with same API credentials
5. Name it differently (e.g., "Datadog New")

**Step 3: Test Queries**
1. Create a test dashboard
2. Copy queries from existing dashboards
3. Verify they work with the new plugin
4. Test autocomplete and new features

**Step 4: Migrate Dashboards**

**Option A: Manual Migration**
1. Create new dashboard
2. Copy panels one by one
3. Update datasource to new one
4. Test each panel

**Option B: JSON Migration**
1. Export existing dashboard JSON
2. Find and replace datasource UID:
   ```json
   # Change from:
   "datasource": {"uid": "old-datadog-uid"}
   # To:
   "datasource": {"uid": "new-datadog-uid"}
   ```
3. Import modified JSON

**Step 5: Update Queries for New Features**

**Enhanced Legends**:
```bash
# Old: Basic series names
avg:system.cpu.user{*} by {host}

# New: Custom legends
avg:system.cpu.user{*} by {host}
# Legend: "CPU: {{host}}"
```

**Formulas**:
```bash
# Old: Single queries only
sum:container.memory.usage{service:web}

# New: Mathematical expressions
# Query A: sum:container.memory.usage{service:web}
# Query B: sum:container.memory.limit{service:web}
# Formula: $A * 100 / $B
```

**Variables**:
```bash
# Old: Static queries
avg:system.cpu.user{host:web-01}

# New: Dynamic with variables
avg:system.cpu.user{host:$host}
```

## 🔄 Migrating from Prometheus/PromQL

### Query Syntax Differences

| Concept | PromQL | Datadog |
|---------|--------|---------|
| **Metric** | `cpu_usage` | `avg:system.cpu.user` |
| **Labels** | `{host="web-01"}` | `{host:web-01}` |
| **Aggregation** | `avg(cpu_usage)` | `avg:cpu_usage{*}` |
| **Grouping** | `by (host)` | `by {host}` |
| **Time Range** | `[5m]` | `.rollup(avg, 300)` |

### Common Query Migrations

**CPU Usage**:
```bash
# PromQL
avg(cpu_usage{job="node"}) by (instance)

# Datadog
avg:system.cpu.user{*} by {host}
```

**Memory Usage**:
```bash
# PromQL
(1 - (node_memory_available / node_memory_total)) * 100

# Datadog
# Query A: avg:system.mem.total{*}
# Query B: avg:system.mem.usable{*}
# Formula: ($A - $B) * 100 / $A
```

**Request Rate**:
```bash
# PromQL
rate(http_requests_total[5m])

# Datadog
sum:trace.web.request.hits{*}.rollup(sum, 300)
```

### Migration Strategy

1. **Identify key metrics** in your Prometheus setup
2. **Find equivalent Datadog metrics** using autocomplete
3. **Recreate queries** using Datadog syntax
4. **Use formulas** for complex calculations
5. **Test thoroughly** before switching over

## 🔄 Migrating Variables

### From Prometheus Variables

**Prometheus**:
```bash
# Variable query
label_values(cpu_usage, instance)

# Usage in query
avg(cpu_usage{instance="$instance"})
```

**Datadog**:
```bash
# Variable query
tag_values(system.cpu.user, host)

# Usage in query
avg:system.cpu.user{host:$host}
```

### Variable Types Migration

| Prometheus | Datadog | Example |
|------------|---------|---------|
| `label_values(metric, label)` | `tag_values(metric, tag)` | `tag_values(system.cpu.user, host)` |
| `query_result(query)` | Use formula queries | Complex aggregations |
| `label_values(label)` | `tag_values(*, tag)` | `tag_values(*, env)` |

## 🔄 Dashboard Migration Checklist

### Pre-Migration
- [ ] **Backup all dashboards** (export JSON)
- [ ] **Document current queries** and their purposes
- [ ] **Test new plugin** with sample queries
- [ ] **Plan migration timeline** (gradual vs all-at-once)

### During Migration
- [ ] **Install new plugin** alongside existing one
- [ ] **Create new datasource** with same credentials
- [ ] **Migrate one dashboard at a time**
- [ ] **Test each panel** thoroughly
- [ ] **Update variables** to use new syntax
- [ ] **Enhance with new features** (formulas, legends)

### Post-Migration
- [ ] **Verify all dashboards** work correctly
- [ ] **Update documentation** with new query syntax
- [ ] **Train team members** on new features
- [ ] **Remove old datasource** when confident
- [ ] **Clean up unused dashboards**

## 🚨 Common Migration Issues

### Query Syntax Errors

**Issue**: Queries don't work after migration
**Solution**: 
1. Check metric names with autocomplete
2. Verify tag syntax (`:` not `=`)
3. Ensure aggregation functions are correct

### Variable Not Working

**Issue**: Dashboard variables show no data
**Solution**:
1. Update variable queries to Datadog syntax
2. Check tag names match your metrics
3. Verify datasource is correctly selected

### Performance Differences

**Issue**: Queries slower than before
**Solution**:
1. Add more specific tag filters
2. Reduce time ranges for testing
3. Use appropriate aggregation functions
4. Check Datadog API rate limits

### Missing Data

**Issue**: Some metrics not showing data
**Solution**:
1. Verify metrics exist in Datadog
2. Check time range covers data period
3. Ensure tag filters aren't too restrictive
4. Test queries in Datadog UI first

## 📚 Migration Resources

### Documentation
- [Query Examples](examples/queries.md) - Common query patterns
- [Variables Guide](features/variables.md) - Variable configuration
- [Performance Guide](advanced/performance.md) - Optimization tips

### Tools
- **Datadog Query Builder**: Test queries in Datadog UI first
- **Grafana Export/Import**: Backup and restore dashboards
- **JSON Editors**: Modify dashboard JSON for bulk changes

### Support
- **GitHub Issues**: Report migration problems
- **GitHub Discussions**: Ask migration questions
- **Documentation**: Comprehensive guides for all features

## ✅ Migration Success

After successful migration, you should have:
- ✅ All dashboards working with new plugin
- ✅ Enhanced queries using new features
- ✅ Improved performance with better caching
- ✅ Access to advanced autocomplete
- ✅ Ability to use formulas and expressions
- ✅ Better legend formatting options

**Next Steps**: [Explore advanced features](features/) to get the most out of your new setup!