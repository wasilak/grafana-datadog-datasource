import { DataSourceInstanceSettings, CoreApp, ScopedVars, MetricFindValue } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, getBackendSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, MyVariableQuery } from './types';
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

  /**
   * This method is called when a template variable query is executed.
   * It handles variable queries for metrics, tag keys, and tag values.
   */
  async metricFindQuery(query: MyVariableQuery): Promise<MetricFindValue[]> {
    try {
      // Determine the resource endpoint based on query type
      let resourcePath = '';
      const params: Record<string, string> = {};

      switch (query.queryType) {
        case 'metrics':
          resourcePath = 'metrics';
          if (query.namespace) {
            params.namespace = query.namespace;
          }
          if (query.searchPattern) {
            params.search = query.searchPattern;
          }
          break;

        case 'tag_keys':
          resourcePath = 'tag-keys';
          if (query.metricName) {
            params.metric = query.metricName;
          }
          break;

        case 'tag_values':
          resourcePath = 'tag-values';
          if (query.metricName) {
            params.metric = query.metricName;
          }
          if (query.tagKey) {
            params.tag_key = query.tagKey;
          }
          break;

        default:
          throw new Error(`Unknown query type: ${query.queryType}`);
      }

      // Build URL without query parameters (backend expects POST with JSON body)
      const url = `/api/datasources/uid/${this.uid}/resources/${resourcePath}`;

      // Make the request to the backend resource handler
      // Backend expects POST requests with JSON body for variable resource handlers
      const response = await getBackendSrv().post(url, params);

      // Handle the response - backend should return { values: string[] }
      if (response && Array.isArray(response.values)) {
        return response.values.map((value: string) => ({
          text: value,
          value: value,
        }));
      }

      // Fallback for unexpected response format
      if (Array.isArray(response)) {
        return response.map((value: any) => ({
          text: typeof value === 'string' ? value : String(value),
          value: typeof value === 'string' ? value : String(value),
        }));
      }

      return [];
    } catch (error) {
      console.error('Variable query failed:', error);
      
      // Return empty array on error to prevent Grafana from showing error dialogs
      // The error will be logged but won't break the variable functionality
      return [];
    }
  }
}
