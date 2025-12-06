import React, { ChangeEvent } from 'react';
import { InlineField, Input, TextArea, Stack } from '@grafana/ui';
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
    <Stack gap={0}>
      <InlineField label="Query" labelWidth={16} tooltip="Datadog query string">
        <TextArea
          value={queryText || ''}
          onChange={onQueryTextChange}
          onBlur={onRunQuery}
          placeholder="e.g., avg:system.cpu{*}"
          rows={3}
        />
      </InlineField>
      <InlineField label="Label" labelWidth={16} tooltip="Custom label for this series (optional)">
        <Input
          value={label || ''}
          onChange={onLabelChange}
          placeholder="e.g., {{host}}"
        />
      </InlineField>
    </Stack>
  );
}
