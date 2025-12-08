---
title: Phase Gate Discipline
inclusion: always
---

# Phase Gate Discipline

## Mandatory Phase Gates

This project follows **strict incremental development** with mandatory phase gates. This discipline prevents the catastrophic over-engineering that broke the previous implementation.

## Phase Gate Rules

### 1. Sequential Development
- **NEVER** start Phase N+1 until Phase N gate passes
- **NEVER** implement features from future phases
- **NEVER** add "nice to have" features not in current phase spec

### 2. Gate Requirements

Every phase gate requires:

1. ✅ **All tasks complete** - Every task in `tasks.md` marked done
2. ✅ **Build succeeds** - `task build` completes without errors or warnings
3. ✅ **Tests pass** - `task test` passes all unit tests
4. ✅ **Manual testing complete** - 100% of manual testing checklist passes
5. ✅ **Previous phases work** - Earlier phases still function correctly
6. ✅ **Git tag created** - Phase tagged for easy rollback

### 3. Gate Failure Protocol

If ANY gate requirement fails:

1. **STOP** - Do not proceed to next phase
2. **FIX** - Address the failing requirement
3. **RE-TEST** - Verify the fix works
4. **DOCUMENT** - Note what failed and how it was fixed
5. **RETRY GATE** - Re-run full gate checklist

### 4. No Scope Creep

During phase implementation:

- ❌ "While I'm here, let me add..."
- ❌ "This would be better if..."
- ❌ "Let me refactor this to be more flexible..."
- ✅ "Does this task spec require this? No? Then don't do it."

## Phase Overview

### Phase 1: HTTP Server + Health (1 day)
**Gate**: Server starts, responds to `/health` and `/ready`, Swagger UI works

### Phase 2: VictoriaMetrics Integration (2-3 days)
**Gate**: Can write and query metrics on single node

### Phase 3: Prometheus API (2-3 days)
**Gate**: Prometheus remote write/read works

### Phase 4: etcd/raft Consensus (3-4 days)
**Gate**: 3-node coordinator cluster forms and elects leader

### Phase 5: Namespace Management (2-3 days)
**Gate**: Can create/delete namespaces via API

### Phase 6: Distributed Sharding (1 week)
**Gate**: Queries work across multiple data nodes

### Phase 7: Production Readiness (1 week)
**Gate**: Runs stably for 24 hours under load

## Why This Matters

### Previous Failure
The v0.1.0 implementation failed because:
- Built everything at once
- Multiple abstraction layers (Basic/Enhanced/Advanced)
- Features added before basics worked
- No phase gates or checkpoints
- Result: **0% functional code**

### This Approach
- Build incrementally
- Verify at each step
- Simple before complex
- Working code always
- Result: **Functional at every phase**

## Manual Testing Discipline

### Manual Testing is Mandatory
- Automated tests come later
- Manual testing proves it works
- User performs manual testing
- Agent provides clear test instructions

### Manual Test Checklist Format
```markdown
## Phase N Gate: Manual Testing

- [ ] Test 1: Description
  - Command: `curl http://localhost:9753/health`
  - Expected: `{"status":"healthy",...}`
  
- [ ] Test 2: Description
  - Command: `./bin/loomae server`
  - Expected: Server starts without errors
```

### Passing Manual Tests
- **ALL** checklist items must pass
- **NO** "mostly works" or "good enough"
- **NO** "I'll fix it later"
- **YES** "Every item passes completely"

## Git Tagging

### Tag Format
- Phase 1: `phase-1-complete`
- Phase 2: `phase-2-complete`
- etc.

### Why Tag
- Easy rollback if next phase breaks things
- Clear progress markers
- Reference points for debugging

### Tagging Command
```bash
git tag -a phase-1-complete -m "Phase 1: HTTP Server + Health Endpoints - GATE PASSED"
git push origin phase-1-complete
```

## Communication

### When Completing Phase
Agent should say:
```
Phase N implementation complete. Ready for gate testing.

Manual Testing Checklist:
- [ ] Test 1...
- [ ] Test 2...

Please run these tests and confirm all pass before we proceed to Phase N+1.
```

### When Gate Passes
User confirms, then agent:
```
Phase N gate PASSED ✅

Tagging: phase-N-complete
Next: Phase N+1 - [Description]

Ready to proceed?
```

### When Gate Fails
```
Phase N gate FAILED ❌

Failed test: [description]
Issue: [what went wrong]

Fixing now...
```

## Discipline Checklist

Before starting any task, ask:

- [ ] Is this task in the current phase spec?
- [ ] Have all previous phase gates passed?
- [ ] Am I adding features not in the spec?
- [ ] Am I over-engineering the solution?
- [ ] Is this the simplest approach that works?

If any answer is wrong, **STOP** and reconsider.

## Remember

**The goal is working software at every step, not impressive architecture that might work someday.**

Build incrementally. Test thoroughly. Pass gates. Repeat.
