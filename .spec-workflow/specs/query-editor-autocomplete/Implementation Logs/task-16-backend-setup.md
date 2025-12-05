# Task 16: Initialize Go Backend Plugin Structure - COMPLETED

## Completion Date
2025-12-05

## What Was Completed

### 1. Go Module Dependencies ✓
- **File**: `go.mod`
- **Change**: Added `github.com/DataDog/datadog-api-client-go/v2 v2.30.0`
- **Verification**: `go mod tidy` succeeded without conflicts
- **Status**: Ready for Datadog API integration

### 2. Plugin Entry Point ✓
- **File**: `pkg/main.go`
- **Status**: Already existed with correct structure
- **Implementation**: Uses `datasource.Manage()` with `plugin.NewDatasource` factory
- **Verified**: No changes needed

### 3. Main Plugin Struct ✓
- **File**: `pkg/plugin/datasource.go`
- **Implements**:
  - `backend.QueryDataHandler` - for query execution
  - `backend.CallResourceHandler` - for autocomplete endpoints
  - `backend.CheckHealthHandler` - for connection validation
  - `instancemgmt.Instance` - for instance lifecycle

**Key Components**:
- `Datasource` struct with InstanceSettings, JSONData, SecureJSONData, cache
- `AutocompleteCache` with TTL support (sync.Mutex for thread safety)
- `NewDatasource()` factory that parses settings and secure data
- Cache helper methods: `GetCachedEntry()`, `SetCachedEntry()`, `CleanExpiredCache()`

**CallResource Handler Structure**:
- Router for GET /autocomplete/metrics and GET /autocomplete/tags/{metric}
- `MetricsHandler()` with 30-second caching
- `TagsHandler()` with per-metric caching
- Both handlers validate credentials and enforce 2-second timeout
- Placeholder for actual Datadog API calls (Task 17-18)

### 4. Build System ✓
- **File**: `Magefile.go`
- **Status**: Already existed with correct targets
- **Build Output**: `dist/gpx_wasilak_datadog_datasource_darwin_arm64` (24MB)
- **Targets Available**:
  - `mage build:backend` - builds for current OS
  - `mage build:backendLinux` - cross-compile for Linux
  - `mage build:backendDarwin` - cross-compile for macOS
  - `mage build:backendWindows` - cross-compile for Windows

### 5. Plugin Configuration ✓
- **File**: `src/plugin.json`
- **Changes**:
  - Added `"backend": true`
  - Added `"executable": "gpx_wasilak_datadog_datasource_darwin_arm64"`
  - Removed `routes` section (no longer needed with backend)
  - Updated `grafanaDependency` from ">=7.0.0" to ">=12.3.0"
- **Validation**: Verified JSON validity with `jq`

## Success Criteria Met

- ✅ `go mod tidy` succeeds without conflicts
- ✅ `mage build:backend` creates binary successfully
- ✅ Binary size 24MB (< 50MB requirement)
- ✅ All imports resolve correctly
- ✅ plugin.json validates as JSON
- ✅ Backend infrastructure ready for handlers

## Files Changed

| File | Type | Changes |
|------|------|---------|
| `go.mod` | Modified | Added Datadog API client dependency |
| `src/plugin.json` | Modified | Enabled backend, added executable, removed routes |
| `pkg/plugin/datasource.go` | Modified | Completed CallResource with routing logic |

## Lines Changed
- Added: ~130 lines (CallResource routing and handlers)
- Total Go backend: ~280 lines ready for Datadog API integration

## Architecture Established

```
Frontend (QueryEditor)
    ↓
useQueryAutocomplete Hook
    ↓
getBackendSrv().fetch()
    ↓
Grafana Backend Proxy
    ↓
Go Plugin (pkg/plugin/datasource.go)
  ├─ CallResource Router
  ├─ MetricsHandler (GET /autocomplete/metrics)
  ├─ TagsHandler (GET /autocomplete/tags/{metric})
  └─ AutocompleteCache (30-second TTL)
    ↓
[Task 17-18: Datadog API Integration Here]
```

## Next Steps

**Task 17**: Implement actual Datadog API calls in QueryData handler
- Use `datadog-api-client-go/v2` MetricsApi
- Parse query text and fetch metrics
- Return proper DataFrames

**Task 18**: Implement Datadog API calls in CallResource handlers
- Use MetricsApi.ListMetrics() in MetricsHandler
- Use TagsApi in TagsHandler
- Handle timeouts and auth errors

**Task 19**: Update frontend to call backend endpoints
- Replace direct API calls with getBackendSrv().fetch()
- Pass datasourceUid to backend

**Task 20**: Already completed as part of this task
- plugin.json configured for backend execution

## Testing

Build verification:
```bash
cd /Users/piotrek/git/grafana-datadog-datasource
mage build:backend
# Output: Building Go backend for darwin/arm64 -> dist/gpx_wasilak_datadog_datasource_darwin_arm64
ls -lh dist/gpx_wasilak_datadog_datasource_darwin_arm64
# -rwxr-xr-x  24M  2025-12-05 13:16  gpx_wasilak_datadog_datasource_darwin_arm64
```

## Architecture Ready

The backend infrastructure is now in place and ready for:
1. Real Datadog API integration (Tasks 17-18)
2. Frontend connection (Task 19)
3. End-to-end testing

All components compile successfully and the build system is configured for multi-platform support.
