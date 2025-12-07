import React, { ChangeEvent, useRef, useState } from 'react';
import { Input, TextArea, Stack, Alert } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery, CompletionItem } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

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

    // Set focus back to textarea with new cursor position after a slight delay
    // to ensure React has updated the DOM
    setTimeout(() => {
      if (textareaRef.current) {
        // Ensure the new value is rendered, then set the cursor position
        // Focus the element first
        textareaRef.current.focus();

        // Set the selection range to place cursor at the end of the inserted text
        // This needs to be done after the update is rendered
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);

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

  const onQueryTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    // Capture cursor position BEFORE the state changes
    const cursorPosBefore = event.target.selectionStart || 0;
    const newValue = event.target.value;

    // Update the query state
    onChange({ ...query, queryText: newValue });

    // Store cursor position for autocomplete
    setCursorPosition(cursorPosBefore);

    // Trigger autocomplete with current query text and cursor position
    autocomplete.onInput(newValue, cursorPosBefore);

    // Manually preserve cursor position after the update to avoid React's controlled component issue
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(cursorPosBefore, cursorPosBefore);
      }
    }, 0);
  };

  const onLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, label: event.target.value });
    // Don't run query automatically when label changes
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Capture current cursor position before the key event is processed
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }

    // Let the autocomplete hook handle keyboard navigation
    autocomplete.onKeyDown(event);
  };

  const { queryText, label } = query;

  return (
    <Stack gap={2} direction="column">
      {/* Query field - full width */}
      <div style={{ position: 'relative' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Query</label>

        <TextArea
          ref={textareaRef}
          value={queryText || ''}
          onChange={onQueryTextChange}
          onKeyDown={handleKeyDown}
          onClick={() => {
            // Capture cursor position on click too
            if (textareaRef.current) {
              setCursorPosition(textareaRef.current.selectionStart || 0);
            }
          }}
          onBlur={() => {
            // Remove automatic query running to prevent cursor repositioning
            // onRunQuery();
            autocomplete.onClose(); // Close autocomplete when input loses focus
          }}
          placeholder="e.g., avg:system.cpu{*}"
          rows={4}
          style={{ width: '100%' }}
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
              position: 'absolute',
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
              top: '100%',
              left: 0,
            }}
            className="query-field-query-editor-suggestions"
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {autocomplete.state.suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  onClick={() => autocomplete.onItemSelect(suggestion)}
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
