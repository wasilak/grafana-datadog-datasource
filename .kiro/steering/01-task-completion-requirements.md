---
title: Task Completion Requirements
inclusion: always
---

# Task Completion Requirements

When implementing tasks from specs, you MUST follow these completion criteria:

## Critical Thinking After Implementation

- After completing any task implementation, ALWAYS critically evaluate whether the code is functional or dead code
- Ask yourself: "Is this code actually being used anywhere in the application?"
- Verify integration points: Check if the implemented functionality is imported and called
- Search the codebase for actual usage of new classes, functions, or modules
- If code is not integrated, identify ALL places where it should be used and integrate it fully
- Don't just implement infrastructure - ensure it's wired into the application flow
- Reference your steering rules to ensure you're following best practices

## Build Verification

- Always run `task build` after implementing code changes
- Fix ALL build errors before marking a task as complete
- Address ALL build warnings before marking a task as complete
- A task is NOT complete if the build fails or produces warnings

## Test Verification

- Run `task test` to verify unit tests pass
- Fix any failing tests before marking task complete
- Add unit tests for new functionality where appropriate

## Git Commit Requirement

- **MANDATORY**: After each task is successfully implemented and verified, commit the changes immediately
- Use a descriptive commit message that includes:
  - Type prefix (feat:, fix:, refactor:, test:, docs:, style:, refactor:, etc.)
  - Brief description of what was implemented
  - Reference to the task number or name
- Stage all relevant files before committing
- Example: `feat: implement health endpoints\n\nTask: 1.5 Implement health endpoints`
- **Do not wait for user approval** - commit after verification steps pass
- This creates a clear audit trail and makes it easy to revert if needed

## Verification Steps

1. Implement the code changes
2. Run `task build` (or appropriate build command) to verify the build succeeds
3. Run `task test` (or appropriate test command) to verify tests pass
4. Fix any errors or warnings that appear
5. Re-run build and tests to confirm all issues are resolved
6. **COMMIT the changes immediately** with a descriptive message
7. Mark the task as complete
8. Inform the user of completion and commit hash

## Why This Matters

- Ensures code integrates properly with the existing codebase
- Catches compilation errors, import issues, and configuration problems early
- Maintains production-ready code quality
- Prevents broken builds from being committed
- **Creates a clear history of task completion with atomic commits**
- **Makes it easy to track progress and revert changes if needed**
- **Provides a safety net - each commit is a known-good state**
- **Enables better collaboration and code review**
