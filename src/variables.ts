import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { from, map, Observable } from 'rxjs';
import type { DataSource } from './datasource';
import { DatadogVariableQuery } from './types';
import { VariableQueryEditor } from './VariableQueryEditor';

/**
 * Template variable support, replacing the deprecated setVariableQueryEditor.
 * Grafana passes the saved variable query as the only target, in whatever
 * shape it was stored (object or legacy JSON string), and metricFindQuery
 * already handles both.
 */
export class DatadogVariableSupport extends CustomVariableSupport<DataSource, DatadogVariableQuery> {
  editor = VariableQueryEditor;

  constructor(private readonly datasource: DataSource) {
    super();
  }

  query(request: DataQueryRequest<DatadogVariableQuery>): Observable<DataQueryResponse> {
    return from(this.datasource.metricFindQuery(request.targets[0])).pipe(map((data) => ({ data })));
  }
}
