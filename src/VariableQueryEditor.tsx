import React, { useState, useEffect, useRef } from 'react';
import { InlineField, Select, Input, Stack, Alert, useTheme2 } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { MyVariableQuery, VariableQueryEditorProps, CompletionItem } from './types';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';

// Query type options for the dropdown
const QUERY_TYPE_OPTIONS: Array<SelectableValue<MyVariableQuery['queryType']>> = [
  {
    label: 'Metrics',
    value: 'metrics',
    description: 'Query available metric names',
  },
  {
    label: 'Tag Keys',
    value: 'tag_keys',
    description: 'Query tag keys for a specific metric',
  },
  {
    label: 'Tag Values',
    value: 'tag_values',
    description: 'Query tag values for a specific metric and tag key',
  },
];

export const VariableQueryEditor = ({ query, onChange, datasource }: VariableQueryEditorProps) => {
  const theme = useTheme2();
  
  // Initialize state with query values or defaults
  const [state, setState] = useState<MyVariableQuery>({
    queryType: query.queryType || 'metrics',
    namespace: query.namespace || '',
    searchPattern: query.searchPattern || '',
    metricName: query.metricName || '',
    tagKey: query.tagKey || '',
    rawQuery: query.rawQuery || '',
  });

  // Refs for autocomplete positioning
  const metricInputRef = useRef<HTMLInputElement>(null);
  const tagKeyInputRef = useRef<HTMLInputElement>(null);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0 });
  const [activeField, setActiveField] = useState<'metric' | 'tagKey' | null>(null);

  // Initialize autocomplete for metrics
  const autocomplete = useQueryAutocomplete({
    datasourceUid: datasource?.uid || '',
    onSelect: (item: CompletionItem) => {
      if (activeField === 'metric') {
        onFieldChange('metricName', item.label);
      } else if (activeField === 'tagKey') {
        onFieldChange('tagKey', item.label);
      }
      setActiveField(null);
    }
  });

  // Update state when query prop changes (for external updates)
  useEffect(() => {
    setState({
      queryType: query.queryType || 'metrics',
      namespace: query.namespace || '',
      searchPattern: query.searchPattern || '',
      metricName: query.metricName || '',
      tagKey: query.tagKey || '',
      rawQuery: query.rawQuery || '',
    });
  }, [query]);

  // Handle autocomplete for metric names
  const handleMetricInputChange = (value: string) => {
    onFieldChange('metricName', value);
    setActiveField('metric');
    
    // Trigger autocomplete with a simple query to get metrics
    setTimeout(() => {
      if (metricInputRef.current) {
        updateSuggestionsPosition(metricInputRef.current);
      }
      // Use a simple query that will trigger metric suggestions
      autocomplete.onInput(value || 'system', 0);
    }, 0);
  };

  // Handle autocomplete for tag keys
  const handleTagKeyInputChange = (value: string) => {
    onFieldChange('tagKey', value);
    setActiveField('tagKey');
    
    // Trigger autocomplete for tag keys
    setTimeout(() => {
      if (tagKeyInputRef.current) {
        updateSuggestionsPosition(tagKeyInputRef.current);
      }
      // Use the metric name to get tag suggestions, or empty for all tags
      const queryForTags = state.metricName ? `avg:${state.metricName}{${value}` : `avg:system.cpu{${value}`;
      autocomplete.onInput(queryForTags, queryForTags.length - 1);
    }, 0);
  };

  // Update suggestions position based on input field
  const updateSuggestionsPosition = (inputElement: HTMLInputElement) => {
    const rect = inputElement.getBoundingClientRect();
    setSuggestionsPosition({
      top: window.scrollY + rect.bottom + 4,
      left: window.scrollX + rect.left,
    });
  };

  // Save query changes and generate definition string
  const saveQuery = (newState: MyVariableQuery) => {
    setState(newState);
    
    // Generate definition string for Grafana's variable list display
    let definition = '';
    switch (newState.queryType) {
      case 'metrics':
        definition = `metrics(${newState.metricName || '*'})`;
        break;
      case 'tag_keys':
        definition = `tag_keys(${newState.metricName || 'all_metrics'})`;
        break;
      case 'tag_values':
        if (newState.metricName && newState.tagKey) {
          definition = `tag_values(${newState.metricName}, ${newState.tagKey})`;
        } else if (newState.tagKey) {
          definition = `tag_values(all_metrics, ${newState.tagKey})`;
        } else {
          definition = `tag_values(${newState.metricName || 'all_metrics'}, *)`;
        }
        break;
      default:
        definition = newState.rawQuery || 'unknown query';
    }
    
    // Call onChange with both the query object and definition string
    onChange(newState, definition);
  };

  // Handle query type change
  const onQueryTypeChange = (option: SelectableValue<MyVariableQuery['queryType']>) => {
    if (option.value) {
      // Close any open autocomplete
      autocomplete.onClose();
      setActiveField(null);
      
      const newState = {
        ...state,
        queryType: option.value,
        // Clear fields that don't apply to the new query type
        namespace: '',
        searchPattern: '',
        metricName: option.value !== 'metrics' ? state.metricName : '',
        tagKey: option.value === 'tag_values' ? state.tagKey : '',
      };
      saveQuery(newState);
    }
  };

  // Handle field changes
  const onFieldChange = (field: keyof MyVariableQuery, value: string) => {
    const newState = { ...state, [field]: value };
    saveQuery(newState);
  };

  return (
    <Stack gap={2} direction="column">
      {/* Query Type Selection */}
      <InlineField 
        label="Query Type" 
        labelWidth={20} 
        tooltip="Select the type of data to query for this variable"
      >
        <Select
          options={QUERY_TYPE_OPTIONS}
          value={QUERY_TYPE_OPTIONS.find(opt => opt.value === state.queryType)}
          onChange={onQueryTypeChange}
          width={30}
        />
      </InlineField>

      {/* Conditional fields based on query type */}
      {state.queryType === 'metrics' && (
        <div style={{ position: 'relative' }}>
          <InlineField 
            label="Metric Name" 
            labelWidth={20} 
            tooltip="Start typing to search for metric names. Leave empty for all metrics."
          >
            <Input
              ref={metricInputRef}
              value={state.metricName || ''}
              onChange={(e) => handleMetricInputChange(e.currentTarget.value)}
              onFocus={() => {
                setActiveField('metric');
                if (metricInputRef.current) {
                  updateSuggestionsPosition(metricInputRef.current);
                }
                autocomplete.onInput(state.metricName || 'system', 0);
              }}
              onBlur={() => {
                // Delay closing to allow for selection
                setTimeout(() => {
                  if (activeField === 'metric') {
                    autocomplete.onClose();
                    setActiveField(null);
                  }
                }, 200);
              }}
              placeholder="e.g., system.cpu.user (leave empty for all)"
              width={30}
            />
          </InlineField>
        </div>
      )}

      {(state.queryType === 'tag_keys' || state.queryType === 'tag_values') && (
        <div style={{ position: 'relative' }}>
          <InlineField 
            label="Metric Name" 
            labelWidth={20} 
            tooltip={state.queryType === 'tag_keys' 
              ? "The metric name to query tag keys for. Leave empty to get all tag keys across all metrics."
              : "The metric name to query tag values for. Leave empty to get tag values across all metrics."
            }
          >
            <Input
              ref={metricInputRef}
              value={state.metricName || ''}
              onChange={(e) => handleMetricInputChange(e.currentTarget.value)}
              onFocus={() => {
                setActiveField('metric');
                if (metricInputRef.current) {
                  updateSuggestionsPosition(metricInputRef.current);
                }
                autocomplete.onInput(state.metricName || 'system', 0);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (activeField === 'metric') {
                    autocomplete.onClose();
                    setActiveField(null);
                  }
                }, 200);
              }}
              placeholder="e.g., system.cpu.user (optional)"
              width={30}
            />
          </InlineField>
        </div>
      )}

      {state.queryType === 'tag_values' && (
        <div style={{ position: 'relative' }}>
          <InlineField 
            label="Tag Key" 
            labelWidth={20} 
            tooltip="The tag key to query values for. Start typing to see available tag keys."
          >
            <Input
              ref={tagKeyInputRef}
              value={state.tagKey || ''}
              onChange={(e) => handleTagKeyInputChange(e.currentTarget.value)}
              onFocus={() => {
                setActiveField('tagKey');
                if (tagKeyInputRef.current) {
                  updateSuggestionsPosition(tagKeyInputRef.current);
                }
                const queryForTags = state.metricName ? `avg:${state.metricName}{${state.tagKey}` : `avg:system.cpu{${state.tagKey}`;
                autocomplete.onInput(queryForTags, queryForTags.length - 1);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (activeField === 'tagKey') {
                    autocomplete.onClose();
                    setActiveField(null);
                  }
                }, 200);
              }}
              placeholder="e.g., host, service, env"
              width={30}
            />
          </InlineField>
        </div>
      )}

      {/* Show validation hints */}
      {state.queryType === 'tag_values' && !state.tagKey && (
        <Alert title="Configuration Required" severity="info">
          Please specify a tag key to query values for.
        </Alert>
      )}

      {/* Autocomplete popup */}
      {activeField && autocomplete.state.isOpen && autocomplete.state.suggestions.length > 0 && (
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
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {autocomplete.state.suggestions.slice(0, 10).map((suggestion, index) => (
              <li
                key={index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  autocomplete.onMouseClick(suggestion);
                }}
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
        </div>
      )}
    </Stack>
  );
};