# Query Editor Autocomplete - Implementation Status

## Overview
The autocomplete feature is split into **3 phases**:
1. **Frontend Implementation** (Tasks 0-8) - ✅ COMPLETE
2. **Backend Infrastructure** (Tasks 16-18) - ⏳ IN PROGRESS (Task 16 complete, Task 17-18 next)
3. **Testing & Documentation** (Tasks 9-15) - ⏳ AFTER BACKEND

---

## Phase 1: Frontend Implementation ✅ COMPLETE (8/8 tasks)

### Completed Components

#### 📦 Types & Interfaces (Task 1)
- `QueryContext` - Parsed query state with cursor position
- `AutocompleteState` - UI state (suggestions, loading, errors)
- `CompletionCache` - Caching layer interface
- `ValidationResult` - Query validation results
- **File**: `src/types.ts` (+51 lines)

#### 🔍 Query Parser (Task 2)
- `parseQuery()` - Analyzes Datadog query syntax
- Detects context: metric, aggregation, tag, tag_value
- Extracts metric name and existing tags
- Handles edge cases and special characters
- **File**: `src/utils/autocomplete/parser.ts` (+188 lines)

#### 💡 Suggestion Generator (Task 3)
- `generateSuggestions()` - Creates CompletionItems from context
- Static aggregation list (avg, sum, min, max, count, etc.)
- Filters: removes duplicates, limits to 100 items
- Deduplicates suggestions by label
- **File**: `src/utils/autocomplete/suggestions.ts` (+224 lines)

#### 🔗 API Integration (Task 4)
- `fetchMetricsFromDatadog()` - 2-second timeout, 30-second cache
- `fetchTagsForMetric()` - Tag fetching with same caching
- Request cancellation & concurrent limits
- **Note**: Currently unused (frontend can't access secureJsonData)
- **File**: `src/utils/autocomplete/api.ts` (+260 lines)

#### ⚛️ React Hook (Task 5)
- `useQueryAutocomplete()` - State management & debounce
- 400ms debounce timer
- Keyboard navigation (arrow up/down, Enter, Tab, Escape)
- Orchestrates parser, suggestions, and validation
- **File**: `src/hooks/useQueryAutocomplete.ts` (+197 lines)

#### 🎨 QueryEditor Component (Task 6)
- Refactored from PureComponent → functional component
- Integrated autocomplete hook
- Rendered autocomplete dialog with suggestions
- Loading spinner and error messages
- Suggestion selection and insertion
- **File**: `src/QueryEditor.tsx` (324 additions, 104 removals)

#### ✔️ Query Validator (Task 7)
- `validateQuery()` - Syntax & semantic validation
- Checks: metric name, tag format, aggregation, balanced braces
- Actionable error messages with suggested fixes
- **File**: `src/utils/queryValidator.ts` (+231 lines)

#### 🔄 Validation Integration (Task 8)
- Runs validation on debounce expiry
- Displays validation errors in state
- Doesn't prevent query execution
- **Modified**: `src/hooks/useQueryAutocomplete.ts`

### Current Status
✅ **Feature works locally but shows "No metrics available"** because:
- Frontend cannot access `secureJsonData` (API keys are backend-only)
- Cannot make direct Datadog API calls from browser
- Need backend proxy to fetch real data

---

## Phase 2: Backend Infrastructure ⏳ REQUIRED NEXT (Tasks 16-20)

### Why Backend is Required

```
Problem: Frontend has no way to get real metrics/tags
Reason: Secure credentials (API keys) cannot be exposed to browser
        Datadog API requires CORS headers that block browser calls
Solution: Go backend plugin using official Datadog SDK with secure auth
```

### Architecture: Frontend → Backend → Datadog

```
User Types Query
       ↓
   QueryEditor Component
       ↓
useQueryAutocomplete Hook (parse, suggest, validate)
       ↓
   [400ms debounce]
       ↓
getBackendSrv().fetch()  ← Frontend talks to backend
       ↓
Grafana Backend Proxy
       ↓
Go Plugin Resource Handler (CallResource)
       ↓
Official Datadog SDK
       ↓
Datadog API (secure, credentials on backend only)
       ↓
Metrics & Tags returned
```

### Tasks (5 total): 16 → 17 → 18 → 19 → 20

#### 🔨 Task 16: Initialize Go Backend Plugin Structure
**Status**: ✅ COMPLETED (2025-12-05)

**Goal**: Set up Go backend foundation with proper infrastructure

**Creates**:
- `pkg/main.go` - Plugin entry point (calls serve.Serve)
- `pkg/plugin/datasource.go` - Main plugin struct implementing interfaces
- `go.mod` - Go module dependencies (SDK v0.200+, datadog-api-client-go/v2)
- `Magefile.go` - Build automation (creates binary in dist/)

**Interfaces to implement**:
- `backend.QueryDataHandler` (QueryData method for queries)
- `backend.CallResourceHandler` (CallResource method for autocomplete)
- `backend.HealthChecker` (CheckHealth method)

**Success Criteria**:
- ✓ go mod tidy succeeds
- ✓ go build ./pkg compiles without errors
- ✓ mage build:backend creates binary (size <50MB)
- ✓ No missing imports or type errors

---

#### 🌐 Task 17: Implement QueryData Handler (Main Query Execution)
**Status**: ⏳ BLOCKED (waiting for Task 16)

**Goal**: Move all metric queries from frontend proxy to backend

**Implements**:
- QueryData(ctx context.Context, req *backend.QueryDataRequest)
- Unmarshals query JSON from frontend
- Calls Datadog MetricsApi.QueryMetrics()
- Converts response to Grafana DataFrame
- Handles aggregations and tag filtering
- Returns data frames with proper error handling

**Key Features**:
- Respects context timeout (Grafana default ~30s)
- Handles 401/403 auth errors gracefully
- Supports multiple queries in single request
- Uses official datadog-api-client-go only

**Success Criteria**:
- ✓ QueryData method compiles
- ✓ Frontend queries return data frames
- ✓ Aggregations (avg, sum, min, max, count) work
- ✓ Tag filtering works
- ✓ Errors display properly in UI
- ✓ Context timeout respected

---

#### 📊 Task 18: Implement CallResource Handler (Autocomplete Endpoints)
**Status**: ⏳ BLOCKED (waiting for Task 16)

**Goal**: Create secure backend endpoints for metrics and tags

**Endpoints**:
1. `GET /autocomplete/metrics` → returns `["metric.name1", "metric.name2", ...]`
2. `GET /autocomplete/tags/{metric}` → returns `["tag1:value1", "tag2:value2", ...]`

**Implementation**:
- CallResource() router with pattern matching
- MetricsHandler: calls MetricsApi.ListMetrics()
- TagsHandler: calls TagsApi.ListHostTags() with metric filter
- In-memory cache with 30-second TTL
- Request-level timeout: 2 seconds
- Concurrent request limit: max 5
- Thread-safe (sync.Mutex)

**Key Features**:
- Cache with timestamp tracking (30-second TTL exactly)
- Graceful timeout handling (returns empty array + error)
- Auth error messages (401/403 → "Invalid Datadog credentials")
- Proper HTTP status codes (200, 401, 404, 500)

**Success Criteria**:
- ✓ Both endpoints callable from frontend
- ✓ Real metrics and tags returned as JSON arrays
- ✓ 2-second timeout enforced (doesn't hang)
- ✓ 30-second cache working (verify with timestamps)
- ✓ 401 errors return proper message
- ✓ Concurrent requests limited to 5
- ✓ All responses valid JSON

---

#### 🔄 Task 19: Connect Frontend Hook to Backend
**Status**: ⏳ BLOCKED (waiting for Task 18)

**Goal**: Replace direct API calls with secure backend calls

**Changes to `src/hooks/useQueryAutocomplete.ts`**:
- Add datasourceUid parameter
- Replace direct API calls with getBackendSrv().fetch()
- URL pattern: `/api/datasources/uid/{datasourceUid}/resources/autocomplete/metrics`
- URL pattern: `/api/datasources/uid/{datasourceUid}/resources/autocomplete/tags/{metric}`
- Implement 2-second timeout via AbortController
- Update error handling for new failure modes

**Security**:
- API keys stay on backend (never exposed to frontend)
- Frontend passes only datasource UID
- Grafana SDK handles authentication

**Key Features**:
- AbortController timeout (2 seconds exactly)
- Error messages for: 401, 404, timeout, network errors
- Existing loading/error state preservation
- Datasource UID extraction from props

**Success Criteria**:
- ✓ Frontend calls backend (not direct Datadog API)
- ✓ Metrics and tags load from backend
- ✓ Auth handled securely by Grafana
- ✓ Errors display properly in autocomplete UI
- ✓ Loading states work as before
- ✓ TypeScript compilation clean

---

#### 🔧 Task 20: Update plugin.json for Backend Execution
**Status**: ⏳ BLOCKED (waiting for Task 16)

**Goal**: Configure plugin to load and use Go backend

**Changes**:
1. **Remove** entire `routes` section (HTTP proxy no longer needed)
2. **Add** two fields after "id":
   ```json
   "backend": true,
   "executable": "gpx_wasilak_datadog_datasource_linux_x64",
   ```
3. **Verify** grafanaDependency is ≥12.3.0
4. **Keep** all other fields unchanged

**Before**:
```json
{
  "id": "wasilak-datadog-datasource",
  "routes": [ ... ],  // DELETE THIS ENTIRE SECTION
  ...
}
```

**After**:
```json
{
  "id": "wasilak-datadog-datasource",
  "backend": true,
  "executable": "gpx_wasilak_datadog_datasource_linux_x64",
  "type": "datasource",
  ...
}
```

**Key Details**:
- Executable name MUST match Magefile build output
- No trailing commas in JSON
- Must validate as valid JSON

**Success Criteria**:
- ✓ plugin.json validates as JSON (no syntax errors)
- ✓ Grafana recognizes backend plugin
- ✓ Backend binary loads when plugin starts
- ✓ No errors in Grafana logs about plugin config
- ✓ Plugin appears in datasource list
- ✓ Can create new Datadog datasource instances

---

## Phase 3: Testing & Documentation (Tasks 9-15)

### Tests (5 tasks)
- [ ] Task 9: Parser unit tests
- [ ] Task 10: Suggestions unit tests
- [ ] Task 11: API unit tests
- [ ] Task 12: Hook integration tests
- [ ] Task 13: QueryEditor integration tests

### Documentation & Review (2 tasks)
- [ ] Task 14: Create docs/autocomplete.md
- [ ] Task 15: Code review and cleanup

---

## Architecture Diagram

```
User Types in Query Editor
           ↓
    QueryEditor Component
           ↓
useQueryAutocomplete Hook
    ├─ parseQuery() → QueryContext
    ├─ generateSuggestions() → CompletionItems
    └─ validateQuery() → ValidationResult
           ↓
    [400ms debounce]
           ↓
getBackendSrv().fetch() [Task 18]
           ↓
Grafana Backend Proxy
           ↓
Go Plugin Resource Handler [Task 17]
           ↓
Official Datadog SDK
           ↓
Datadog API
           ↓
    Metrics & Tags Data
           ↓
    Suggestion Dialog
           ↓
Keyboard Navigation
(↑↓ keys, Enter, Escape)
           ↓
Query Inserted at Cursor
```

---

## Code Statistics

### Frontend Completed
- **Files Created**: 5
  - `src/types.ts` (extended)
  - `src/utils/autocomplete/parser.ts`
  - `src/utils/autocomplete/suggestions.ts`
  - `src/utils/autocomplete/api.ts`
  - `src/utils/queryValidator.ts`
  - `src/hooks/useQueryAutocomplete.ts`

- **Files Modified**: 2
  - `package.json` (added @datadog/datadog-api-client)
  - `src/QueryEditor.tsx` (refactored to hooks)

- **Lines Added**: ~1,470
- **Lines Removed**: ~104
- **Total Change**: +1,366 lines

### Backend TODO
- **Files to Create**: 4
  - `pkg/main.go`
  - `pkg/plugin/datasource.go`
  - `pkg/plugin/autocomplete.go`
  - `go.mod`
  - `Magefile.go`

- **Estimated Lines**: ~800-1000
- **Build Tool**: Mage + Go compiler

---

## Current Testing

✅ Frontend builds successfully
✅ Autocomplete dialog appears after typing
✅ Aggregation suggestions show (static data)
✅ Keyboard navigation works
✅ Query validation works
✅ Parser correctly identifies context

❌ Metric suggestions (empty - requires backend)
❌ Tag suggestions (empty - requires backend)
❌ End-to-end testing (requires backend)

---

## Execution Plan for Phase 2

### Prerequisites

1. **Install Go** (required)
   ```bash
   go version  # Must be 1.18+
   ```

2. **Install Mage** (build tool)
   ```bash
   go install github.com/magefile/mage@latest
   mage -v    # Verify installation
   ```

3. **Review documentation**
   - Read: `.spec-workflow/specs/query-editor-autocomplete/BACKEND_REQUIREMENTS.md`
   - Reference: `tasks.md` (Tasks 16-20 detailed prompts)
   - Patterns: Look at existing TypeScript datasource.ts for reference

### Task Execution Order (Sequential - Dependencies)

```
Task 16 (Backend Setup)
        ↓ [creates infrastructure]
Task 17 (QueryData Handler) + Task 18 (CallResource Handler) [can be parallel]
        ↓ [backend endpoints created]
Task 19 (Frontend Hook Integration)
        ↓ [frontend updated to use backend]
Task 20 (plugin.json Configuration)
        ↓ [final configuration]
Verification & Testing
```

### Task 16: Backend Setup (2-3 hours)

```bash
# 1. Create Go module structure
mkdir -p pkg/plugin

# 2. Create go.mod (or let go init create it)
go mod init github.com/wasilak/grafana-datadog-datasource

# 3. Add dependencies
go get github.com/grafana/grafana-plugin-sdk-go@v0.200.0
go get github.com/DataDog/datadog-api-client-go/v2@latest

# 4. Create files:
#    - pkg/main.go
#    - pkg/plugin/datasource.go
#    - Magefile.go

# 5. Verify
go mod tidy
go build ./pkg
```

**Success Check**: Binary compiles, no missing imports

---

### Task 17: QueryData Handler (2-3 hours)

```bash
# 1. Implement QueryData() method in pkg/plugin/datasource.go
#    - See detailed prompt in tasks.md
#    - Reference: src/datasource.ts doRequest() method

# 2. Test structure (optional at this stage)
#    - Ensure it compiles with go build ./pkg

# 3. Verify implementation against:
#    - Unmarshals query JSON correctly
#    - Calls Datadog API with context timeout
#    - Returns proper DataFrames with error handling
```

**Success Check**: Method compiles, has proper signature, handles errors

---

### Task 18: CallResource Handler (2-3 hours)

```bash
# 1. Implement CallResource() method in pkg/plugin/datasource.go
#    - Route handling: GET /autocomplete/metrics, GET /autocomplete/tags/{metric}
#    - Implement MetricsHandler and TagsHandler functions
#    - Add in-memory cache with 30-second TTL
#    - Thread-safe implementation (sync.Mutex)

# 2. Build and verify
go build ./pkg

# 3. Test endpoints manually (when running backend):
#    curl http://localhost:3000/api/datasources/uid/{uid}/resources/autocomplete/metrics
```

**Success Check**: Endpoints return JSON arrays, cache works, timeouts enforced

---

### Task 19: Frontend Hook (1 hour)

```bash
# 1. Update src/hooks/useQueryAutocomplete.ts
#    - Replace direct API calls with getBackendSrv().fetch()
#    - Add datasourceUid parameter
#    - Implement AbortController timeout

# 2. Update src/QueryEditor.tsx
#    - Pass datasource.uid to useQueryAutocomplete

# 3. Build and verify
yarn build
```

**Success Check**: Frontend compiles, no TypeScript errors

---

### Task 20: plugin.json Config (15 mins)

```bash
# 1. Edit src/plugin.json:
#    - Remove routes section entirely
#    - Add "backend": true after "id"
#    - Add "executable": "gpx_wasilak_datadog_datasource_linux_x64"

# 2. Validate JSON
#    - Use online JSON validator
#    - No trailing commas
#    - All quotes closed

# 3. Verify
cat src/plugin.json | jq .   # If jq installed
```

**Success Check**: JSON validates, Grafana config recognized

---

### Final Verification

```bash
# Build everything
yarn build                           # Frontend
mage build:backend                   # Go backend (creates dist/gpx_*)

# Start development environment
yarn server                          # Starts Grafana with backend plugin

# Test in Grafana UI:
# 1. Add Datadog datasource (with valid API/App keys)
# 2. Create dashboard with Datadog query
# 3. Type in query editor
# 4. After ~400ms: See real metrics from your Datadog account
# 5. Continue: See aggregation suggestions
# 6. Type {: See tag suggestions
# 7. Navigate: Use arrow keys to select
# 8. Select: Press Enter or click suggestion
```

### Estimated Timeline

| Task | Duration | Notes |
|------|----------|-------|
| 16: Backend setup | 2-3h | Boilerplate + Go imports |
| 17: QueryData | 2-3h | Datadog API integration, error handling |
| 18: CallResource | 2-3h | Caching, timeout, concurrent limits |
| 19: Frontend | 1h | Swap API calls, add UID param |
| 20: plugin.json | 15m | Remove/add fields, validate |
| **Total** | **~8-10h** | Assumes Go experience |

**For Go beginners**: Add 30-50% more time for SDK learning

---

## Documentation Files

- **This File**: `.spec-workflow/AUTOCOMPLETE_IMPLEMENTATION_STATUS.md`
- **Backend Guide**: `.spec-workflow/specs/query-editor-autocomplete/BACKEND_REQUIREMENTS.md`
- **Task Details**: `.spec-workflow/specs/query-editor-autocomplete/tasks.md`
- **Design Doc**: `.spec-workflow/specs/query-editor-autocomplete/design.md`
- **Implementation Logs**: `.spec-workflow/specs/query-editor-autocomplete/Implementation Logs/`

---

## Key Files Reference

### Frontend (Complete)
```
src/
├── types.ts (extended with autocomplete types)
├── QueryEditor.tsx (refactored to hooks)
├── hooks/
│   └── useQueryAutocomplete.ts
├── utils/
│   ├── queryValidator.ts
│   └── autocomplete/
│       ├── parser.ts
│       ├── suggestions.ts
│       └── api.ts (frontend-side, currently unused)
└── datasource.ts (unchanged, will gain new backend endpoints)

package.json (updated: @datadog/datadog-api-client added)
```

### Backend (To Create)
```
pkg/
├── main.go
└── plugin/
    ├── datasource.go
    └── autocomplete.go

go.mod (dependencies)
Magefile.go (build targets)
```

### Configuration
```
src/plugin.json (update with backend: true, executable)
```

---

## Quick Reference: Task Numbers

**Completed (8)**: 0, 1, 2, 3, 4, 5, 6, 7, 8
**Pending Tests (5)**: 9, 10, 11, 12, 13
**Backend (3)**: 16, 17, 18
**Final (2)**: 14, 15

**Total**: 19 tasks

---

**Last Updated**: 2025-12-05
**Status**: Frontend complete, Task 16 (backend setup) complete, Task 17-18 next
**Next Action**: Implement Task 17 (QueryData handler with Datadog MetricsApi)
