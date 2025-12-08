import React, { ChangeEvent, useRef, useState } from 'react';
import { Input, CodeEditor, Stack, Alert, useTheme2 } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery, CompletionItem } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';
import { registerDatadogLanguage } from './utils/autocomplete/syntaxHighlighter';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const theme = useTheme2();
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0 });

  // Define handleItemSelect before the hook initialization to avoid circular dependency
  const handleItemSelect = (item: CompletionItem) => {
    // Get current state values
    const currentValue = query.queryText || '';
    const currentCursorPosition = cursorPosition;

    // Format the insertion based on the type of suggestion
    let insertValue = item.insertText || item.label;

    // If it's a metric suggestion, format it properly for Datadog
    if (item.kind === 'metric') {
      // For metrics, use a standard format like avg:metric.name{*}
      insertValue = `avg:${insertValue}{*}`;
    }
    // If it's an aggregator suggestion, add the colon
    else if (item.kind === 'aggregator') {
      // For aggregators, add colon to form the complete aggregator: format
      insertValue = `${insertValue}:`;
    }

    // Calculate where to insert the value - find the current token
    let start = currentCursorPosition;
    let end = currentCursorPosition;

    // For aggregator context, we need to handle the colon specially
    if (item.kind === 'aggregator') {
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

    // Store the desired cursor position before the state update
    const newCursorPos = start + insertValue.length;

    // Update the query
    onChange({ ...query, queryText: newValue });

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

        // Update the local state to track the new cursor position
        setCursorPosition(newCursorPos);
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

  const onQueryTextChange = (newValue: string) => {
    // Get cursor position from Monaco editor
    let cursorPosBefore = 0;
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      const model = editorRef.current.getModel();
      if (position && model) {
        cursorPosBefore = model.getOffsetAt(position);
      }
    }

    // Update the query state
    onChange({ ...query, queryText: newValue });

    // Store cursor position for autocomplete
    setCursorPosition(cursorPosBefore);

    // Update the cursor position in the UI (for suggestions positioning)
    if (editorRef.current) {
      updateSuggestionsPositionFromEditor(editorRef.current, cursorPosBefore);
    }

    // Trigger autocomplete with current query text and cursor position
    autocomplete.onInput(newValue, cursorPosBefore);
  };

  const onLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, label: event.target.value });
    // Don't run query automatically when label changes
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
      // Trigger autocomplete validation to clear any validation errors if query is now valid
      autocomplete.onInput(query.queryText || '', cursorPosition);
      onRunQuery(); // Execute the query
    });

    // Track cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      const model = editor.getModel();
      if (model) {
        const offset = model.getOffsetAt(e.position);
        setCursorPosition(offset);
        updateSuggestionsPositionFromEditor(editor, offset);
      }
    });
  };

  const { queryText, label } = query;

  return (
    <Stack gap={2} direction="column">
      {/* Query field - full width */}
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Query</label>

        <CodeEditor
          value={queryText || ''}
          language="datadog"
          height="100px"
          onBlur={(value) => {
            // Close autocomplete when editor loses focus
            autocomplete.onClose();
          }}
          onSave={(value) => {
            // Update query when user saves (Cmd+S)
            onChange({ ...query, queryText: value });
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
              backgroundColor: 'var(--background-primary, #ffffff)',
              border: '1px solid var(--border-weak, #d1d2d3)',
              borderRadius: '2px',
              boxShadow: 'var(--panel-shadow, 0 2px 6px rgba(0,0,0,0.2))',
              maxHeight: '200px',
              overflowY: 'auto',
              color: 'var(--text-primary, #0a0a0a)',
              fontSize: 'var(--font-size-sm, 14px)',
              top: `${suggestionsPosition.top}px`,
              left: `${suggestionsPosition.left}px`,
            }}
            className="query-field-query-editor-suggestions"
          >
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
                    backgroundColor: index === autocomplete.state.selectedIndex
                      ? 'var(--brand-primary, #e8e8e8)'
                      : 'var(--background-primary, #ffffff)',
                    borderBottom: '1px solid var(--border-weak, #f0f0f0)',
                    color: 'var(--text-primary, #0a0a0a)',
                  }}
                >
                  {suggestion.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Loading indicator */}
        {autocomplete.state.isLoading && (
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '10px',
            fontSize: '12px',
            color: '#999'
          }}>
            Loading...
          </div>
        )}
      </div>

      {/* Label field - full width */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Label</label>
        <Input
          value={label || ''}
          onChange={onLabelChange}
          placeholder="e.g., {{host}}"
          style={{ width: '100%' }}
        />
      </div>
    </Stack>
  );
}
