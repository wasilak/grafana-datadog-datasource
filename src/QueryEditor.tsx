import defaults from 'lodash/defaults';
import React, { ChangeEvent, KeyboardEvent, PureComponent, createRef } from 'react';
import { TextArea, Input } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { MyDataSourceOptions, MyQuery } from './types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  queryTextRef = createRef<HTMLTextAreaElement>();

  componentDidMount() {
    this.adjustTextAreaHeight();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.query.queryText !== this.props.query.queryText) {
      this.adjustTextAreaHeight();
    }
  }

  adjustTextAreaHeight = () => {
    if (this.queryTextRef.current) {
      this.queryTextRef.current.style.height = 'auto'; // Reset height to recalculate
      this.queryTextRef.current.style.height = `${this.queryTextRef.current.scrollHeight}px`;
    }
  };

  onQueryTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });

    this.adjustTextAreaHeight(); // Adjust height dynamically
  };

  onQueryLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, label: event.target.value });
  };

  onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === '/') {
      event.preventDefault();
      if (!this.queryTextRef.current) {
        return;
      }

      const textArea = this.queryTextRef.current;
      const { selectionStart, selectionEnd } = textArea;
      const lines = textArea.value.split('\n');

      let newLines = lines.map((line, index) => {
        const lineStart = lines.slice(0, index).reduce((sum, l) => sum + l.length + 1, 0);
        const lineEnd = lineStart + line.length;

        if (selectionStart >= lineStart && selectionStart <= lineEnd) {
          const leadingSpaces = line.match(/^(\s*)/)?.[0] || '';
          return line.trim().startsWith('#')
            ? leadingSpaces + line.trim().substring(1) // Remove #
            : leadingSpaces + '#' + line.trim(); // Add #
        }
        return line;
      });

      const newQueryText = newLines.join('\n');
      this.props.onChange({ ...this.props.query, queryText: newQueryText });

      setTimeout(() => {
        textArea.selectionStart = selectionStart;
        textArea.selectionEnd = selectionEnd;
        this.adjustTextAreaHeight(); // Recalculate height after updating text
      }, 0);
    }
  };

  render() {
    const query = defaults(this.props.query);
    const { queryText, label } = query;

    return (
      <div>
        <div className="gf-form max-width">
          <label className="gf-form-label">Query</label>
          <TextArea
            ref={this.queryTextRef}
            value={queryText || ''}
            onChange={this.onQueryTextChange}
            onKeyDown={this.onKeyDown}
            rows={1}
            className="max-width"
            style={{ resize: 'none', overflow: 'hidden' }}
          />
        </div>
        <div className="gf-form max-width">
          <label className="gf-form-label">Label</label>
          <Input value={label || ''} onChange={this.onQueryLabelChange} className="max-width" />
        </div>
      </div>
    );
  }
}
