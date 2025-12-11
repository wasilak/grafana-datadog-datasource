import React, { useState, useEffect } from 'react';
import { InlineField, Select, Input, Stack, Alert } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { MyVariableQuery, VariableQueryEditorProps, VariableQueryTypeOption } from './types';

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
  // Initialize state with query values or defaults
  const [state, setState] = useState<MyVariableQuery>({
    queryType: query.queryType || 'metrics',
    namespace: query.namespace || '',
    searchPattern: query.searchPattern || '',
    metricName: query.metricName || '',
    tagKey: query.tagKey || '',
    rawQuery: query.rawQuery || '',
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

  // Save query changes and generate definition string
  const saveQuery = (newState: MyVariableQuery) => {
    setState(newState);
    
    // Generate definition string for Grafana's variable list display
    let definition = '';
    switch (newState.queryType) {
      case 'metrics':
        definition = `metrics(${newState.namespace || '*'})`;
        if (newState.searchPattern) {
          definition += ` filter: ${newState.searchPattern}`;
        }
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
    onChange(newState, definition);
  };

  // Handle query type change
  const onQueryTypeChange = (option: SelectableValue<MyVariableQuery['queryType']>) => {
    if (option.value) {
      const newState = {
        ...state,
        queryType: option.value,
        // Clear fields that don't apply to the new query type
        namespace: option.value === 'metrics' ? state.namespace : '',
        searchPattern: option.value === 'metrics' ? state.searchPattern : '',
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
        <>
          <InlineField 
            label="Namespace" 
            labelWidth={20} 
            tooltip="Filter metrics by namespace (e.g., 'system', 'aws'). Leave empty for all namespaces."
          >
            <Input
              value={state.namespace || ''}
              onChange={(e) => onFieldChange('namespace', e.currentTarget.value)}
              placeholder="e.g., system, aws, custom"
              width={30}
            />
          </InlineField>
          
          <InlineField 
            label="Search Pattern" 
            labelWidth={20} 
            tooltip="Filter metrics by name pattern (e.g., 'cpu', 'memory'). Leave empty for all metrics."
          >
            <Input
              value={state.searchPattern || ''}
              onChange={(e) => onFieldChange('searchPattern', e.currentTarget.value)}
              placeholder="e.g., cpu, memory, disk"
              width={30}
            />
          </InlineField>
        </>
      )}

      {(state.queryType === 'tag_keys' || state.queryType === 'tag_values') && (
        <InlineField 
          label="Metric Name" 
          labelWidth={20} 
          tooltip="The metric name to query tags for. Required for tag queries."
        >
          <Input
            value={state.metricName || ''}
            onChange={(e) => onFieldChange('metricName', e.currentTarget.value)}
            placeholder="e.g., system.cpu.user"
            width={30}
          />
        </InlineField>
      )}

      {state.queryType === 'tag_values' && (
        <InlineField 
          label="Tag Key" 
          labelWidth={20} 
          tooltip="The tag key to query values for. Required for tag value queries."
        >
          <Input
            value={state.tagKey || ''}
            onChange={(e) => onFieldChange('tagKey', e.currentTarget.value)}
            placeholder="e.g., host, service, env"
            width={30}
          />
        </InlineField>
      )}

      {/* Show validation hints */}
      {state.queryType === 'tag_keys' && !state.metricName && (
        <Alert title="Configuration Required" severity="info">
          Please specify a metric name to query tag keys.
        </Alert>
      )}

      {state.queryType === 'tag_values' && (!state.metricName || !state.tagKey) && (
        <Alert title="Configuration Required" severity="info">
          Please specify both metric name and tag key to query tag values.
        </Alert>
      )}
    </Stack>
  );
};