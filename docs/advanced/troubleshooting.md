# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Datadog datasource plugin.

## Quick Diagnostics

### Health Check

First, verify your datasource is working:

1. Go to **Connections** → **Data Sources**
2. Find your Datadog datasource
3. Click **Save & Test**
4. Look for: ✅ "Connected to Datadog"

### Browser Console

Check for JavaScript errors:

1. Open browser developer tools (F12)
2. Go to **Console** tab
3. Look for red error messages
4. Note any 401, 403, or 500 HTTP errors

### Network Tab

Check API requests:

1. Open browser developer tools (F12)
2. Go to **Network** tab
3. Try a query
4. Look for failed requests to `/api/datasources/uid/.../resources/`

## Authentication Issues

### Invalid API Credentials

**Symptoms**:
- "Invalid credentials" error
- 401 Unauthorized responses
- Health check fails

**Solutions**:
1. **Verify API Key and App Key**:
   - Go to [Datadog API Keys](https://app.datadoghq.com/organization/settings/api_keys)
   - Copy fresh API Key and App Key
   - Update datasource configuration

2. **Check Datadog Site**:
   - US: `datadoghq.com`
   - EU: `datadoghq.eu`
   - Ensure it matches your Datadog account region

3. **Verify Key Permissions**:
   - API Key must be active
   - App Key must be active
   - For logs: API Key needs `logs_read_data` scope

### Logs Permission Issues

**Symptoms**:
- "API key missing required permissions" for logs
- Metrics work but logs don't
- 403 Forbidden for logs queries

**Solutions**:
1. **Enable Logs Scope**:
   - Go to [Datadog API Keys](https://app.datadoghq.com/organization/settings/api_keys)
   - Click on your API Key
   - Under "Scopes", check `logs_read_data`
   - Save changes

2. **Verify Logs Access**:
   - Test in Datadog Logs Explorer first
   - Ensure your account has logs data
   - Check if logs are in different indexes

## Query Issues

### No Data Returned

**Symptoms**:
- Empty graphs or tables
- "No data" message
- Query runs but shows nothing

**Solutions**:

#### For Metrics:
1. **Check Time Range**:
   - Ensure time range covers when data exists
   - Try "Last 24 hours" to see if any data appears
   - Check if metric is actively being sent

2. **Verify Metric Name**:
   - Use autocomplete to find correct metric names
   - Check spelling and format
   - Test in Datadog UI first

3. **Check Tag Filters**:
   - Remove all tag filters: `{*}`
   - Add filters one by one to identify issues
   - Verify tag names and values exist

4. **Test Basic Query**:
   ```bash
   # Start simple
   avg:system.cpu.user{*}
   
   # Add grouping
   avg:system.cpu.user{*} by {host}
   
   # Add filters
   avg:system.cpu.user{host:web-01} by {host}
   ```

#### For Logs:
1. **Check Time Range**:
   - Logs may not exist in selected period
   - Try broader time range
   - Check if logs are being actively sent

2. **Verify Query Syntax**:
   - Start with simple query: `*`
   - Add filters gradually: `service:web-app`
   - Use Datadog logs search syntax

3. **Check Log Indexes**:
   - Verify you have access to log indexes
   - Check if logs are in specific indexes
   - Test in Datadog Logs Explorer

4. **Test Basic Query**:
   ```bash
   # Start simple
   *
   
   # Add service filter
   service:web-app
   
   # Add status filter
   service:web-app AND status:ERROR
   ```

### Autocomplete Not Working

**Symptoms**:
- No suggestions appear
- Autocomplete dropdown empty
- Typing doesn't trigger suggestions

**Solutions**:

1. **Check Datasource Configuration**:
   - Verify datasource is saved and tested
   - Ensure API credentials are correct
   - Check datasource UID is valid

2. **Browser Issues**:
   - Refresh the page
   - Clear browser cache
   - Try incognito/private mode
   - Check browser console for errors

3. **Cursor Position**:
   - Ensure cursor is in correct position
   - Try typing after `{` for tag suggestions
   - Try typing metric names from beginning

4. **API Connectivity**:
   - Check network tab for failed requests
   - Look for 401/403 errors
   - Verify backend is responding

5. **Backend Issues**:
   - Check Grafana server logs
   - Verify plugin is loaded correctly
   - Restart Grafana if necessary

### Query Syntax Errors

**Symptoms**:
- "Invalid query syntax" errors
- Queries work in Datadog but not Grafana
- Unexpected query behavior

**Solutions**:

#### For Metrics:
1. **Use Datadog Query Language**:
   ```bash
   # Correct format
   avg:system.cpu.user{host:web-01} by {host}
   
   # Not PromQL or other formats
   ```

2. **Check Aggregation**:
   ```bash
   # Include aggregation function
   avg:system.cpu.user{*}
   
   # Not just metric name
   system.cpu.user
   ```

3. **Verify Tag Syntax**:
   ```bash
   # Correct tag filtering
   {host:web-01,env:prod}
   
   # Not
   {host=web-01,env=prod}
   ```

#### For Logs:
1. **Use Datadog Logs Syntax**:
   ```bash
   # Correct logs syntax
   service:web-app AND status:ERROR
   
   # Not SQL or other formats
   ```

2. **Check Facet Names**:
   ```bash
   # Use correct facet names
   service:web-app
   @env:production
   
   # Check available facets in Datadog
   ```

## Performance Issues

### Slow Queries

**Symptoms**:
- Queries take long time to load
- Timeouts
- Browser becomes unresponsive

**Solutions**:

1. **Optimize Time Range**:
   - Use shorter time ranges
   - Avoid queries over months/years
   - Use appropriate resolution

2. **Add Specific Filters**:
   ```bash
   # More specific (faster)
   avg:system.cpu.user{host:web-01} by {host}
   
   # Less specific (slower)
   avg:system.cpu.user{*} by {host}
   ```

3. **Reduce Grouping**:
   ```bash
   # Fewer groups (faster)
   avg:system.cpu.user{*} by {host}
   
   # Many groups (slower)
   avg:system.cpu.user{*} by {host,service,env}
   ```

4. **Check Datadog Limits**:
   - Verify you're not hitting API rate limits
   - Check Datadog account quotas
   - Monitor API usage in Datadog

### Dashboard Loading Issues

**Symptoms**:
- Dashboard panels don't load
- Some panels work, others don't
- Intermittent loading failures

**Solutions**:

1. **Reduce Panel Count**:
   - Limit to 10-15 panels per dashboard
   - Split large dashboards
   - Use variables to reduce duplicate queries

2. **Optimize Refresh Intervals**:
   - Don't auto-refresh too frequently
   - Use appropriate intervals (30s, 1m, 5m)
   - Disable auto-refresh for investigation dashboards

3. **Check Query Complexity**:
   - Simplify complex formulas
   - Reduce time ranges
   - Add more specific filters

## Network and Connectivity

### Connection Timeouts

**Symptoms**:
- "Request timeout" errors
- Intermittent connection failures
- Slow response times

**Solutions**:

1. **Check Network Connectivity**:
   - Verify internet connection
   - Test access to `api.datadoghq.com` or `api.datadoghq.eu`
   - Check firewall rules

2. **Proxy Configuration**:
   - If using proxy, ensure it's configured correctly
   - Check proxy authentication
   - Verify proxy allows HTTPS traffic

3. **DNS Issues**:
   - Verify DNS resolution for Datadog APIs
   - Try different DNS servers
   - Check for DNS filtering

### SSL/TLS Errors

**Symptoms**:
- "SSL certificate" errors
- "TLS handshake" failures
- Connection refused errors

**Solutions**:

1. **Certificate Issues**:
   - Update system certificates
   - Check corporate firewall/proxy
   - Verify system time is correct

2. **TLS Version**:
   - Ensure TLS 1.2+ is supported
   - Update system/browser if necessary
   - Check security policies

## Plugin Issues

### Plugin Not Loading

**Symptoms**:
- Datadog datasource not available
- Plugin appears disabled
- "Plugin not found" errors

**Solutions**:

1. **Verify Installation**:
   - Check plugin is in correct directory
   - Verify plugin files are present
   - Check file permissions

2. **Check Plugin Configuration**:
   - Ensure plugin is enabled in Grafana config
   - Check for unsigned plugin warnings
   - Verify plugin version compatibility

3. **Grafana Logs**:
   - Check Grafana server logs for errors
   - Look for plugin loading messages
   - Check for dependency issues

### Plugin Updates

**Symptoms**:
- Features not working after update
- New version not loading
- Configuration issues after upgrade

**Solutions**:

1. **Clear Cache**:
   - Restart Grafana server
   - Clear browser cache
   - Refresh datasource configuration

2. **Check Breaking Changes**:
   - Review [CHANGELOG.md](../../CHANGELOG.md)
   - Check for configuration changes
   - Update queries if syntax changed

3. **Rollback if Necessary**:
   - Keep backup of working version
   - Document configuration before updates
   - Test in staging environment first

## JSON Parsing Issues

### No Parsed Fields Appearing

**Symptoms**:
- JSON parsing is enabled but no `parsed_*` fields appear
- Original field shows JSON string but no structured data

**Solutions**:
1. **Verify Field Selection**:
   - Check selected field contains valid JSON
   - Try different field options (`message`, `data`, `attributes`)
   - Inspect raw log data to confirm JSON location

2. **Check JSON Validity**:
   - Copy JSON content to online validator
   - Look for syntax errors (missing quotes, brackets)
   - Check for escaped JSON strings

3. **Browser Console Errors**:
   - Open developer tools → Console
   - Look for JSON parsing error messages
   - Check for size/depth limit warnings

### Partial Field Parsing

**Symptoms**:
- Some JSON fields parse correctly, others don't
- Inconsistent parsing across log entries

**Solutions**:
1. **Mixed JSON Validity**:
   - Some logs have valid JSON, others don't
   - Check for different JSON structures
   - Verify field consistency across logs

2. **Size/Depth Limits**:
   - Large JSON objects may be truncated
   - Deep nesting may hit depth limits
   - Check browser console for limit warnings

### Performance Issues with JSON Parsing

**Symptoms**:
- Queries with JSON parsing are slow
- Browser becomes unresponsive
- Timeout errors

**Solutions**:
1. **Reduce Query Scope**:
   ```bash
   # Add time range limits
   service:web-app @timestamp:>now-1h
   
   # Use specific filters
   service:web-app status:ERROR parsed_user_id:123
   ```

2. **Optimize Field Selection**:
   - Use `message` instead of `whole_log` when possible
   - Parse specific fields rather than entire log
   - Disable JSON parsing for exploratory queries

3. **Check JSON Size**:
   - Large JSON objects impact performance
   - Consider log structure optimization
   - Use more specific queries to reduce data volume

### Field Name Conflicts

**Symptoms**:
- Expected parsed fields are missing
- Parsed fields have unexpected names

**Solutions**:
1. **Look for Prefixed Fields**:
   - Check for `parsed_` prefixed versions
   - Original fields are preserved alongside parsed ones
   - Use field name with prefix in queries

2. **Nested Field Names**:
   - Nested objects use dot notation: `parsed_user.name`
   - Arrays are serialized as JSON strings
   - Check field structure in logs panel

### JSON Parsing Configuration Issues

**Symptoms**:
- Configuration doesn't save
- Settings reset after page reload
- Parsing doesn't activate

**Solutions**:
1. **Query Model Persistence**:
   - Save query after enabling JSON parsing
   - Check query JSON includes `jsonParsing` configuration
   - Verify field selection is saved

2. **Browser Cache**:
   - Clear browser cache and reload
   - Try incognito/private browsing mode
   - Check for browser extension conflicts

## Getting Help

### Collect Information

Before reporting issues, collect:

1. **Environment Details**:
   - Grafana version
   - Plugin version
   - Browser and version
   - Operating system

2. **Error Details**:
   - Exact error messages
   - Browser console errors
   - Network request failures
   - Grafana server logs

3. **Query Details**:
   - Exact query that fails
   - Expected vs actual behavior
   - Time range and settings
   - Datasource configuration (without credentials)

### Support Channels

1. **GitHub Issues**: [Report bugs and feature requests](https://github.com/wasilak/grafana-datadog-datasource/issues)
2. **Documentation**: Check other docs sections for specific topics
3. **Datadog Support**: For Datadog API issues
4. **Grafana Community**: For general Grafana questions

### Creating Good Bug Reports

Include:
- Clear description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment information
- Screenshots if helpful
- Sample queries (without sensitive data)

## Common Error Messages

### "Invalid credentials"
- Check API Key and App Key
- Verify Datadog site setting
- Ensure keys are active in Datadog

### "API key missing required permissions"
- For logs: Enable `logs_read_data` scope
- Check API key permissions in Datadog
- Verify account has access to requested data

### "Request timeout"
- Reduce query time range
- Add more specific filters
- Check network connectivity

### "No data"
- Verify time range covers data period
- Check metric/log names and filters
- Test query in Datadog UI first

### "Plugin not found"
- Verify plugin installation
- Check Grafana configuration
- Restart Grafana server

## Prevention Tips

1. **Regular Testing**:
   - Test datasource health regularly
   - Monitor query performance
   - Check for API limit usage

2. **Documentation**:
   - Document working queries
   - Keep configuration backups
   - Note any custom settings

3. **Monitoring**:
   - Set up alerts for dashboard failures
   - Monitor Grafana server health
   - Track API usage in Datadog

4. **Updates**:
   - Test updates in staging first
   - Read changelog before updating
   - Keep backups of working versions