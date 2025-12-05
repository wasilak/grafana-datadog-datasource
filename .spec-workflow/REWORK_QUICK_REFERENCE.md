# Quick Reference: Tasks Reworking

## What Was Reworked

### tasks.md
- **Section**: Phase 2: Backend Infrastructure (Tasks 16-20)
- **Changes**:
  - Reorganized from 3 tasks → 5 tasks for clarity
  - Added detailed implementation steps (numbered, with code structure)
  - Enhanced _Prompt sections with specific Go patterns
  - Added explicit interface signatures to implement
  - Improved success criteria (checkboxes)
- **Impact**: Much clearer guidance for implementation

### AUTOCOMPLETE_IMPLEMENTATION_STATUS.md
- **Sections updated**:
  - Phase 2 overview (why backend needed)
  - Task 16-20 status details
  - Execution Plan for Phase 2 section
  - Timeline breakdown
- **New content**:
  - Prerequisites (Go, Mage, docs)
  - Task dependency diagram
  - Command-by-command implementation steps
  - Final verification section
- **Impact**: Complete roadmap from current state to full implementation

### REWORK_SUMMARY.md (NEW)
- **Purpose**: Document all changes
- **Content**: Before/after comparisons, current state, next steps
- **Impact**: Reference for understanding architectural shift

---

## Task Structure (Tasks 16-20)

| Task | Responsibility | Duration | Creates |
|------|-----------------|----------|---------|
| 16 | Go infrastructure | 2-3h | go.mod, main.go, datasource.go, Magefile.go |
| 17 | Query execution | 2-3h | QueryData handler (main query execution) |
| 18 | Autocomplete endpoints | 2-3h | CallResource handler (/autocomplete/* routes) |
| 19 | Frontend integration | 1h | Changes to useQueryAutocomplete.ts + QueryEditor.tsx |
| 20 | Configuration | 15m | Update src/plugin.json |

**Total**: ~8-10 hours for someone with Go experience

---

## Key Files to Know

### During Implementation
- `tasks.md` - Detailed prompts for each task
- `BACKEND_REQUIREMENTS.md` - Architecture explanation
- `AUTOCOMPLETE_IMPLEMENTATION_STATUS.md` - Status tracking
- Reference: `src/datasource.ts` - TypeScript version of logic you'll implement in Go

### After Phase 2
- `src/plugin.json` - Will change significantly
- `pkg/main.go` - New entry point
- `pkg/plugin/datasource.go` - Main backend implementation
- `go.mod` - New Go module file

---

## Implementation Checklist

### Before Starting
- [ ] Read this file
- [ ] Read BACKEND_REQUIREMENTS.md
- [ ] Review tasks.md Tasks 16-20
- [ ] Check Go version: `go version` (need 1.18+)
- [ ] Install Mage: `go install github.com/magefile/mage@latest`

### Task 16
- [ ] Create `pkg/main.go` entry point
- [ ] Create `pkg/plugin/datasource.go` with struct
- [ ] Create `go.mod` with dependencies
- [ ] Create `Magefile.go` build script
- [ ] Verify: `go mod tidy && go build ./pkg`

### Task 17
- [ ] Implement `QueryData()` method
- [ ] Unmarshal query JSON
- [ ] Call Datadog MetricsApi
- [ ] Convert to DataFrame
- [ ] Handle errors

### Task 18
- [ ] Implement `CallResource()` router
- [ ] Implement `/autocomplete/metrics` handler
- [ ] Implement `/autocomplete/tags/{metric}` handler
- [ ] Add in-memory cache (30-second TTL)
- [ ] Add concurrent request limiting

### Task 19
- [ ] Update `src/hooks/useQueryAutocomplete.ts`
- [ ] Replace direct API with `getBackendSrv().fetch()`
- [ ] Add datasourceUid parameter
- [ ] Implement AbortController timeout
- [ ] Update `src/QueryEditor.tsx` to pass UID

### Task 20
- [ ] Edit `src/plugin.json`
- [ ] Remove `routes` section entirely
- [ ] Add `"backend": true`
- [ ] Add `"executable": "gpx_wasilak_datadog_datasource_linux_x64"`
- [ ] Validate JSON

### Verification
- [ ] Build: `yarn build && mage build:backend`
- [ ] Run: `yarn server`
- [ ] Test: Real metrics show up in autocomplete
- [ ] Test: Tag suggestions work
- [ ] Test: Query execution works

---

## Common Reference Points

### Go Backend Structure (Task 16)
```go
// pkg/plugin/datasource.go
type Datasource struct {
    InstanceSettings *backend.DataSourceInstanceSettings
    JSONData         *MyDataSourceOptions
    SecureJSONData   map[string]string
}

// Implement these interfaces:
func (d *Datasource) QueryData(ctx, req) (*backend.QueryDataResponse, error)
func (d *Datasource) CallResource(ctx, req, sender) error
func (d *Datasource) CheckHealth(ctx, req) (*backend.CheckHealthResponse, error)
```

### Frontend Integration (Task 19)
```typescript
// OLD (frontend direct API)
const metrics = await fetchMetricsFromDatadog(config)

// NEW (backend proxy)
const response = await getBackendSrv().fetch({
  url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/metrics`,
  method: 'GET',
})
const metrics = response.data as string[]
```

### plugin.json (Task 20)
```json
// REMOVE: "routes" section (10+ lines)
// ADD AFTER "id": 
"backend": true,
"executable": "gpx_wasilak_datadog_datasource_linux_x64",
```

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete and working |
| ⏳ | Ready but not started |
| 🚫 | Blocked (waiting for dependency) |
| ⚠️  | In progress |

**Current**: Phase 1 ✅ | Phase 2 ⏳ | Phase 3 ⏳

---

## Next Action

Start Task 16: **Initialize Go Backend Plugin Structure**

See detailed steps in: `tasks.md` → Search for "Task 16: Initialize Go Backend Plugin Structure"
