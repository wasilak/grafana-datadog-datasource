import { DataSourceInstanceSettings, CoreApp, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY } from './types';
import { variableInterpolationService } from './utils/variableInterpolation';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars) {
    // Use the enhanced variable interpolation service for better formatting support
    return variableInterpolationService.interpolateQuery(query, scopedVars);
  }

  filterQuery(query: MyQuery): boolean {
    // Prevent execution if no query text provided
    return !!query.queryText;
  }
}
