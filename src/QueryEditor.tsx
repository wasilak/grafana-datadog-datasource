import React, { ChangeEvent, useRef, useState, useEffect } from 'react';
import { Input, CodeEditor, Stack, Alert, useTheme2, Button, Icon, Select, InlineField, InlineFieldRow, Collapse } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery, CompletionItem } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';
import { registerDatadogLanguage } from './utils/autocomplete/syntaxHighlighter';
import { QueryEditorHelp } from './QueryEditorHelp';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

/**
 * Helper function to check if a query contains variable placeholders
 * @param queryText - The query text to check
 * @returns True if the query contains variables
 */
function hasVariablePlaceholders(queryText: string): boolean {
  if (!queryText) return false;
  // Check for both ${variable:format} and $variable patterns
  return /\$\{[^}]+\}|\$[a-zA-Z_][a-zA-Z0-9_]*/.test(queryText);
}

/**
 * Helper function to extract variable names from a query
 * @param queryText - The query text to analyze
 * @returns Array of variable names found
 */
function extractVariableNames(queryText: string): string[] {
  if (!queryText) return [];
  
  const variables: string[] = [];
  
  // Extract from ${variable:format} patterns
  const formatMatches = queryText.match(/\$\{([^}:]+):[^}]+\}/g);
  if (formatMatches) {
    formatMatches.forEach(match => {
      const varName = match.match(/\$\{([^}:]+):/)?.[1];
      if (varName && !variables.includes(varName)) {
        variables.push(varName);
      }
    });
  }
  
  // Extract from $variable patterns
  const simpleMatches = queryText.match(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g);
  if (simpleMatches) {
    simpleMatches.forEach(match => {
      const varName = match.substring(1); // Remove the $
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    });
  }
  
  return variables;
}

export function QueryEditor({ query, onChange, onRunQuery, datasource, ...restProps }: Props) {
  const theme = useTheme2();
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);
  
  // Detect if we're in Explore mode
  const isExploreMode = window.location.pathname.includes('/explore') || 
                       (restProps as any).app === 'explore' ||
                       (restProps as any).context === 'explore';
  
  console.log('QueryEditor mode detection:', {
    pathname: window.location.pathname,
    isExploreMode,
    restProps: Object.keys(restProps as any),
  });

  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Legend mode options
  const legendModeOptions: Array<SelectableValue<'auto' | 'custom'>> = [
    { label: 'Auto', value: 'auto', description: 'Only includes unique labels' },
    { label: 'Custom', value: 'custom', description: 'Provide a naming template' },
  ];
  
  // Ref to track autocomplete state for Monaco keyboard handler
  const autocompleteStateRef = useRef({ isOpen: false, selectedIndex: 0, suggestions: [] as CompletionItem[] });

  // Define handleItemSelect before the hook initialization to avoid circular dependency
  const handleItemSelect = async (item: CompletionItem) => {
    console.log('=== handleItemSelect START ===');
    
    // Get CURRENT values from Monaco editor (not from React state which may be stale)
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

    console.log('handleItemSelect called:', {
      itemKind: item.kind,
      itemLabel: item.label,
      currentValue,
      currentCursorPosition,
    });

    // Call backend to compute the completion
    try {
      const response = await getBackendSrv()
        .fetch({
          url: `/api/datasources/uid/${datasource.uid}/resources/autocomplete/complete`,
          method: 'POST',
          data: {
            query: currentValue,
            cursorPosition: currentCursorPosition,
            selectedItem: item.insertText || item.label,
            itemKind: item.kind || 'unknown',
          },
        })
        .toPromise();

      const result = (response as any).data as { newQuery: string; newCursorPosition: number };
      
      console.log('Backend completion result:', result);

      // Update the query with the backend result, preserving Explore mode metadata
      onChange({ ...enhancedQuery, queryText: result.newQuery });

      // Set cursor position after a delay to ensure React has updated
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          const model = editorRef.current.getModel();
          if (model) {
            const position = model.getPositionAt(result.newCursorPosition);
            editorRef.current.setPosition(position);
          }

        }
      }, 15);

      // Close autocomplete after selection
      autocomplete.onClose();
      return;
    } catch (error) {
      console.error('Backend completion failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fall back to old logic if backend fails
    }

    // Format the insertion based on the type of suggestion
    let insertValue = item.insertText || item.label;

    // Calculate where to insert the value - find the current token
    let start = currentCursorPosition;
    let end = currentCursorPosition;

    // Special handling for metrics - replace entire query
    if (item.kind === 'metric') {
      insertValue = `avg:${insertValue}{*}`;
      start = 0;
      end = currentValue.length;
    }
    // If it's an aggregator suggestion, add the colon
    else if (item.kind === 'aggregator') {
      // For aggregators, add colon to form the complete aggregator: format
      insertValue = `${insertValue}:`;
    }

    // Check if we're in a grouping context (inside "by {}")
    const byMatch = currentValue.match(/\s+by\s+\{/);
    let inGroupingContext = false;
    if (byMatch) {
      const byBraceStart = byMatch.index! + byMatch[0].length - 1; // Position of '{'
      const closeBraceAfterBy = currentValue.indexOf('}', byBraceStart);
      // Cursor must be after '{' and before '}' (or no closing brace yet)
      inGroupingContext = currentCursorPosition > byBraceStart && 
                         (closeBraceAfterBy === -1 || currentCursorPosition <= closeBraceAfterBy);
      
      console.log('Grouping context check:', {
        byMatch: byMatch[0],
        byBraceStart,
        closeBraceAfterBy,
        currentCursorPosition,
        inGroupingContext,
        itemKind: item.kind,
      });
    }

    // For grouping_tag context, ALWAYS use the grouping logic
    if (item.kind === 'grouping_tag') {
      console.log('Grouping tag selected:', {
        currentValue,
        currentCursorPosition,
        byMatch: byMatch ? byMatch[0] : null,
        insertValue,
      });
      
      // Force grouping context handling
      if (byMatch) {
        const byBraceStart = byMatch.index! + byMatch[0].length - 1;
        const closeBraceAfterBy = currentValue.indexOf('}', byBraceStart);
        const groupingEnd = closeBraceAfterBy === -1 ? currentValue.length : closeBraceAfterBy;
        
        const groupingContent = currentValue.substring(byBraceStart + 1, groupingEnd);
        const relativePos = currentCursorPosition - (byBraceStart + 1);
        
        console.log('Grouping tag (forced):', {
          byBraceStart,
          closeBraceAfterBy,
          groupingEnd,
          groupingContent,
          relativePos,
          insertValue,
        });
        
        // Always insert at current position for grouping tags
        start = currentCursorPosition;
        end = currentCursorPosition;
        
        // Add comma if there's already content and we're not right after a comma
        if (groupingContent.trim().length > 0 && relativePos > 0 && groupingContent[relativePos - 1] !== ',') {
          insertValue = ',' + insertValue;
        }
      } else {
        console.error('Grouping tag selected but no byMatch found!');
        // Fallback: insert at cursor position
        start = currentCursorPosition;
        end = currentCursorPosition;
      }
    }
    // For aggregator context, we need to handle the colon specially
    else if (item.kind === 'aggregator') {
      // Find the aggregator part (before the colon or end)
      while (start > 0 && /[a-zA-Z0-9_]/.test(currentValue[start - 1])) {
        start--;
      }

      // Find the end of the aggregator part (stop at non-aggregator characters)
      while (end < currentValue.length && /[a-zA-Z0-9_]/.test(currentValue[end])) {
        end++;
      }

      // If there's a colon immediately after, include it in the replacement range
      if (end < currentValue.length && currentValue[end] === ':') {
        end++; // Include the colon in the token to be replaced
      }
    } else if (inGroupingContext && byMatch) {
      // For grouping tags: find the "by {}" section and work ONLY within it
      const byBraceStart = byMatch.index! + byMatch[0].length - 1; // Position of '{'
      const closeBraceAfterBy = currentValue.indexOf('}', byBraceStart);
      const groupingEnd = closeBraceAfterBy === -1 ? currentValue.length : closeBraceAfterBy;
      
      // Get content inside braces
      const groupingContent = currentValue.substring(byBraceStart + 1, groupingEnd);
      const relativePos = currentCursorPosition - (byBraceStart + 1);
      
      console.log('Grouping tag replacement:', {
        groupingContent,
        relativePos,
        byBraceStart,
        groupingEnd,
      });
      
      // Check if cursor is right after comma or at start
      if (relativePos === 0 || (relativePos > 0 && groupingContent[relativePos - 1] === ',')) {
        // Insert mode - just insert at current position
        start = currentCursorPosition;
        end = currentCursorPosition;
        console.log('Insert mode - cursor after comma or at start');
      } else {
        // Find token boundaries within grouping section
        let tokenStart = relativePos;
        let tokenEnd = relativePos;
        
        // Move backwards to find start (stop at comma or beginning)
        while (tokenStart > 0 && groupingContent[tokenStart - 1] !== ',') {
          tokenStart--;
        }
        
        // Move forwards to find end (stop at comma or end)
        while (tokenEnd < groupingContent.length && groupingContent[tokenEnd] !== ',') {
          tokenEnd++;
        }
        
        const currentToken = groupingContent.substring(tokenStart, tokenEnd).trim();
        
        console.log('Token boundaries:', {
          tokenStart,
          tokenEnd,
          currentToken,
        });
        
        // If cursor is at end of token, append with comma
        if (currentToken.length > 0 && relativePos === tokenEnd) {
          start = currentCursorPosition;
          end = currentCursorPosition;
          insertValue = ',' + insertValue;
          console.log('Append mode - adding comma');
        } else {
          // Replace the token
          start = byBraceStart + 1 + tokenStart;
          end = byBraceStart + 1 + tokenEnd;
          console.log('Replace mode - replacing token');
        }
      }
    } else {
      // Default behavior for other contexts
      // Move backwards to find token start (stop at whitespace, colon, comma, brace, etc.)
      while (start > 0 && /[a-zA-Z0-9_.-]/.test(currentValue[start - 1])) {
        start--;
      }

      // Move forwards to find token end
      while (end < currentValue.length && /[a-zA-Z0-9_.-]/.test(currentValue[end])) {
        end++;
      }
    }

    // Create new value with replacement
    const newValue = currentValue.substring(0, start) + insertValue + currentValue.substring(end);

    // Debug log to understand what's being replaced
    console.log('Token replacement:', {
      original: currentValue,
      start,
      end,
      replacing: currentValue.substring(start, end),
      insertValue,
      result: newValue,
      inGroupingContext,
      itemKind: item.kind,
    });

    // Store the desired cursor position before the state update
    const newCursorPos = start + insertValue.length;

    // Update the query, preserving Explore mode metadata
    onChange({ ...enhancedQuery, queryText: newValue });

    // Set focus back to editor with new cursor position after a slight delay
    // to ensure React has updated the DOM
    setTimeout(() => {
      if (editorRef.current) {
        // Focus the editor first
        editorRef.current.focus();

        // Set the cursor position in Monaco editor
        const model = editorRef.current.getModel();
        if (model) {
          const position = model.getPositionAt(newCursorPos);
          editorRef.current.setPosition(position);
        }


      }
      // Do NOT run query automatically after insertion - user decides when to run
      // This prevents re-rendering that moves cursor to end
      // onRunQuery();
    }, 15); // Slightly longer delay to ensure DOM update

    // Close autocomplete after selection
    autocomplete.onClose();
  };

  // Initialize autocomplete hook with datasource UID and selection callback
  const autocomplete = useQueryAutocomplete({
    datasourceUid: datasource.uid || '',
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

  const onQueryTextChange = (newValue: string) => {
    // Update the query state first, preserving Explore mode metadata
    onChange({ ...enhancedQuery, queryText: newValue });

    // Get cursor position AFTER the text change by using setTimeout
    // This ensures Monaco has updated its internal state
    setTimeout(() => {
      let cursorPos = 0;
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        const model = editorRef.current.getModel();
        if (position && model) {
          cursorPos = model.getOffsetAt(position);
        }
      }



      // Update the cursor position in the UI (for suggestions positioning)
      if (editorRef.current) {
        updateSuggestionsPositionFromEditor(editorRef.current, cursorPos);
      }

      // Trigger autocomplete with current query text and cursor position
      autocomplete.onInput(newValue, cursorPos);
    }, 0);
  };

  const onLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...enhancedQuery, label: event.target.value });
    // Don't run query automatically when label changes
  };

  const onLabelKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) for query execution
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onRunQuery();
    }
  };

  const onLegendModeChange = (option: SelectableValue<'auto' | 'custom'>) => {
    const newMode = option.value || 'auto';
    onChange({ 
      ...enhancedQuery, 
      legendMode: newMode,
      // Clear template when switching to auto
      legendTemplate: newMode === 'auto' ? '' : enhancedQuery.legendTemplate || ''
    });
  };

  const onLegendTemplateChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...enhancedQuery, legendTemplate: event.target.value });
  };

  const onLegendTemplateKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) for query execution
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onRunQuery();
    }
  };

  // Helper function to calculate and update the position for suggestions dropdown
  const updateSuggestionsPositionFromEditor = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    cursorPosition: number
  ) => {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    // Get the position from offset
    const position = model.getPositionAt(cursorPosition);

    // Get the DOM node for the editor
    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) {
      return;
    }

    // Get the coordinates for the cursor position
    const coords = editor.getScrolledVisiblePosition(position);
    if (!coords) {
      return;
    }

    // Get the editor's bounding rectangle
    const editorRect = editorDomNode.getBoundingClientRect();

    // Calculate absolute position
    const top = window.scrollY + editorRect.top + coords.top + coords.height + 4;
    const left = window.scrollX + editorRect.left + coords.left;

    setSuggestionsPosition({
      top: top,
      left: left,
    });
  };

  const handleEditorDidMount = (editor: monacoType.editor.IStandaloneCodeEditor, monaco: typeof monacoType) => {
    // Store editor reference
    editorRef.current = editor;

    // Register Datadog language
    registerDatadogLanguage(monaco);

    // Set the theme based on Grafana theme
    monaco.editor.setTheme(theme.isDark ? 'datadog-dark' : 'datadog-light');

    // Add keyboard event listener for Cmd+Enter
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // Close autocomplete popup before query execution (Requirements 2.2)
      autocomplete.onClose();
      
      // Execute the query
      onRunQuery();
      
      // Maintain focus on CodeEditor (Requirements 2.3)
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 0);
    });

    // Intercept keyboard events to handle autocomplete navigation
    editor.onKeyDown((e) => {
      // Only intercept if autocomplete is open (use ref to get current state)
      if (!autocompleteStateRef.current.isOpen) {
        return;
      }

      // Handle autocomplete navigation directly to avoid stale closure issues
      // Prevent default IMMEDIATELY for keys we want to intercept
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
          // Don't handle plain Enter with Cmd/Ctrl - that's for query execution
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

  const { queryText, label, legendMode = 'auto', legendTemplate = '' } = query;

  // Add visualization type hints for Explore mode
  const enhancedQuery = isExploreMode ? {
    ...query,
    // Add metadata for Explore mode visualization hints
    meta: {
      ...query.meta,
      preferredVisualisationType: 'graph' as const, // Default to graph for time series data
      exploreMode: true,
    }
  } : query;

  return (
    <Stack gap={2} direction="column">
      {/* Query field with native Grafana styling */}
      <InlineFieldRow>
        <InlineField 
          label="Query" 
          labelWidth={14}
          grow
          tooltip="Enter your Datadog query"
        >
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: theme.spacing(0.5)
            }}>
              <div style={{ flex: 1 }} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowHelp(!showHelp)}
                icon={showHelp ? "angle-up" : "question-circle"}
              >
                {showHelp ? 'Hide Help' : 'Variable Examples'}
              </Button>
            </div>

            <CodeEditor
              value={queryText || ''}
              language="datadog"
              height="100px"
              onBlur={(value) => {
                // Close autocomplete when editor loses focus
                autocomplete.onClose();
              }}
              onSave={(value) => {
                // Update query when user saves (Cmd+S), preserving Explore mode metadata
                onChange({ ...enhancedQuery, queryText: value });
              }}
              onChange={onQueryTextChange}
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
            {autocomplete.state.validationError && (
              <Alert title="Query Validation" severity="warning" style={{ marginTop: '8px' }}>
                {autocomplete.state.validationError}
              </Alert>
            )}

            {/* Display variable information */}
            {hasVariablePlaceholders(queryText || '') && (
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: theme.colors.background.secondary,
                border: `1px solid ${theme.colors.border.weak}`,
                borderRadius: theme.shape.radius.default,
                fontSize: theme.typography.size.sm,
                color: theme.colors.text.secondary
              }}>
                <Icon name="info-circle" size="sm" style={{ marginRight: '4px' }} />
                Variables detected: {extractVariableNames(queryText || '').join(', ')}
                <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                  (Variables will be interpolated when query executes)
                </span>
              </div>
            )}

            {/* Display backend error */}
            {autocomplete.state.error && (
              <Alert title="Autocomplete Error" severity="error" style={{ marginTop: '8px' }}>
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
                className="query-field-query-editor-suggestions"
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
                            // Find the index in the flat suggestions array for selection state
                            const flatIndex = autocomplete.state.suggestions.findIndex(
                              (s) => s.label === suggestion.label
                            );
                            return (
                              <li
                                key={suggestion.label}
                                onMouseDown={(e) => {
                                  // Prevent default to avoid losing focus from editor
                                  e.preventDefault();
                                  autocomplete.onMouseClick(suggestion);
                                  // Ensure focus returns to editor after click
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
                          // Prevent default to avoid losing focus from editor
                          e.preventDefault();
                          autocomplete.onMouseClick(suggestion);
                          // Ensure focus returns to editor after click
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

      {/* Variable Help Component */}
      {showHelp && (
        <QueryEditorHelp 
          onClickExample={(exampleQuery) => {
            onChange({ ...query, ...exampleQuery });
            setShowHelp(false); // Hide help after selecting an example
          }} 
        />
      )}

      {/* Options Section - Collapsible */}
      <Collapse 
        label="Options" 
        isOpen={optionsOpen} 
        onToggle={() => setOptionsOpen(!optionsOpen)}
      >
        <InlineFieldRow>
          <InlineField 
            label="Legend" 
            labelWidth={14}
            tooltip="Configure how series names are displayed in the legend"
          >
            <Select
              options={legendModeOptions}
              value={legendModeOptions.find(opt => opt.value === legendMode)}
              onChange={onLegendModeChange}
              width={20}
              placeholder="Select legend mode"
            />
          </InlineField>
        </InlineFieldRow>

        {/* Custom legend template field - only show when Custom is selected */}
        {legendMode === 'custom' && (
          <InlineFieldRow>
            <InlineField 
              label="" 
              labelWidth={14}
              grow
            >
              <Input
                value={legendTemplate}
                onChange={onLegendTemplateChange}
                onKeyDown={onLegendTemplateKeyDown}
                placeholder="e.g., {{label_name}}"
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </Collapse>
    </Stack>
  );
}
