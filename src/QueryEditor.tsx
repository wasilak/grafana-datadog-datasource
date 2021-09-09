import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery } from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onBlur = () => {
    const { onRunQuery } = this.props;
    // executes the query
    onRunQuery();
  };

  onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });
  };

  onQueryLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, label: event.target.value });
  };

  render() {
    const query = defaults(this.props.query);
    const { queryText, label } = query;

    return (
      <div>
        <div className="gf-form max-width">
          <FormField
            labelWidth={0}
            value={queryText || ''}
            onChange={this.onQueryTextChange}
            onBlur={this.onBlur}
            label="Query"
            tooltip="Datadog query, see: https://docs.datadoghq.com/metrics/advanced-filtering/"
            className="max-width"
            inputWidth={0}
          />
        </div>
        <div className="gf-form max-width">
          <FormField
            labelWidth={0}
            value={label || ''}
            onChange={this.onQueryLabelChange}
            onBlur={this.onBlur}
            label="Label"
            tooltip="nope."
            className="max-width"
            inputWidth={0}
          />
        </div>
      </div>
    );
  }
}
