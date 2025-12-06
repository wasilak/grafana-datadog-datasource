import React, { ChangeEvent } from 'react';
import { Input, TextArea, Stack } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery } from './types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onQueryTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...query, queryText: event.target.value });
  };

  const onLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, label: event.target.value });
    onRunQuery();
  };

  const { queryText, label } = query;

  return (
    <Stack gap={2} direction="column">
      {/* Query field - full width */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Query</label>
        <TextArea
          value={queryText || ''}
          onChange={onQueryTextChange}
          onBlur={onRunQuery}
          placeholder="e.g., avg:system.cpu{*}"
          rows={4}
          style={{ width: '100%' }}
        />
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
