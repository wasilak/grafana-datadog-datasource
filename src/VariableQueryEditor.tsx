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
  
  console.log('VariableQueryEditor rendered with query:', query);
  console.log('VariableQueryEditor onChange function:', typeof onChange);
  
  // Handle different query formats that Grafana might pass
  const parseQuery = (q: any): MyVariableQuery => {
    // If query is a string, try to parse it as JSON
    if (typeof q === 'string') {
      if (q === '' || q === '{}') {
        // Empty string or empty object, return defaults
        return {
          queryType: 'metrics',
          namespace: '',
          searchPattern: '',
          metricName: '*',
          tagKey: '*',
          filter: '',
          rawQuery: '',
        };
      }
      try {
        const parsed = JSON.parse(q);
        return {
          queryType: parsed.queryType || 'metrics',
          namespace: parsed.namespace || '',
          searchPattern: parsed.searchPattern || '',
          metricName: parsed.metricName || '*',
          tagKey: parsed.tagKey || '*',
          filter: parsed.filter || '',
          rawQuery: parsed.rawQuery || '',
        };
      } catch (e) {
        console.warn('Failed to parse query string, using defaults:', e);
        return {
          queryType: 'metrics',
          namespace: '',
          searchPattern: '',
          metricName: '*',
          tagKey: '*',
          filter: '',
          rawQuery: q, // Store the original string in rawQuery
        };
      }
    }
    
    // If query is an object, use it directly with defaults
    if (q && typeof q === 'object') {
      return {
        queryType: q.queryType || 'metrics',
        namespace: q.namespace || '',
        searchPattern: q.searchPattern || '',
        metricName: q.metricName || '*',
        tagKey: q.tagKey || '*',
        filter: q.filter || '',
        rawQuery: q.rawQuery || '',
      };
    }
    
    // Fallback to defaults
    return {
      queryType: 'metrics',
      namespace: '',
      searchPattern: '',
      metricName: '*',
      tagKey: '*',
      filter: '',
      rawQuery: '',
    };
  };
  
  // Initialize state with parsed query values or defaults
  const [state, setState] = useState<MyVariableQuery>(parseQuery(query));

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
    const newState = parseQuery(query);
    setState(newState);
  }, [query]);

  // Check if a value is a regex pattern (wrapped in forward slashes)
  const isRegexPattern = (value: string): boolean => {
    const trimmed = value.trim();
    return trimmed.length >= 2 && trimmed.startsWith('/') && trimmed.endsWith('/');
  };

  // Smart trim that preserves regex patterns but trims whitespace outside /regex/
  const smartTrim = (value: string): string => {
    const trimmed = value.trim();
    
    // If it's a regex pattern, return the trimmed version (removes spaces outside //)
    if (trimmed.length >= 2 && trimmed.startsWith('/') && trimmed.endsWith('/')) {
      return trimmed;
    }
    
    // For non-regex values, return trimmed
    return trimmed;
  };

  // Handle autocomplete for metric names
  const handleMetricInputChange = (value: string) => {
    // Smart trim whitespace (preserves spaces inside regex patterns)
    const cleanValue = smartTrim(value);
    onFieldChange('metricName', cleanValue);
    
    // Only trigger autocomplete if it's NOT a regex pattern
    if (!isRegexPattern(cleanValue)) {
      setActiveField('metric');
      
      // Trigger autocomplete with a simple query to get metrics
      setTimeout(() => {
        if (metricInputRef.current) {
          updateSuggestionsPosition(metricInputRef.current);
        }
        // Use a simple query that will trigger metric suggestions
        autocomplete.onInput(cleanValue || 'system', 0);
      }, 0);
    } else {
      // Close autocomplete for regex patterns
      autocomplete.onClose();
      setActiveField(null);
    }
  };

  // Handle autocomplete for tag keys
  const handleTagKeyInputChange = (value: string) => {
    // Smart trim whitespace (preserves spaces inside regex patterns)
    const cleanValue = smartTrim(value);
    onFieldChange('tagKey', cleanValue);
    
    // Only trigger autocomplete if it's NOT a regex pattern
    if (!isRegexPattern(cleanValue)) {
      setActiveField('tagKey');
      
      // Trigger autocomplete for tag keys
      setTimeout(() => {
        if (tagKeyInputRef.current) {
          updateSuggestionsPosition(tagKeyInputRef.current);
        }
        // Use the metric name to get tag suggestions, or empty for all tags
        const queryForTags = state.metricName ? `avg:${state.metricName}{${cleanValue}` : `avg:system.cpu{${cleanValue}`;
        autocomplete.onInput(queryForTags, queryForTags.length - 1);
      }, 0);
    } else {
      // Close autocomplete for regex patterns
      autocomplete.onClose();
      setActiveField(null);
    }
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
    console.log('VariableQueryEditor saveQuery called with:', newState);
    setState(newState);
    
    // Generate definition string for Grafana's variable list display
    let definition = '';
    switch (newState.queryType) {
      case 'metrics':
        definition = `metrics(${newState.metricName || '*'})`;
        break;
      case 'tag_keys':
        definition = `tag_keys(${newState.metricName || '*'})`;
        break;
      case 'tag_values':
        definition = `tag_values(${newState.metricName || '*'}, ${newState.tagKey || '*'})`;
        break;
      default:
        definition = newState.rawQuery || 'unknown query';
    }
    
    // Call onChange with both the query object and definition string
    console.log('VariableQueryEditor calling onChange with:', newState, definition);
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
        // Set default values for new query type
        namespace: '',
        searchPattern: '',
        metricName: option.value !== 'metrics' ? (state.metricName || '*') : '*',
        tagKey: option.value === 'tag_values' ? (state.tagKey || '*') : '*',
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
            tooltip="Start typing for autocomplete, or use /regex/ for pattern matching. Use '*' for all metrics."
          >
            <Input
              ref={metricInputRef}
              value={state.metricName || '*'}
              onChange={(e) => handleMetricInputChange(e.currentTarget.value)}
              onFocus={() => {
                // Only trigger autocomplete if not a regex pattern
                if (!isRegexPattern(state.metricName || '')) {
                  setActiveField('metric');
                  if (metricInputRef.current) {
                    updateSuggestionsPosition(metricInputRef.current);
                  }
                  autocomplete.onInput(state.metricName === '*' ? 'system' : state.metricName || 'system', 0);
                }
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
              placeholder="e.g., system.cpu.user, /^system\.cpu\./, or * for all"
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
              ? "Metric name filter (optional). Start typing for autocomplete, or use /regex/ for pattern matching. Use '*' for all metrics."
              : "Metric name filter (optional). Start typing for autocomplete, or use /regex/ for pattern matching. Use '*' for all metrics."
            }
          >
            <Input
              ref={metricInputRef}
              value={state.metricName || '*'}
              onChange={(e) => handleMetricInputChange(e.currentTarget.value)}
              onFocus={() => {
                // Only trigger autocomplete if not a regex pattern
                if (!isRegexPattern(state.metricName || '')) {
                  setActiveField('metric');
                  if (metricInputRef.current) {
                    updateSuggestionsPosition(metricInputRef.current);
                  }
                  autocomplete.onInput(state.metricName === '*' ? 'system' : state.metricName || 'system', 0);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (activeField === 'metric') {
                    autocomplete.onClose();
                    setActiveField(null);
                  }
                }, 200);
              }}
              placeholder="e.g., system.cpu.user, /^system\./, or * for all"
              width={30}
            />
          </InlineField>
        </div>
      )}

      {state.queryType === 'tag_keys' && (
        <div style={{ position: 'relative' }}>
          <InlineField 
            label="Tag Key Filter" 
            labelWidth={20} 
            tooltip="Filter tag keys by pattern. Start typing for autocomplete, or use /regex/ for pattern matching. Use '*' for all tag keys."
          >
            <Input
              ref={tagKeyInputRef}
              value={state.tagKey || '*'}
              onChange={(e) => handleTagKeyInputChange(e.currentTarget.value)}
              onFocus={() => {
                // Only trigger autocomplete if not a regex pattern
                if (!isRegexPattern(state.tagKey || '')) {
                  setActiveField('tagKey');
                  if (tagKeyInputRef.current) {
                    updateSuggestionsPosition(tagKeyInputRef.current);
                  }
                  const metricForTags = state.metricName === '*' ? 'system.cpu' : state.metricName || 'system.cpu';
                  const queryForTags = `avg:${metricForTags}{${state.tagKey === '*' ? 'host' : state.tagKey || 'host'}`;
                  autocomplete.onInput(queryForTags, queryForTags.length - 1);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (activeField === 'tagKey') {
                    autocomplete.onClose();
                    setActiveField(null);
                  }
                }, 200);
              }}
              placeholder="e.g., host, /^env/, or * for all"
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
            tooltip="Tag key to get values for. Start typing for autocomplete, or use /regex/ for pattern matching. Use '*' for all tag keys."
          >
            <Input
              ref={tagKeyInputRef}
              value={state.tagKey || '*'}
              onChange={(e) => handleTagKeyInputChange(e.currentTarget.value)}
              onFocus={() => {
                // Only trigger autocomplete if not a regex pattern
                if (!isRegexPattern(state.tagKey || '')) {
                  setActiveField('tagKey');
                  if (tagKeyInputRef.current) {
                    updateSuggestionsPosition(tagKeyInputRef.current);
                  }
                  const metricForTags = state.metricName === '*' ? 'system.cpu' : state.metricName || 'system.cpu';
                  const queryForTags = `avg:${metricForTags}{${state.tagKey === '*' ? 'host' : state.tagKey || 'host'}`;
                  autocomplete.onInput(queryForTags, queryForTags.length - 1);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (activeField === 'tagKey') {
                    autocomplete.onClose();
                    setActiveField(null);
                  }
                }, 200);
              }}
              placeholder="e.g., host, service, /^env/, or * for all"
              width={30}
            />
          </InlineField>
        </div>
      )}

      {/* Show helpful information */}
      {state.queryType === 'metrics' && (
        <Alert title="Smart Filtering" severity="info">
          <strong>Autocomplete:</strong> Type metric names (e.g., "system.cpu") for suggestions<br/>
          <strong>Regex:</strong> Use /pattern/ for advanced filtering (e.g., /^system\.cpu\./ for CPU metrics)<br/>
          <strong>Wildcard:</strong> Use '*' for all metrics
        </Alert>
      )}

      {state.queryType === 'tag_keys' && (
        <Alert title="Smart Filtering" severity="info">
          <strong>Metric Name:</strong> Type for autocomplete or use /regex/ for pattern matching<br/>
          <strong>Tag Key Filter:</strong> Type for autocomplete or use /regex/ (e.g., /^host/ for keys starting with 'host')<br/>
          <strong>Wildcard:</strong> Use '*' for all values
        </Alert>
      )}

      {state.queryType === 'tag_values' && (
        <Alert title="Smart Filtering" severity="info">
          <strong>Independent Fields:</strong> Metric and tag key selections are independent<br/>
          <strong>Autocomplete:</strong> Type in any field for suggestions<br/>
          <strong>Regex:</strong> Use /pattern/ for advanced filtering (e.g., /prod.*/ for values starting with 'prod')<br/>
          <strong>Wildcard:</strong> Use '*' for all values
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