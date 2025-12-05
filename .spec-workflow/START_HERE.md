# 🚀 Query Editor Autocomplete - START HERE

**Status**: Phase 1 ✅ COMPLETE | Phase 2 ⏳ READY | Phase 3 ⏳ PLANNED

---

## TL;DR - What Just Happened

**All frontend code is done and working.** The autocomplete UI displays correctly and shows "No metrics available" because we need a Go backend to securely fetch real data from Datadog.

**All backend tasks (16-20) have been reworked with detailed implementation prompts.** You're ready to start coding the backend.

---

## What You Need to Know

### Phase 1: Frontend ✅ COMPLETE
- Query parser (detects metric/tag/aggregation context) ✓
- Suggestion generator (creates autocomplete list) ✓
- React hook with debounce (400ms) ✓
- QueryEditor component (refactored to hooks) ✓
- Query validator (real-time validation) ✓
- Autocomplete UI dialog ✓

**Status**: Code compiles, runs, shows autocomplete dialog ← but empty metrics list

### Phase 2: Backend ⏳ READY TO START
Tasks 16-20 provide a Go backend plugin with:
- Task 16: Infrastructure setup (go.mod, main.go, datasource.go, Magefile.go)
- Task 17: QueryData handler (main query execution)
- Task 18: CallResource handler (autocomplete endpoints: /metrics, /tags/{metric})
- Task 19: Frontend hook integration (call backend instead of direct API)
- Task 20: plugin.json configuration (enable backend)

**Status**: Tasks fully detailed with implementation prompts, ready to code

### Phase 3: Tests & Docs ⏳ PLANNED
- Unit tests for parser, suggestions, API
- Integration tests for hook and component
- Documentation
- Final review

**Status**: Will implement after Phase 2 is done

---

## Why Go Backend?

Frontend JavaScript cannot:
- Access `secureJsonData` (API keys stored on Grafana backend only)
- Make CORS calls to Datadog API from browser
- Securely store credentials

Solution: Go backend plugin using official Datadog SDK with secure credential handling.

---

## Quick Start (Next 5 Minutes)

1. **Read the quick reference**:
   ```bash
   cat .spec-workflow/REWORK_QUICK_REFERENCE.md
   ```

2. **Review the architecture**:
   ```bash
   cat .spec-workflow/BACKEND_REQUIREMENTS.md | head -50
   ```

3. **See what changed**:
   ```bash
   cat .spec-workflow/REWORK_SUMMARY.md
   ```

4. **Check status**:
   ```bash
   cat .spec-workflow/AUTOCOMPLETE_IMPLEMENTATION_STATUS.md | head -100
   ```

---

## Implementation Timeline

| Phase | Status | Duration | Start When |
|-------|--------|----------|-----------|
| 1: Frontend | ✅ Done | - | Already complete |
| 2: Backend | ⏳ Ready | 8-10h | Now! Follow Task 16 prompt |
| 3: Tests | ⏳ Planned | 3-5h | After Phase 2 done |

**If you have Go experience**: Start Task 16 today, finish in 1-2 weeks

---

## Where to Find Things

### For Understanding
- **Why backend is needed**: BACKEND_REQUIREMENTS.md
- **Overall design**: design.md
- **What changed**: REWORK_SUMMARY.md
- **Quick lookup**: REWORK_QUICK_REFERENCE.md
- **Current status**: AUTOCOMPLETE_IMPLEMENTATION_STATUS.md

### For Implementation
- **Task details**: tasks.md (look for "Task 16", "Task 17", etc.)
- **Go reference**: src/datasource.ts (TypeScript version to translate)
- **Grafana SDK**: https://github.com/grafana/grafana-plugin-sdk-go

### For Progress Tracking
- Update task checkboxes in tasks.md: `[ ]` → `[x]`
- Update status in AUTOCOMPLETE_IMPLEMENTATION_STATUS.md

---

## Your Next Step

### Option A: Deep Dive (30 mins)
Read in order:
1. REWORK_QUICK_REFERENCE.md
2. tasks.md (Task 16 section, read the _Prompt field)
3. BACKEND_REQUIREMENTS.md

Then start Task 16 implementation.

### Option B: Quick Start (5 mins)
1. Check prerequisites (Go 1.18+, Mage)
2. Open tasks.md and find "Task 16: Initialize Go Backend Plugin Structure"
3. Follow the numbered steps in the _Prompt field

### Option C: Immediate Coding (Now!)
Go straight to tasks.md Task 16 _Prompt and start implementing. Reference:
- Grafana Plugin SDK docs (linked in the prompt)
- src/datasource.ts for TypeScript logic to port
- BACKEND_REQUIREMENTS.md for architecture context

---

## Prerequisites

Check you have these installed:
```bash
go version           # Should be 1.18+
go install github.com/magefile/mage@latest  # Build tool
mage -v              # Verify
```

---

## Success Indicators

### After Task 16:
```bash
go mod tidy
go build ./pkg
mage build:backend
ls dist/gpx_wasilak_datadog_datasource_linux_x64  # Should exist
```

### After Task 20:
```bash
yarn build
mage build:backend
yarn server  # Grafana starts without errors
```

Then in Grafana UI:
- Add Datadog datasource with real API keys
- Create dashboard with query
- Type in query editor → see **real metrics** after ~400ms debounce ✨

---

## File Structure (What Gets Created)

```
pkg/                                    # NEW
├── main.go                             # Entry point
└── plugin/
    ├── datasource.go                   # Main backend struct + handlers
    └── autocomplete.go                 # (optional - can be in datasource.go)

go.mod                                  # NEW - Go module file
Magefile.go                             # NEW - Build automation

src/plugin.json                         # MODIFY - remove routes, add backend
src/hooks/useQueryAutocomplete.ts       # MODIFY - call backend not direct API
src/QueryEditor.tsx                     # MODIFY - pass datasourceUid
```

---

## Architecture Flow (What You're Building)

```
User Types Query
       ↓
    QueryEditor (React) [FRONTEND - DONE ✓]
       ↓
useQueryAutocomplete Hook [FRONTEND - DONE ✓]
  (parse query context, generate suggestions, validate)
       ↓
   [400ms debounce]
       ↓
getBackendSrv().fetch() [FRONTEND - TO IMPLEMENT Task 19]
       ↓
Grafana Backend Proxy
       ↓
Go Plugin CallResource Handler [BACKEND - TO IMPLEMENT Task 18]
  (validates request, calls Datadog, caches result)
       ↓
Official Datadog SDK
       ↓
    Datadog API
       ↓
  Real Metrics & Tags
       ↓
JSON response back to frontend
       ↓
Autocomplete dialog shows real suggestions ✨
```

---

## The 5 Backend Tasks (Tasks 16-20)

1. **Task 16: Infrastructure**
   - Creates Go project structure
   - Implements three interfaces (QueryData, CallResource, CheckHealth)
   - Duration: 2-3 hours

2. **Task 17: QueryData Handler**
   - Executes metric queries from frontend
   - Converts Datadog response to Grafana DataFrames
   - Duration: 2-3 hours

3. **Task 18: CallResource Handler**
   - Provides /autocomplete/metrics endpoint
   - Provides /autocomplete/tags/{metric} endpoint
   - Implements caching (30-second TTL)
   - Duration: 2-3 hours

4. **Task 19: Frontend Integration**
   - Updates hook to call backend instead of direct API
   - Adds datasourceUid parameter
   - Duration: 1 hour

5. **Task 20: Configuration**
   - Updates plugin.json (remove routes, add backend config)
   - Duration: 15 minutes

**Total**: ~8-10 hours of coding (sequential tasks)

---

## Getting Help

Each task has a detailed `_Prompt` field in tasks.md that includes:
- Specific role for the developer
- Numbered implementation steps
- Code structure examples
- Success criteria (checkbox format)
- Restrictions and constraints
- References to similar code

---

## Status Check

**Run this to verify everything is ready**:

```bash
# Check frontend files exist
ls src/hooks/useQueryAutocomplete.ts
ls src/QueryEditor.tsx
ls src/utils/autocomplete/*.ts

# Check documentation
ls .spec-workflow/*SUMMARY.md
ls .spec-workflow/*REFERENCE.md
ls .spec-workflow/AUTOCOMPLETE_IMPLEMENTATION_STATUS.md

# All should exist and be non-empty
```

---

## One More Thing

**This is a well-documented, phased implementation.** Each task:
- Has clear success criteria
- References existing code for patterns
- Includes error handling requirements
- Specifies performance targets
- Shows code structure/signatures

You're not guessing - you're following detailed specifications.

---

## Ready? Let's Go! 🚀

### Next Command:
```bash
cat .spec-workflow/specs/query-editor-autocomplete/tasks.md | grep -A 100 "^### Task 16:"
```

This will show you the detailed prompt for Task 16 with all the implementation steps.

Then:
1. Create `pkg/main.go`
2. Create `pkg/plugin/datasource.go`
3. Create `go.mod`
4. Create `Magefile.go`
5. Verify with `go build ./pkg`

You've got this! 💪

---

**Files Modified During Rework:**
- ✅ tasks.md (Tasks 16-20 completely reworked)
- ✅ AUTOCOMPLETE_IMPLEMENTATION_STATUS.md (new Phase 2 execution plan)
- ✅ REWORK_SUMMARY.md (what changed and why)
- ✅ REWORK_QUICK_REFERENCE.md (quick lookup guide)
- ✅ START_HERE.md (this file)

All frontend code in Phase 1 remains unchanged and fully working.
