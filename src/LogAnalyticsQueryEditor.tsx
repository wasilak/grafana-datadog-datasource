import React, { useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Combobox,
  ComboboxOption,
  InlineField,
  InlineFieldRow,
  Input,
  Stack,
} from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { LogAnalyticsGroupBy, MyDataSourceOptions, MyQuery } from './types';

type Props = Pick<QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>, 'query' | 'onChange' | 'onRunQuery'>;

// Datadog's aggregations, labeled as in Datadog's Log Analytics
const aggregationOptions: Array<ComboboxOption<string>> = [
  { label: 'Count', value: 'count', description: 'Number of logs' },
  { label: 'Count unique', value: 'cardinality', description: 'Number of distinct values of the measure' },
  { label: 'Sum', value: 'sum' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'Avg', value: 'avg' },
  { label: 'pc75', value: 'pc75', description: '75th percentile' },
  { label: 'pc90', value: 'pc90', description: '90th percentile' },
  { label: 'pc95', value: 'pc95', description: '95th percentile' },
  { label: 'pc98', value: 'pc98', description: '98th percentile' },
  { label: 'pc99', value: 'pc99', description: '99th percentile' },
];

// Shared with the metrics editor, so both query types offer the same choices
export const responseFormatOptions: Array<ComboboxOption<'timeseries' | 'scalar'>> = [
  { label: 'Timeseries', value: 'timeseries', description: 'Values over time' },
  { label: 'Scalar', value: 'scalar', description: 'One value per group over the whole time range' },
];

const legendModeOptions: Array<ComboboxOption<'auto' | 'custom'>> = [
  { label: 'Auto', value: 'auto', description: 'Only includes unique labels' },
  { label: 'Custom', value: 'custom', description: 'Provide a naming template' },
];

/**
 * LogAnalyticsQueryEditor edits Log Analytics queries: logs counted or
 * aggregated by Datadog, over time or per group
 */
export function LogAnalyticsQueryEditor({ query, onChange, onRunQuery }: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false);

  const {
    logQuery = '',
    compute = { aggregation: 'count' },
    // Rows without a facet yet are kept in the query too; the backend skips them
    groupBy = [],
    responseFormat = 'timeseries',
    legendMode = 'auto',
    legendTemplate = '',
  } = query;
  const measureMissing = compute.aggregation !== 'count' && !compute.metric;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) for query execution
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onRunQuery();
    }
  };

  const changeAndRun = (changes: Partial<MyQuery>) => {
    onChange({ ...query, ...changes });
    onRunQuery();
  };

  const updateGroupBy = (rows: LogAnalyticsGroupBy[]) => {
    onChange({ ...query, groupBy: rows });
  };

  const updateGroupByRow = (index: number, changes: Partial<LogAnalyticsGroupBy>) => {
    updateGroupBy(groupBy.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  };

  return (
    <Stack gap={1} direction="column">
      <InlineFieldRow>
        <InlineField
          label="Search"
          labelWidth={14}
          grow
          tooltip="Datadog logs search (e.g., service:web status:error). Leave empty for all logs."
        >
          <Input
            value={logQuery}
            onChange={(e) => onChange({ ...query, logQuery: e.currentTarget.value })}
            onKeyDown={onKeyDown}
            placeholder="service:web status:error"
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label="Aggregation" labelWidth={14}>
          <Combobox
            options={aggregationOptions}
            value={compute.aggregation}
            onChange={(option) =>
              changeAndRun({
                compute:
                  option.value === 'count' ? { aggregation: 'count' } : { ...compute, aggregation: option.value },
              })
            }
            createCustomValue
            width={20}
          />
        </InlineField>
        {compute.aggregation !== 'count' && (
          <InlineField label="Measure" tooltip="The attribute to aggregate (e.g., @duration_ms)">
            <Input
              value={compute.metric ?? ''}
              onChange={(e) =>
                onChange({ ...query, compute: { ...compute, metric: e.currentTarget.value || undefined } })
              }
              onKeyDown={onKeyDown}
              placeholder="@duration_ms"
              width={30}
            />
          </InlineField>
        )}
      </InlineFieldRow>

      {measureMissing && (
        <Alert title="Query Validation" severity="warning">
          {compute.aggregation} needs a measure. Choose one, e.g. @duration_ms
        </Alert>
      )}

      {groupBy.map((row, index) => (
        <InlineFieldRow key={index}>
          <InlineField
            label="Group by"
            labelWidth={14}
            tooltip="Facet to group by (e.g., @http.status_code or service)"
          >
            <Input
              value={row.facet}
              onChange={(e) => updateGroupByRow(index, { facet: e.currentTarget.value })}
              onKeyDown={onKeyDown}
              placeholder="@http.status_code"
              width={30}
            />
          </InlineField>
          <InlineField label="Limit" tooltip="Number of top groups to return. Datadog's default is 10.">
            <Input
              type="number"
              value={row.limit ?? ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                updateGroupByRow(index, { limit: value ? parseInt(value, 10) : undefined });
              }}
              onKeyDown={onKeyDown}
              placeholder="10"
              width={10}
            />
          </InlineField>
          <Button
            variant="secondary"
            icon="trash-alt"
            aria-label="Remove group by"
            onClick={() => updateGroupBy(groupBy.filter((_, i) => i !== index))}
          />
        </InlineFieldRow>
      ))}
      <InlineFieldRow>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => updateGroupBy([...groupBy, { facet: '' }])}>
          Add group by
        </Button>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Format"
          labelWidth={14}
          tooltip="Timeseries for values over time, or Scalar for one value per group over the whole time range"
        >
          <Combobox
            options={responseFormatOptions}
            value={responseFormat}
            onChange={(option) => changeAndRun({ responseFormat: option.value })}
            width={20}
          />
        </InlineField>
      </InlineFieldRow>

      <Collapse label="Options" isOpen={optionsOpen} onToggle={() => setOptionsOpen(!optionsOpen)}>
        <InlineFieldRow>
          <InlineField label="Legend" labelWidth={14} tooltip="Configure how series names are displayed in the legend">
            <Combobox
              options={legendModeOptions}
              value={legendMode}
              onChange={(option) =>
                onChange({
                  ...query,
                  legendMode: option.value,
                  // Clear template when switching to auto
                  legendTemplate: option.value === 'auto' ? '' : legendTemplate,
                })
              }
              width={20}
            />
          </InlineField>
        </InlineFieldRow>

        {legendMode === 'custom' && (
          <InlineFieldRow>
            <InlineField label="" labelWidth={14} grow>
              <Input
                value={legendTemplate}
                onChange={(e) => onChange({ ...query, legendTemplate: e.currentTarget.value })}
                onKeyDown={onKeyDown}
                placeholder="e.g., {{@http.status_code}}"
              />
            </InlineField>
          </InlineFieldRow>
        )}

        {responseFormat === 'timeseries' && (
          <InlineFieldRow>
            <InlineField
              label="Interval"
              labelWidth={14}
              tooltip="Override the query interval in milliseconds. Leave empty for auto-calculated interval."
            >
              <Input
                type="number"
                value={query.interval || ''}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  onChange({ ...query, interval: value ? parseInt(value, 10) : undefined });
                }}
                onKeyDown={onKeyDown}
                placeholder="Auto"
                width={20}
              />
            </InlineField>
          </InlineFieldRow>
        )}
      </Collapse>
    </Stack>
  );
}
