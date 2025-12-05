import defaults from 'lodash/defaults';
import React, { ChangeEvent, KeyboardEvent, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { TextArea, Input, Spinner } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const queryTextRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('QueryEditor mounted with datasource:', { uid: datasource.uid, name: datasource.name });
  }, [datasource.uid, datasource.name]);

  // Initialize autocomplete hook with datasource UID
  const autocomplete = useQueryAutocomplete({
    datasourceUid: datasource.uid,
    debounceMs: 400,
  });

  /**
   * Adjust textarea height dynamically based on content
   */
  const adjustTextAreaHeight = useCallback(() => {
    if (queryTextRef.current) {
      queryTextRef.current.style.height = 'auto';
      queryTextRef.current.style.height = `${queryTextRef.current.scrollHeight}px`;
    }
  }, []);

  /**
   * Handle query text changes
   */
  const onQueryTextChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newQueryText = event.target.value;
      onChange({ ...query, queryText: newQueryText });
      adjustTextAreaHeight();

      // Trigger autocomplete
      const position = event.target.selectionStart;
      setCursorPosition(position);
      autocomplete.onInput(newQueryText, position);
    },
    [query, onChange, adjustTextAreaHeight, autocomplete]
  );

  /**
   * Handle label changes
   */
  const onQueryLabelChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...query, label: event.target.value });
    },
    [query, onChange]
  );

  /**
   * Handle keyboard events for both comment toggle and autocomplete navigation
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // First check for autocomplete keyboard navigation
      if (isAutocompleteOpen && autocomplete.state.suggestions.length > 0) {
        autocomplete.onKeyDown(event);
        // If event was handled by autocomplete (prevented), return early
        if (event.defaultPrevented) {
          return;
        }
      }

      // Handle comment toggle (Ctrl/Cmd + /)
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        if (!queryTextRef.current) {
          return;
        }

        const textArea = queryTextRef.current;
        const { selectionStart, selectionEnd } = textArea;
        const lines = textArea.value.split('\n');

        const newLines = lines.map((line, index) => {
          const lineStart = lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
          const lineEnd = lineStart + line.length;

          if (selectionStart >= lineStart && selectionStart <= lineEnd) {
            const leadingSpaces = line.match(/^(\s*)/)?.[0] || '';
            return line.trim().startsWith('#')
              ? leadingSpaces + line.trim().substring(1)
              : leadingSpaces + '#' + line.trim();
          }
          return line;
        });

        const newQueryText = newLines.join('\n');
        onChange({ ...query, queryText: newQueryText });

        setTimeout(() => {
          textArea.selectionStart = selectionStart;
          textArea.selectionEnd = selectionEnd;
          adjustTextAreaHeight();
        }, 0);
      }
    },
    [isAutocompleteOpen, autocomplete, query, onChange, adjustTextAreaHeight]
  );

  /**
   * Handle suggestion selection and insertion
   */
  const handleSuggestionSelect = useCallback(
    (item: any) => {
      if (!queryTextRef.current) {
        return;
      }

      const textArea = queryTextRef.current;
      const currentValue = query.queryText || '';
      const { selectionStart } = textArea;

      // Parse context to find what to replace
      const context = autocomplete.state; // This is simplified; in real usage we'd need the full context

      // For now, simple implementation: insert at cursor or append
      // In a more sophisticated version, we'd replace tokens more intelligently
      let newQueryText = currentValue;

      // Insert the suggestion
      if (selectionStart !== undefined) {
        // Find word boundary before cursor
        let wordStart = selectionStart;
        while (wordStart > 0 && /\S/.test(currentValue[wordStart - 1])) {
          wordStart--;
        }

        // Replace from word start to cursor
        newQueryText = currentValue.substring(0, wordStart) + item.insertText + currentValue.substring(selectionStart);
      } else {
        newQueryText += item.insertText;
      }

      // Update query
      onChange({ ...query, queryText: newQueryText });
      autocomplete.onClose();
      setIsAutocompleteOpen(false);

      // Restore cursor position after update
      setTimeout(() => {
        const newPosition = (wordStart || 0) + item.insertText.length;
        if (queryTextRef.current) {
          queryTextRef.current.selectionStart = newPosition;
          queryTextRef.current.selectionEnd = newPosition;
          adjustTextAreaHeight();
        }
      }, 0);
    },
    [query, onChange, autocomplete, adjustTextAreaHeight]
  );

  /**
   * Handle autocomplete dialog close
   */
  const handleAutocompleteClose = useCallback(() => {
    setIsAutocompleteOpen(false);
    autocomplete.onClose();
  }, [autocomplete]);

  /**
   * Update cursor position on click
   */
  const handleTextAreaClick = useCallback(() => {
    if (queryTextRef.current) {
      setCursorPosition(queryTextRef.current.selectionStart);
    }
  }, []);

  /**
   * Handle autocomplete state changes
   */
  useEffect(() => {
    setIsAutocompleteOpen(autocomplete.state.isOpen && autocomplete.state.suggestions.length > 0);
  }, [autocomplete.state.isOpen, autocomplete.state.suggestions.length]);

  /**
   * Adjust height on mount and when query changes
   */
  useEffect(() => {
    adjustTextAreaHeight();
  }, [query.queryText, adjustTextAreaHeight]);

  // Prepare props for QueryEditor
  const queryText = defaults(query).queryText || '';
  const label = defaults(query).label || '';

  return (
    <div>
      <div className="gf-form max-width">
        <label className="gf-form-label">Query</label>
        <div style={{ position: 'relative', width: '100%' }}>
          <TextArea
            ref={queryTextRef}
            value={queryText}
            onChange={onQueryTextChange}
            onKeyDown={handleKeyDown}
            onClick={handleTextAreaClick}
            rows={1}
            className="max-width"
            style={{ resize: 'none', overflow: 'hidden' }}
          />

          {/* Autocomplete Dialog */}
          {isAutocompleteOpen && (
            <div
              className="autocomplete-menu"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#1e1e1e',
                border: '1px solid #333',
                borderRadius: '4px',
                zIndex: 1000,
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
              }}
            >
              {autocomplete.state.isLoading && (
                <div style={{ padding: '10px', textAlign: 'center' }}>
                  <Spinner />
                  <p>Loading suggestions...</p>
                </div>
              )}

              {autocomplete.state.error && (
                <div style={{ padding: '10px', color: '#ff6b6b', fontSize: '12px' }}>
                  Error: {autocomplete.state.error}
                </div>
              )}

              {!autocomplete.state.isLoading && !autocomplete.state.error && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {autocomplete.state.suggestions.map((item, index) => (
                    <li
                      key={item.label}
                      onClick={() => handleSuggestionSelect(item)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        backgroundColor:
                          index === autocomplete.state.selectedIndex ? '#333' : 'transparent',
                        color: '#fff',
                        borderBottom: '1px solid #2a2a2a',
                        fontSize: '12px',
                      }}
                      onMouseEnter={() => {
                        // Would need state management to handle mouse hover index change
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{item.label}</strong>
                        <span style={{ color: '#888', fontSize: '10px' }}>{item.kind}</span>
                      </div>
                      {item.documentation && (
                        <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>
                          {item.documentation}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="gf-form max-width">
        <label className="gf-form-label">Label</label>
        <Input
          value={label}
          onChange={onQueryLabelChange}
          className="max-width"
        />
      </div>
    </div>
  );
}
