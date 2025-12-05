# Task Completion Checklist

When completing a coding task, ALWAYS perform these steps before marking it done:

## Code Quality Checks (REQUIRED)
1. **Linting & Formatting**:
   ```bash
   yarn lint:fix        # Fixes linting issues and formats with Prettier
   ```
   - Must pass without errors
   - Code must follow Grafana ESLint config

2. **Type Checking**:
   ```bash
   yarn typecheck       # TypeScript type validation
   ```
   - Must pass with no type errors
   - No `any` types without justification

3. **Testing** (if applicable):
   ```bash
   yarn test:ci         # Run all tests (CI mode)
   ```
   - All tests must pass
   - New code should have corresponding tests in `src/**/__tests__/` or `*.test.ts`

## Code Review Standards
- No commented-out code
- No console.log or debug statements
- Proper error handling
- Follow existing code patterns in the project
- Use Grafana UI components where applicable

## Verification Steps
1. Run all commands above
2. Verify no new type errors introduced
3. Verify build succeeds: `yarn build`
4. Test functionality manually with Docker dev environment if relevant

## Commit Guidelines
- Only commit when explicitly asked by user
- Use meaningful commit messages
- Reference any related issues/tasks
