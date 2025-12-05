# Backend Plugin Requirements for Query Editor Autocomplete

## Summary

The frontend autocomplete feature is now functionally complete (Tasks 1-8), but **cannot fetch real data without a Go backend plugin**. The Grafana architecture prevents frontend code from accessing secure credentials (API keys, App keys) or making direct calls to external APIs.

## Architecture Change

### Current (Frontend-only) ❌
```
QueryEditor → useQueryAutocomplete hook → Direct API calls
                                         ↓
                          ❌ Cannot access secureJsonData in frontend
                          ❌ Credentials exposed to browser
                          ❌ CORS issues with Datadog API
```

### Required (With Backend) ✓
```
QueryEditor → useQueryAutocomplete hook → getBackendSrv().fetch()
                                         ↓
                              Grafana Backend Proxy
                                    ↓
                            Go Plugin Resource Handler
                                    ↓
                          Datadog Official Go SDK
                                    ↓
                            Metrics & Tags Data
```

## Key Concepts

### Resource Handlers
Grafana allows plugins to define custom HTTP endpoints that the frontend can call. The backend handles:
- Receiving HTTP requests from the frontend via `/api/datasources/uid/{uid}/resources/{path}`
- Accessing secureJsonData (API keys) safely server-side
- Making calls to Datadog API
- Returning JSON responses

### Benefits
1. **Security**: Credentials never exposed to browser
2. **CORS**: No browser CORS restrictions (server-to-server communication)
3. **Caching**: Can cache at the backend layer efficiently
4. **Timeout Control**: Server-side timeout enforcement
5. **Auth**: Handled by Grafana security layer

## New Tasks Added (Tasks 16-18)

### Task 16: Initialize Go Backend
- Create Go module structure
- Set up `pkg/main.go` entry point
- Create `pkg/plugin/datasource.go` implementing Grafana interfaces
- Update `plugin.json` with `backend: true` and `executable` field
- Create `Magefile.go` for building

**Outcome**: Backend binary compiles, ready for resource handlers

### Task 17: Implement Autocomplete Resource Handler
- Create `pkg/plugin/autocomplete.go`
- Implement `CallResource` handler method
- Create two endpoints:
  - `GET /autocomplete/metrics` → returns `["metric.name1", "metric.name2", ...]`
  - `GET /autocomplete/tags/{metric}` → returns `["tag1:value1", "tag2:value2", ...]`
- Use official Datadog Go SDK
- Apply 2-second timeout
- Implement 30-second caching
- Handle auth gracefully

**Outcome**: Frontend can call secure endpoints that return real Datadog data

### Task 18: Update Frontend Hook
- Modify `src/hooks/useQueryAutocomplete.ts`
- Replace direct API calls with `getBackendSrv().fetch()`
- Call backend resource endpoints instead
- Pass datasource UID for authentication

**Outcome**: Autocomplete now works end-to-end with real metrics and tags

## Testing the Complete Flow

After implementing all tasks:

1. **Build both frontend and backend**:
```bash
yarn build                    # Frontend
mage -l                       # List backend targets
mage build:backend            # Build backend (requires Go)
```

2. **Start Grafana**:
```bash
yarn server
```

3. **Test autocomplete**:
- Configure Datadog datasource with API/App keys
- Type in query field
- After ~400ms debounce: **See real metrics from your Datadog account**
- Continue typing: **See aggregation suggestions**
- Type `{`: **See tag suggestions**
- Keyboard navigate with arrow keys
- Press Enter to select

## Current Progress

✓ Frontend autocomplete architecture complete
✓ Query parsing (detect metric/agg/tag/tag_value context)
✓ Suggestion generation logic
✓ Keyboard navigation
✓ Query validation
✓ UI rendering

✗ Backend infrastructure (Task 16)
✗ Resource handlers (Task 17)
✗ Frontend-backend integration (Task 18)

## Why This Matters

Without the backend:
- Metrics list is empty → "No metrics available"
- Tags list is empty → No tag suggestions
- Autocomplete feels broken even though frontend code is correct

With the backend:
- Real-time metric suggestions as you type
- Tag suggestions for each metric
- Full autocomplete experience matching enterprise data source plugins

## Next Steps

1. Read the tasks 16-18 in tasks.md for detailed implementation guidelines
2. Install Go (required for backend development)
3. Implement tasks in order: 16 → 17 → 18
4. Each task has a detailed `_Prompt` field with specific role and requirements
