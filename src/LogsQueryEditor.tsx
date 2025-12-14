import React, { useRef, useState, useEffect } from 'react';
import { CodeEditor, Stack, Alert, useTheme2, Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery, CompletionItem } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';
import { registerDatadogLanguage } from './utils/autocomplete/syntaxHighlighter';
import { LogsQueryEditorHelp } from './LogsQueryEditorHelp';
import { validateLogsQuery } from './utils/logsQueryValidator';

type LogsQueryEditorProps = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

/**
 * LogsQueryEditor component for Datadog logs queries
 * Reuses existing CodeEditor component and autocomplete infrastructure
 * Requirements: 3.1, 3.2
 */
export function LogsQueryEditor({ query, onChange, onRunQuery, datasource, ...restProps }: LogsQueryEditorProps) {
  const theme = useTheme2();
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);
  
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
  // Simplified pagination state - rely on Grafana's built-in logs handling
  const [pageSize, setPageSize] = useState(query.pageSize || 100);
  const [currentPage, setCurrentPage] = useState(query.currentPage || 1);
  const [pageHistory, setPageHistory] = useState<{[page: number]: string}>({1: ''}); // Track cursors for each page

  // Ref to track autocomplete state for Monaco keyboard handler
  const autocompleteStateRef = useRef({ isOpen: false, selectedIndex: 0, suggestions: [] as CompletionItem[] });

  // Simplified cache management - rely on backend caching only
  const clearPageHistory = () => {
    setPageHistory({1: ''});
    console.log('🗑️ Page history cleared');
  };

  // Define handleItemSelect for logs-specific autocomplete
  const handleItemSelect = async (item: CompletionItem) => {
    console.log('=== LogsQueryEditor handleItemSelect START ===');
    
    // Get CURRENT values from Monaco editor
    let currentValue = '';
    let currentCursorPosition = 0;
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      const position = editorRef.current.getPosition();
      if (model && position) {
        currentValue = model.getValue();
        currentCursorPosition = model.getOffsetAt(position);
      }
    }

    console.log('LogsQueryEditor handleItemSelect called:', {
      itemKind: item.kind,
      itemLabel: item.label,
      currentValue,
      currentCursorPosition,
    });

    // For logs queries, we handle different types of suggestions
    let insertValue = item.insertText || item.label;
    let start = currentCursorPosition;
    let end = currentCursorPosition;

    // Handle logs-specific suggestion types (corrected to match actual suggestion kinds)
    if (item.kind === 'logs_service' || item.kind === 'logs_source' || item.kind === 'logs_level') {
      // For facet filters like service:web-app, source:nginx, status:ERROR
      const facetType = item.kind.replace('logs_', ''); // Remove logs_ prefix
      insertValue = `${facetType}:${insertValue}`;
      
      // Find token boundaries for replacement
      while (start > 0 && /[a-zA-Z0-9_.-]/.test(currentValue[start - 1])) {
        start--;
      }
      while (end < currentValue.length && /[a-zA-Z0-9_.-]/.test(currentValue[end])) {
        end++;
      }
    } else if (item.kind === 'logs_facet') {
      // For facet names like service:, source:, status:
      insertValue = item.insertText || item.label; // Should already include the colon
      
      // Find token boundaries for replacement
      while (start > 0 && /[a-zA-Z0-9_.-]/.test(currentValue[start - 1])) {
        start--;
      }
      while (end < currentValue.length && /[a-zA-Z0-9_.-]/.test(currentValue[end])) {
        end++;
      }
    } else {
      // Default behavior for other suggestion types (operators, etc.)
      while (start > 0 && /[a-zA-Z0-9_.-]/.test(currentValue[start - 1])) {
        start--;
      }
      while (end < currentValue.length && /[a-zA-Z0-9_.-]/.test(currentValue[end])) {
        end++;
      }
    }

    // Create new value with replacement
    const newValue = currentValue.substring(0, start) + insertValue + currentValue.substring(end);
    const newCursorPos = start + insertValue.length;

    console.log('LogsQueryEditor token replacement:', {
      original: currentValue,
      start,
      end,
      replacing: currentValue.substring(start, end),
      insertValue,
      result: newValue,
      itemKind: item.kind,
    });

    // Update the logs query
    onChange({ 
      ...query, 
      logQuery: newValue,
      queryType: 'logs' // Ensure query type is set to logs
    });

    // Set focus back to editor with new cursor position
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        const model = editorRef.current.getModel();
        if (model) {
          const position = model.getPositionAt(newCursorPos);
          editorRef.current.setPosition(position);
        }
      }
    }, 15);

    // Close autocomplete after selection
    autocomplete.onClose();
  };

  // Initialize autocomplete hook for logs context - FIXED: Added queryType parameter
  const autocomplete = useQueryAutocomplete({
    datasourceUid: datasource.uid || '',
    queryType: 'logs', // CRITICAL FIX: Specify logs query type
    onSelect: handleItemSelect
  });

  // Keep the ref updated with current autocomplete state
  useEffect(() => {
    autocompleteStateRef.current = {
      isOpen: autocomplete.state.isOpen,
      selectedIndex: autocomplete.state.selectedIndex,
      suggestions: autocomplete.state.suggestions,
    };
  }, [autocomplete.state.isOpen, autocomplete.state.selectedIndex, autocomplete.state.suggestions]);



  // Reset pagination state when query changes
  useEffect(() => {
    if (query.logQuery !== logQuery) {
      console.log('🗑️ Query changed, resetting pagination');
      setCurrentPage(1);
      setPageHistory({1: ''});
      onChange({
        ...query,
        currentPage: 1,
        nextCursor: '',
        queryType: 'logs'
      });
    }
  }, [query.logQuery]);

  // Update page history when nextCursor is received from backend
  useEffect(() => {
    if (query.nextCursor && currentPage >= 1) {
      // Store the cursor for the next page
      setPageHistory(prev => ({
        ...prev,
        [currentPage + 1]: query.nextCursor || ''
      }));
    }
  }, [query.nextCursor, currentPage]);

  // Sync local state with query state
  useEffect(() => {
    if (query.pageSize && query.pageSize !== pageSize) {
      setPageSize(query.pageSize);
    }
    if (query.currentPage && query.currentPage !== currentPage) {
      setCurrentPage(query.currentPage);
    }
  }, [query.pageSize, query.currentPage]);

  const onLogQueryChange = (newValue: string) => {
    // Validate the logs query
    const validation = validateLogsQuery(newValue);
    setValidationError(validation.isValid ? null : validation.error || null);
    setValidationWarnings(validation.warnings || []);

    // Update the logs query state
    onChange({ 
      ...query, 
      logQuery: newValue,
      queryType: 'logs' // Ensure query type is set to logs
    });

    // Get cursor position and trigger autocomplete
    setTimeout(() => {
      let cursorPos = 0;
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        const model = editorRef.current.getModel();
        if (position && model) {
          cursorPos = model.getOffsetAt(position);
        }
      }

      // Update suggestions position
      if (editorRef.current) {
        updateSuggestionsPositionFromEditor(editorRef.current, cursorPos);
      }

      // Trigger autocomplete for logs context
      autocomplete.onInput(newValue, cursorPos);
    }, 0);
  };

  // Handle example selection from help component
  const handleExampleClick = (exampleQuery: any) => {
    const newValue = exampleQuery.logQuery || '';
    
    // Update editor content
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        model.setValue(newValue);
      }
    }
    
    // Trigger change handler
    onLogQueryChange(newValue);
    
    // Close help panel
    setShowHelp(false);
  };

  // Helper function to calculate suggestions dropdown position
  const updateSuggestionsPositionFromEditor = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    cursorPosition: number
  ) => {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const position = model.getPositionAt(cursorPosition);
    const coords = editor.getScrolledVisiblePosition(position);
    if (!coords) {
      return;
    }

    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) {
      return;
    }

    const editorRect = editorDomNode.getBoundingClientRect();
    const top = window.scrollY + editorRect.top + coords.top + coords.height + 4;
    const left = window.scrollX + editorRect.left + coords.left;

    setSuggestionsPosition({ top, left });
  };

  const handleEditorDidMount = (editor: monacoType.editor.IStandaloneCodeEditor, monaco: typeof monacoType) => {
    // Store editor reference
    editorRef.current = editor;

    // Register Datadog language (reuse existing language registration)
    registerDatadogLanguage(monaco);

    // Set the theme based on Grafana theme
    monaco.editor.setTheme(theme.isDark ? 'datadog-dark' : 'datadog-light');

    // Add keyboard event listener for Cmd+Enter
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      autocomplete.onClose();
      onRunQuery();
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 0);
    });

    // Intercept keyboard events for autocomplete navigation
    editor.onKeyDown((e) => {
      if (!autocompleteStateRef.current.isOpen) {
        return;
      }

      switch (e.keyCode) {
        case monaco.KeyCode.UpArrow:
          e.preventDefault();
          e.stopPropagation();
          autocomplete.onNavigateUp();
          break;
        case monaco.KeyCode.DownArrow:
          e.preventDefault();
          e.stopPropagation();
          autocomplete.onNavigateDown();
          break;
        case monaco.KeyCode.Enter:
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            autocomplete.onSelectCurrent();
          }
          break;
        case monaco.KeyCode.Tab:
          e.preventDefault();
          e.stopPropagation();
          autocomplete.onSelectCurrent();
          break;
        case monaco.KeyCode.Escape:
          e.preventDefault();
          e.stopPropagation();
          autocomplete.onClose();
          break;
      }
    });

    // Track cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      const model = editor.getModel();
      if (model) {
        const offset = model.getOffsetAt(e.position);
        updateSuggestionsPositionFromEditor(editor, offset);
      }
    });
  };

  const { logQuery = '' } = query;

  return (
    <Stack gap={2} direction="column">
      {/* Logs Query field */}
      <InlineFieldRow>
        <InlineField 
          label="Logs Query" 
          labelWidth={14}
          grow
          tooltip="Enter your Datadog logs search query (e.g., service:web-app status:error)"
        >
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Help button positioned next to query field */}
            <div style={{ 
              position: 'absolute', 
              top: '-2px', 
              right: '0px', 
              zIndex: 10 
            }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowHelp(!showHelp)}
                icon={showHelp ? "angle-up" : "question-circle"}
              >
                {showHelp ? 'Hide Help' : 'Logs Syntax Help'}
              </Button>
            </div>
            
            <CodeEditor
              value={logQuery}
              language="datadog"
              height="100px"
              onBlur={() => {
                autocomplete.onClose();
              }}
              onSave={(value) => {
                onChange({ 
                  ...query, 
                  logQuery: value,
                  queryType: 'logs'
                });
              }}
              onChange={onLogQueryChange}
              onEditorDidMount={handleEditorDidMount}
              monacoOptions={{
                minimap: { enabled: false },
                lineNumbers: 'off',
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 0,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'none',
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                renderLineHighlight: 'none',
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
            />

            {/* Display validation error */}
            {validationError && (
              <Alert title="Logs Query Validation" severity="error" style={{ marginTop: '8px' }}>
                {validationError}
              </Alert>
            )}

            {/* Display validation warnings */}
            {validationWarnings.length > 0 && (
              <Alert title="Logs Query Suggestions" severity="warning" style={{ marginTop: '8px' }}>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {validationWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Display autocomplete validation error */}
            {autocomplete.state.validationError && (
              <Alert title="Logs Query Validation" severity="warning" style={{ marginTop: '8px' }}>
                {autocomplete.state.validationError}
              </Alert>
            )}

            {/* Display backend error */}
            {autocomplete.state.error && (
              <Alert title="Logs Autocomplete Error" severity="error" style={{ marginTop: '8px' }}>
                {autocomplete.state.error}
              </Alert>
            )}

            {/* Autocomplete popup */}
            {autocomplete.state.isOpen && autocomplete.state.suggestions.length > 0 && (
              <div
                style={{
                  position: 'fixed',
                  zIndex: 1000,
                  minWidth: '200px',
                  backgroundColor: theme.colors.background.primary,
                  border: `1px solid ${theme.colors.border.weak}`,
                  borderRadius: theme.shape.radius.default,
                  boxShadow: theme.shadows.z3,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.size.sm,
                  top: `${suggestionsPosition.top}px`,
                  left: `${suggestionsPosition.left}px`,
                }}
                className="logs-query-editor-suggestions"
              >
                {autocomplete.state.groupedSuggestions.length > 0 ? (
                  // Render grouped suggestions with headers
                  <div>
                    {autocomplete.state.groupedSuggestions.map((group, groupIndex) => (
                      <div key={groupIndex}>
                        {/* Group header */}
                        <div
                          style={{
                            padding: '4px 12px',
                            fontSize: theme.typography.size.xs,
                            fontWeight: theme.typography.fontWeightMedium,
                            color: theme.colors.text.secondary,
                            backgroundColor: theme.colors.background.secondary,
                            borderBottom: `1px solid ${theme.colors.border.weak}`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {group.label}
                        </div>
                        {/* Group suggestions */}
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                          {group.suggestions.map((suggestion) => {
                            const flatIndex = autocomplete.state.suggestions.findIndex(
                              (s) => s.label === suggestion.label
                            );
                            return (
                              <li
                                key={suggestion.label}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  autocomplete.onMouseClick(suggestion);
                                  setTimeout(() => {
                                    if (editorRef.current) {
                                      editorRef.current.focus();
                                    }
                                  }, 0);
                                }}
                                onMouseEnter={() => autocomplete.onMouseEnter(flatIndex)}
                                style={{
                                  padding: '6px 12px',
                                  cursor: 'pointer',
                                  backgroundColor:
                                    flatIndex === autocomplete.state.selectedIndex
                                      ? theme.colors.action.selected
                                      : theme.colors.background.primary,
                                  borderBottom: `1px solid ${theme.colors.border.weak}`,
                                  color: theme.colors.text.primary,
                                }}
                              >
                                {suggestion.label}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Fallback to flat list if no groups
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {autocomplete.state.suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          autocomplete.onMouseClick(suggestion);
                          setTimeout(() => {
                            if (editorRef.current) {
                              editorRef.current.focus();
                            }
                          }, 0);
                        }}
                        onMouseEnter={() => autocomplete.onMouseEnter(index)}
                        style={{
                          padding: '6px 12px',
                          cursor: 'pointer',
                          backgroundColor:
                            index === autocomplete.state.selectedIndex
                              ? theme.colors.action.selected
                              : theme.colors.background.primary,
                          borderBottom: `1px solid ${theme.colors.border.weak}`,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {suggestion.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Loading indicator */}
            {autocomplete.state.isLoading && (
              <div style={{
                position: 'absolute',
                right: '10px',
                top: '10px',
                fontSize: theme.typography.size.sm,
                color: theme.colors.text.secondary
              }}>
                Loading...
              </div>
            )}
          </div>
        </InlineField>
      </InlineFieldRow>

      {/* Pagination Controls */}
      <InlineFieldRow>
        <InlineField 
          label="Page Size" 
          labelWidth={14}
          tooltip="Number of log entries to fetch per page (default: 100, max: 1000)"
        >
          <Input
            type="number"
            value={pageSize}
            min={10}
            max={1000}
            step={10}
            width={10}
            onChange={(e) => {
              const newPageSize = Math.max(10, Math.min(1000, parseInt(e.currentTarget.value) || 100));
              setPageSize(newPageSize);
              setCurrentPage(1); // Reset to first page when page size changes
              setPageHistory({1: ''}); // Reset page history
              onChange({ 
                ...query, 
                pageSize: newPageSize,
                currentPage: 1,
                nextCursor: '', // Reset cursor when page size changes
                queryType: 'logs'
              });
            }}
            onBlur={() => {
              // Trigger query execution when page size changes
              console.log(`📡 Executing query for page 1 (page size changed)`);
              onRunQuery();
            }}
          />
        </InlineField>
        
        <InlineField 
          label="Page" 
          labelWidth={8}
          tooltip="Current page number"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon="angle-left"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1);
                const cursor = pageHistory[newPage] || '';
                
                setCurrentPage(newPage);
                console.log(`📡 Navigating to page ${newPage}`);
                onChange({ 
                  ...query, 
                  currentPage: newPage,
                  nextCursor: cursor,
                  queryType: 'logs'
                });
                onRunQuery();
              }}
            />
            
            <Input
              type="number"
              value={currentPage}
              min={1}
              max={999}
              width={8}
              onChange={(e) => {
                const newPage = Math.max(1, parseInt(e.currentTarget.value) || 1);
                setCurrentPage(newPage);
                const cursor = pageHistory[newPage] || '';
                onChange({ 
                  ...query, 
                  currentPage: newPage,
                  nextCursor: cursor,
                  queryType: 'logs'
                });
              }}
              onBlur={() => {
                // Trigger query execution when page number changes
                console.log(`📡 Executing query for page ${currentPage} (manual input)`);
                onRunQuery();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  console.log(`📡 Executing query for page ${currentPage} (Enter key)`);
                  onRunQuery();
                }
              }}
            />
            
            <span style={{ 
              fontSize: theme.typography.size.sm, 
              color: theme.colors.text.secondary,
              whiteSpace: 'nowrap'
            }}>
              {`of ${currentPage}+`}
            </span>
            
            <Button
              variant="secondary"
              size="sm"
              icon="angle-right"
              aria-label="Next page"
              onClick={() => {
                const newPage = currentPage + 1;
                
                setCurrentPage(newPage);
                console.log(`📡 Navigating to page ${newPage}`);
                onChange({ 
                  ...query, 
                  currentPage: newPage,
                  nextCursor: pageHistory[newPage] || '',
                  queryType: 'logs'
                });
                onRunQuery();
              }}
            />
          </div>
        </InlineField>
      </InlineFieldRow>

      {/* Logs Help Component */}
      {showHelp && (
        <LogsQueryEditorHelp onClickExample={handleExampleClick} />
      )}
    </Stack>
  );
}