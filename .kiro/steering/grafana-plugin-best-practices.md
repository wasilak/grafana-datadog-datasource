# Grafana Plugin Development Best Practices

## Always Use Native Grafana Components

When building UI for Grafana plugins, ALWAYS use components from `@grafana/ui` instead of creating custom components:

- Use `CodeEditor` for code input with syntax highlighting
- Use `useTheme2()` hook for theme detection and colors
- Use Grafana's native autocomplete/suggestion components
- Use `Input`, `Button`, `Select`, etc. from `@grafana/ui`

**Why**: Ensures visual consistency, automatic theme support, and accessibility compliance.

## Theme Support

- NEVER hardcode colors - always use theme colors from `useTheme2()`
- Support both light and dark themes
- Test theme switching works correctly
- Use `theme.colors.background.primary`, `theme.colors.text.primary`, etc.

## Monaco Editor Integration

When using CodeEditor with custom languages:

1. Register your language with Monaco: `monaco.languages.register({ id: 'your-language' })`
2. Define tokenizer rules with `monaco.languages.setMonarchTokensProvider()`
3. Define theme colors for both dark and light themes
4. Provide autocomplete via `getSuggestions` prop

## Backend Best Practices

### Resource Handlers

- Use `backend.CallResourceHandler` for custom endpoints
- Return proper HTTP status codes (200, 400, 401, 403, 404, 500)
- Return structured JSON responses
- Handle errors gracefully with meaningful messages

### Error Handling

- Use `backend.ErrDataResponse()` for query errors
- Include actionable error messages
- Log errors with context
- Handle timeouts explicitly

### Caching

- Use mutex for thread-safe cache access
- Implement TTL (30 seconds recommended for autocomplete)
- Clean expired entries periodically
- Limit concurrent requests (5 recommended)

### Context Management

- Always use context for cancellation
- Set timeouts on API calls (2 seconds for autocomplete)
- Cancel in-flight requests on unmount
- Propagate context through call chain

## Testing

- Write unit tests for utilities and pure functions
- Write integration tests for components
- Test both light and dark themes
- Test keyboard and mouse interactions
- Test error scenarios

## Build Process

- Use Makefile for common tasks
- Support `make build`, `make test`, `make dev`, `make clean`
- Build both frontend (yarn) and backend (mage/go)
- Document all build commands in README

## Code Quality

- Use ESLint with @grafana/eslint-config
- Configure TypeScript strict mode
- Use React Hooks (not class components)
- Follow Grafana's naming conventions
- Add JSDoc comments for public APIs

## Performance

- Debounce user input (300-500ms for autocomplete)
- Limit suggestion count (100 max)
- Use React.memo for expensive components
- Implement virtualization for long lists
- Cache API responses appropriately

## Accessibility

- Support keyboard-only navigation
- Use proper ARIA labels
- Ensure sufficient color contrast
- Test with screen readers
- Follow WCAG 2.1 AA standards
