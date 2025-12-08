# Query Editor Autocomplete v2 - Refinements Spec

## Overview

This spec defines refinements and improvements to the existing autocomplete functionality in the Grafana Datadog datasource query editor. The v1 implementation provided basic autocomplete, but user testing revealed several UX issues and missing features.

## Issues Addressed

1. ✅ Mouse click selection doesn't work (only ENTER works)
2. ✅ Cmd+Enter executes query but doesn't clear autocomplete popup
3. ✅ Autocomplete popup is white-ish, not theme-aware (should match Grafana dark/light theme)
4. ✅ Autocomplete doesn't support grouping (metrics, aggregators, tags, etc.)
5. ✅ Autocomplete renders below query field, not at cursor position
6. ✅ Autocomplete options don't visually mark matched text (e.g., "conf" in "config")
7. ✅ Backend implementation needs review against Grafana best practices
8. ✅ Build process needs streamlining (Makefile)
9. ✅ ESLint configuration issues
10. ✅ Need to use native Grafana components (@grafana/ui)
11. ✅ Need syntax highlighting for Datadog queries

## Key Features

### Syntax Highlighting
- Custom Monaco language for Datadog queries
- Color-coded metrics, aggregators, tags, operators
- Both dark and light theme support

### Mouse Interaction
- Click to select suggestions
- Hover to highlight
- Focus maintained on input

### Theme Awareness
- Uses Grafana's useTheme2() hook
- Automatic light/dark theme support
- Dynamic theme switching

### Suggestion Grouping
- Categories: Aggregators, Metrics, Tags, Tag Values
- Group headers
- Keyboard navigation skips headers

### Cursor Positioning
- Popup appears at cursor location
- Viewport edge detection
- Dynamic repositioning

### Text Highlighting
- Matched portions emphasized
- Case-insensitive matching
- Theme-aware colors

### Native Components
- CodeEditor from @grafana/ui
- useTheme2() for theming
- Grafana's autocomplete patterns

## Files

- `requirements.md` - EARS-compliant requirements with 11 user stories
- `design.md` - Technical design with 11 correctness properties
- `tasks.md` - Implementation plan with 13 main tasks
- `README.md` - This file

## Implementation Approach

The implementation is divided into phases:

1. **Phase 1**: Syntax highlighting (Task 1)
2. **Phase 2**: Mouse interaction (Task 2)
3. **Phase 3**: Cmd+Enter handling (Task 3)
4. **Phase 4**: Theme support (Task 4)
5. **Phase 5**: Suggestion grouping (Task 5)
6. **Phase 6**: Cursor positioning (Task 6)
7. **Phase 7**: Text highlighting (Task 7)
8. **Phase 8**: Backend review (Task 8)
9. **Phase 9**: Build process (Task 10)
10. **Phase 10**: ESLint fixes (Task 11)
11. **Phase 11**: Documentation (Task 12)

## Testing Strategy

- Unit tests for utilities (parser, suggestions, highlighter)
- Integration tests for components (QueryEditor, useQueryAutocomplete)
- Backend tests for error handling and caching
- Manual testing checklist for all features

## Next Steps

To start implementing:

1. Open `tasks.md` in Kiro
2. Click "Start task" next to Task 1
3. Follow the implementation plan
4. Run tests after each task
5. Complete checkpoints (Tasks 9, 13)

## References

- [Grafana Plugin Development](https://grafana.com/docs/grafana/latest/developers/plugins/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [@grafana/ui Components](https://developers.grafana.com/ui)
- [Datadog Query Syntax](https://docs.datadoghq.com/dashboards/querying/)
