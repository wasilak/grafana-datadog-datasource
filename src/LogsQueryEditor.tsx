import React, { useRef, useState, useEffect } from 'react';
import { CodeEditor, Stack, Alert, useTheme2, Button, InlineField, InlineFieldRow } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery, CompletionItem, JSONParsingConfig } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';
import { registerDatadogLanguage } from './utils/autocomplete/syntaxHighlighter';
import { LogsQueryEditorHelp } from './LogsQueryEditorHelp';
import { validateLogsQuery } from './utils/logsQueryValidator';
import { FieldSelector } from './components/FieldSelector';
import { 
  validateJsonParsingConfiguration, 
  serializeJsonParsingConfiguration,
  isJsonParsingConfigurationEqual 
} from './utils/jsonParsingMigration';

type LogsQueryEditorProps = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

/**
 * LogsQueryEditor component for Datadog logs queries
 * Reuses existing CodeEditor component and autocomplete infrastructure
 * Requirements: 3.1, 3.2
 */
export function LogsQueryEditor({ query, onChange, onRunQuery, datasource, ...restProps }: LogsQueryEditorProps) {
  // Wrapper for onRunQuery that includes validation
  const handleRunQuery = () => {
    if (canExecuteQuery()) {
      onRunQuery();
    }
    // If validation fails, the error messages are already displayed
  };
  const theme = useTheme2();
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);
  
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [fieldSelectorError, setFieldSelectorError] = useState<string | null>(null);

  // Ref to track autocomplete state for Monaco keyboard handler
  const autocompleteStateRef = useRef({ isOpen: false, selectedIndex: 0, suggestions: [] as CompletionItem[] });

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

  // JSON parsing configuration handlers
  const handleJsonParsingToggle = (enabled: boolean) => {
    const newJsonParsing = enabled 
      ? { 
          enabled: true, 
          targetField: 'message' as const, // Default to message field
          options: {
            preserveOriginal: true,
            flattenNested: true,
            maxDepth: 10,
            maxSize: 1024 * 1024 // 1MB
          }
        }
      : { enabled: false, targetField: 'message' as const };

    // Clear field selector error when disabling JSON parsing
    if (!enabled) {
      setFieldSelectorError(null);
    }

    // Serialize configuration to ensure clean persistence
    const serializedConfig = serializeJsonParsingConfiguration(newJsonParsing);

    onChange({
      ...query,
      jsonParsing: serializedConfig
    });
  };

  const handleTargetFieldChange = (targetField: string) => {
    if (!query.jsonParsing) return;
    
    // Clear validation error when field is selected
    setFieldSelectorError(null);
    
    const updatedConfig = {
      ...query.jsonParsing,
      targetField: targetField as any
    };

    // Serialize configuration to ensure clean persistence
    const serializedConfig = serializeJsonParsingConfiguration(updatedConfig);
    
    onChange({
      ...query,
      jsonParsing: serializedConfig
    });
  };

  // Comprehensive validation function for JSON parsing configuration
  const validateJsonParsingConfigurationLocal = () => {
    // Clear any existing errors first
    setFieldSelectorError(null);
    
    // Use the centralized validation utility
    const validation = validateJsonParsingConfiguration(query.jsonParsing);
    
    if (!validation.isValid && validation.errors.length > 0) {
      setFieldSelectorError(validation.errors[0]); // Show first error
      return false;
    }

    // Log warnings to console
    validation.warnings.forEach(warning => {
      console.warn(`JSON Parsing Configuration: ${warning}`);
    });

    return true;
  };

  // Enhanced validation that prevents query execution with invalid configuration
  const canExecuteQuery = () => {
    // Basic logs query validation
    const logsValidation = validateLogsQuery(logQuery);
    if (!logsValidation.isValid) {
      return false;
    }

    // JSON parsing configuration validation
    if (!validateJsonParsingConfigurationLocal()) {
      return false;
    }

    return true;
  };

  // Track previous configuration for change detection
  const [previousConfig, setPreviousConfig] = useState<JSONParsingConfig | undefined>(query.jsonParsing);

  // Validate configuration when JSON parsing state changes
  useEffect(() => {
    validateJsonParsingConfigurationLocal();
    
    // Detect configuration changes and provide feedback
    if (!isJsonParsingConfigurationEqual(previousConfig, query.jsonParsing)) {
      console.log('JSON parsing configuration changed:', {
        previous: previousConfig,
        current: query.jsonParsing,
      });
      setPreviousConfig(query.jsonParsing);
    }
  }, [query.jsonParsing?.enabled, query.jsonParsing?.targetField, query.jsonParsing?.options]);

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

    // Add keyboard event listener for Cmd+Enter with validation
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      autocomplete.onClose();
      
      // Validate configuration before executing query
      if (canExecuteQuery()) {
        onRunQuery();
      } else {
        // Focus back to editor to show validation errors
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        }, 0);
      }
      
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

  // Field selector options with descriptions
  const fieldOptions = [
    { 
      label: 'Message Field', 
      value: 'message',
      description: 'Parse JSON content from the log message field'
    },
    { 
      label: 'Data Field', 
      value: 'data',
      description: 'Parse JSON content from the data field'
    },
    { 
      label: 'Attributes Field', 
      value: 'attributes',
      description: 'Parse JSON content from the attributes field'
    },
    { 
      label: 'Whole Log', 
      value: 'whole_log',
      description: 'Parse the entire log entry as JSON'
    }
  ];

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

      {/* JSON Parsing Configuration Panel */}
      <InlineFieldRow>
        <InlineField 
          label="JSON Parsing" 
          labelWidth={14}
          tooltip="Enable JSON parsing to extract structured data from log fields"
        >
          <Stack gap={1} direction="row" alignItems="center">
            <Button
              variant={query.jsonParsing?.enabled ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleJsonParsingToggle(!query.jsonParsing?.enabled)}
              icon={query.jsonParsing?.enabled ? "check" : "plus"}
            >
              {query.jsonParsing?.enabled ? 'Enabled' : 'Enable JSON Parsing'}
            </Button>
          </Stack>
        </InlineField>
      </InlineFieldRow>

      {/* Field Selector - shown when JSON parsing is enabled */}
      {query.jsonParsing?.enabled && (
        <>
          <InlineFieldRow>
            <FieldSelector
              value={query.jsonParsing.targetField || ''}
              onChange={handleTargetFieldChange}
              options={fieldOptions}
              label="Parse Field"
              labelWidth={14}
              tooltip="Select which log field contains JSON data to parse"
              placeholder="Select field to parse"
              required={true}
              width={25}
              validationError={fieldSelectorError}
            />
          </InlineFieldRow>
          
          {/* Display field selector validation error prominently */}
          {fieldSelectorError && (
            <Alert title="JSON Parsing Configuration Error" severity="error">
              {fieldSelectorError}
              <br />
              <small>Query execution is disabled until this error is resolved.</small>
            </Alert>
          )}
        </>
      )}

      {/* Logs Help Component */}
      {showHelp && (
        <LogsQueryEditorHelp onClickExample={handleExampleClick} />
      )}
    </Stack>
  );
}