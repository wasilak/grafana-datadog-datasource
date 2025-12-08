# Implementation Plan: Query Editor Autocomplete (v2 - Refinements)

- [x] 1. Migrate to Grafana CodeEditor with syntax highlighting
  - Replace custom TextArea with @grafana/ui CodeEditor component
  - Register custom Monaco language for Datadog queries
  - Implement tokenization for metrics, aggregators, tags, operators
  - Define dark and light theme color schemes
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 1.1 Create syntax highlighter utility
  - File: src/utils/autocomplete/syntaxHighlighter.ts (new)
  - Implement registerDatadogLanguage() function
  - Define Monaco tokenizer rules for Datadog syntax
  - Define theme colors for dark and light modes
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 1.2 Update QueryEditor to use CodeEditor
  - File: src/QueryEditor.tsx (modify)
  - Replace TextArea with CodeEditor component
  - Call registerDatadogLanguage() on mount
  - Configure Monaco options (no minimap, no line numbers)
  - Maintain existing onChange and onRunQuery handlers
  - _Requirements: 11.1, 10.1, 10.2_

- [ ]* 1.3 Write unit tests for syntax highlighter
  - File: tests/utils/autocomplete/syntaxHighlighter.test.ts (new)
  - Test tokenization of various Datadog queries
  - Test all token types are recognized
  - Test edge cases (empty query, special characters)
  - _Requirements: 11.1_

- [x] 2. Add mouse interaction support
  - Implement click handlers for suggestion selection
  - Add hover state management
  - Ensure focus remains on input after selection
  - Close popup on selection
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.1 Add mouse event handlers to useQueryAutocomplete hook
  - File: src/hooks/useQueryAutocomplete.ts (modify)
  - Add onMouseEnter(index: number) handler
  - Add onMouseClick(item: CompletionItem) handler
  - Add hoveredIndex to state
  - Update selectedIndex on hover
  - _Requirements: 1.4_

- [x] 2.2 Update QueryEditor with mouse handlers
  - File: src/QueryEditor.tsx (modify)
  - Add onClick handler to suggestion list items
  - Add onMouseEnter handler to suggestion list items
  - Ensure focus returns to CodeEditor after click
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 2.3 Write property test for mouse click insertion
  - File: tests/components/QueryEditor.test.tsx (modify)
  - **Property 1: Mouse click inserts suggestion correctly**
  - **Validates: Requirements 1.1, 1.2**

- [ ]* 2.4 Write property test for focus maintenance
  - File: tests/components/QueryEditor.test.tsx (modify)
  - **Property 2: Mouse click maintains focus**
  - **Validates: Requirements 1.3**

- [ ]* 2.5 Write property test for hover highlighting
  - File: tests/components/QueryEditor.test.tsx (modify)
  - **Property 3: Hover highlights suggestion**
  - **Validates: Requirements 1.4**

- [x] 3. Implement Cmd+Enter popup dismissal
  - Close autocomplete popup when query is executed
  - Maintain focus on input field
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.1 Update keyboard handler in useQueryAutocomplete
  - File: src/hooks/useQueryAutocomplete.ts (modify)
  - Detect Cmd+Enter / Ctrl+Enter in onKeyDown
  - Close popup before query execution
  - _Requirements: 2.1_

- [x] 3.2 Update QueryEditor handleRunQuery
  - File: src/QueryEditor.tsx (modify)
  - Ensure popup closes before onRunQuery is called
  - Maintain focus on CodeEditor
  - _Requirements: 2.2, 2.3_

- [x] 4. Implement theme-aware styling using Grafana hooks
  - Use useTheme2() hook for theme detection
  - Apply theme colors to autocomplete popup
  - Support dynamic theme switching
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.1 Update QueryEditor with theme support
  - File: src/QueryEditor.tsx (modify)
  - Import and use useTheme2() hook
  - Apply theme.colors to popup styling
  - Use theme.isDark for conditional styling
  - Remove hardcoded color values
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 5. Implement suggestion grouping
  - Group suggestions by category (metrics, aggregators, tags, tag_values)
  - Render group headers
  - Skip headers in keyboard navigation
  - Hide empty groups
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5.1 Create grouping utility function
  - File: src/utils/autocomplete/suggestions.ts (modify)
  - Implement groupSuggestions() function
  - Define category order (aggregators, metrics, tags, tag_values)
  - Filter out empty groups
  - _Requirements: 4.1, 4.2, 4.4_

- [-] 5.2 Update useQueryAutocomplete to use grouped suggestions
  - File: src/hooks/useQueryAutocomplete.ts (modify)
  - Call groupSuggestions() after fetching
  - Store groupedSuggestions in state
  - Update keyboard navigation to skip headers
  - _Requirements: 4.3_

- [ ] 5.3 Update QueryEditor to render grouped suggestions
  - File: src/QueryEditor.tsx (modify)
  - Render group headers
  - Render suggestions under each group
  - Style headers distinctly from suggestions
  - _Requirements: 4.1, 4.2_

- [ ]* 5.4 Write property test for grouping
  - File: tests/utils/autocomplete/suggestions.test.ts (modify)
  - **Property 4: Grouped suggestions maintain category order**
  - **Validates: Requirements 4.1, 4.2**

- [ ]* 5.5 Write property test for keyboard navigation with groups
  - File: tests/hooks/useQueryAutocomplete.test.ts (modify)
  - **Property 5: Keyboard navigation skips headers**
  - **Validates: Requirements 4.3**

- [ ]* 5.6 Write property test for empty group filtering
  - File: tests/utils/autocomplete/suggestions.test.ts (modify)
  - **Property 6: Empty groups are hidden**
  - **Validates: Requirements 4.4**

- [ ] 6. Implement cursor-position-based popup placement
  - Calculate popup position based on cursor location
  - Handle viewport edge cases (bottom, right)
  - Update position as cursor moves
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6.1 Create position calculator utility
  - File: src/hooks/useQueryAutocomplete.ts (modify)
  - Implement calculatePosition() function
  - Calculate line and character position
  - Detect viewport edges
  - Return PopupPosition with placement
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6.2 Update QueryEditor to use calculated position
  - File: src/QueryEditor.tsx (modify)
  - Call calculatePosition() on input change
  - Apply position to popup styling
  - Handle above/below placement
  - _Requirements: 5.1, 5.4_

- [ ]* 6.3 Write property test for popup positioning
  - File: tests/hooks/useQueryAutocomplete.test.ts (modify)
  - **Property 7: Popup positions at cursor**
  - **Validates: Requirements 5.1, 5.4**

- [ ] 7. Implement matched text highlighting
  - Highlight the portion of suggestions matching user input
  - Support case-insensitive matching
  - Handle matches at beginning, middle, end
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7.1 Create text highlighter utility
  - File: src/utils/autocomplete/highlighter.ts (new)
  - Implement highlightMatch() function
  - Implement renderHighlightedText() function
  - Support case-insensitive matching
  - _Requirements: 6.1, 6.3, 6.4_

- [ ] 7.2 Update QueryEditor to render highlighted suggestions
  - File: src/QueryEditor.tsx (modify)
  - Call highlightMatch() for each suggestion
  - Render highlighted text with distinct styling
  - Use theme colors for highlight
  - _Requirements: 6.1, 6.2_

- [ ]* 7.3 Write property test for text highlighting
  - File: tests/utils/autocomplete/highlighter.test.ts (new)
  - **Property 8: Matched text is highlighted**
  - **Validates: Requirements 6.1, 6.3, 6.4**

- [ ] 8. Review and improve backend implementation
  - Enhance error handling with structured responses
  - Improve timeout management
  - Ensure thread-safe caching
  - Follow Grafana plugin SDK patterns
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 8.1 Review backend error handling
  - File: pkg/plugin/datasource.go (review and modify)
  - Ensure all errors return structured responses
  - Add proper HTTP status codes
  - Include actionable error messages
  - _Requirements: 7.4_

- [ ] 8.2 Review backend timeout handling
  - File: pkg/plugin/datasource.go (review and modify)
  - Verify 2-second timeout is enforced
  - Ensure context cancellation works correctly
  - Add timeout error messages
  - _Requirements: 7.2_

- [ ] 8.3 Review backend cache implementation
  - File: pkg/plugin/datasource.go (review and modify)
  - Verify mutex usage is correct
  - Ensure TTL is respected
  - Test concurrent access patterns
  - _Requirements: 7.3_

- [ ]* 8.4 Write backend error handling tests
  - File: pkg/plugin/datasource_test.go (new or modify)
  - **Property 9: Backend error handling returns structured responses**
  - **Validates: Requirements 7.2, 7.4**

- [ ]* 8.5 Write backend cache tests
  - File: pkg/plugin/datasource_test.go (new or modify)
  - **Property 10: Cache is thread-safe with TTL**
  - **Validates: Requirements 7.3**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Run all unit and integration tests
  - Fix any failing tests
  - Verify all features work together
  - Ask user if questions arise

- [ ] 10. Create streamlined Makefile
  - Add build, test, dev, clean, install, lint targets
  - Support both frontend and backend builds
  - Document all commands
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 10.1 Create Makefile
  - File: Makefile (new or modify)
  - Add `make build` for full build
  - Add `make test` for all tests
  - Add `make dev` for development mode
  - Add `make clean` for cleanup
  - Add `make install` for dependencies
  - Add `make lint` for linting
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 10.2 Document Makefile usage
  - File: README.md (modify)
  - Document all make targets
  - Add examples of common workflows
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 11. Fix ESLint configuration
  - Configure TypeScript-aware rules
  - Configure React-aware rules
  - Fix any configuration errors
  - Add pre-commit hooks
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 11.1 Update ESLint configuration
  - File: .eslintrc.js (modify)
  - Extend @grafana/eslint-config
  - Configure @typescript-eslint parser
  - Add React and React Hooks plugins
  - Set appropriate rules
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 11.2 Add pre-commit hooks
  - File: package.json (modify)
  - Add husky for git hooks
  - Add lint-staged for pre-commit linting
  - Configure to run ESLint on staged files
  - _Requirements: 9.4_

- [ ] 12. Final testing and documentation
  - Run full test suite
  - Test all features manually
  - Update documentation
  - Create changelog entry
  - _Requirements: All_

- [ ] 12.1 Manual testing checklist
  - Test mouse click selection
  - Test Cmd+Enter popup dismissal
  - Test theme switching (light/dark)
  - Test suggestion grouping
  - Test cursor positioning
  - Test text highlighting
  - Test syntax highlighting
  - Test on different browsers
  - Test on different screen sizes

- [ ] 12.2 Update documentation
  - File: docs/autocomplete.md (modify)
  - Document new features
  - Add screenshots
  - Document keyboard shortcuts
  - Document syntax highlighting
  - _Requirements: All_

- [ ] 12.3 Create changelog entry
  - File: CHANGELOG.md (modify)
  - Document all new features
  - Document bug fixes
  - Document breaking changes (if any)
  - _Requirements: All_

- [ ] 13. Final Checkpoint - Ensure all tests pass
  - Run all tests one final time
  - Verify no regressions
  - Confirm all requirements met
  - Ask user if questions arise
