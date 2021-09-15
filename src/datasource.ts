import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import _ from 'lodash';

import { MyQuery, MyDataSourceOptions } from './types';

import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;

  routePath = '/wasilak-datadog-datasource';

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url;
  }

  async doRequest(from: number, to: number, query: MyQuery, options: any) {
    const parsedQuery = getTemplateSrv().replace(query.queryText, options.scopedVars, 'csv');

    const result = await getBackendSrv().datasourceRequest({
      method: 'GET',
      url: this.url + this.routePath + '/api/v1/query?from=' + from + '&to=' + to + '&query=' + parsedQuery,
    });

    return result;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;

    // Datadog accepts seconds not milliseconds
    const from = range!.from.valueOf() / 1000;
    const to = range!.to.valueOf() / 1000;

    const promises = options.targets.map((query) => {
      const frames: MutableDataFrame[] = [];

      if (!('queryText' in query)) {
        return frames;
      }

      if (query.hide) {
        return frames;
      }

      return this.doRequest(from, to, query, options)
        .then((datadogData: any) => {
          if ('error' in datadogData.data) {
            throw new Error(datadogData.data.error);
          }

          for (const s of datadogData.data.series) {
            let seriesName: string = s.metric + ' {' + s.tag_set.join(', ') + '}';

            if ('label' in query && query.label.length > 0) {
              seriesName = query.label;

              for (let i in s.tag_set) {
                let tag = s.tag_set[i];

                const splitTag = tag.split(':');

                if (seriesName.includes('$' + splitTag[0])) {
                  seriesName = seriesName.split('$' + splitTag[0]).join(splitTag[1]);
                }
              }
            }

            const frame = new MutableDataFrame({
              refId: query.refId,
              name: seriesName,
              fields: [
                { name: 'Time', type: FieldType.time },
                { name: 'Value', type: FieldType.number },
              ],
            });

            for (const point of s.pointlist) {
              frame.appendRow(point);
            }

            frames.push(frame);
          }

          return frames;
        })
        .catch((error: any) => {
          if ('data' in error && 'errors' in error.data) {
            throw new Error(error.data.errors.join('; '));
          } else {
            throw new Error(error);
          }
        });
    });

    return Promise.all(promises).then((targetData) => {
      let result: any = [];
      _.each(targetData, (targetAndData) => {
        // Flatten the list as Grafana expects a list of targets with corresponding datapoints.
        result.push(targetAndData);
      });

      return { data: _.flatten(result) };
    });
  }

  async fetchMetricNames(query: string, options?: any) {
    const parsedQuery = getTemplateSrv().replace(query, options.scopedVars);
    const result = await getBackendSrv().datasourceRequest({
      method: 'GET',
      url: this.url + this.routePath + '/api/v2/metrics/' + parsedQuery + '/all-tags',
    });

    return result.data.data.attributes.tags;
  }

  async metricFindQuery(query: string, options?: any) {
    const splitQuery: string[] = query.split('|'); // Retrieve DataQueryResponse based on query.
    const response = await this.fetchMetricNames(splitQuery[0], options);

    // Convert query results to a MetricFindValue[]
    let values = response.map((frame: any) => {
      let textArray: string[] = frame.split(':');

      if (splitQuery[1] === textArray[0]) {
        return { text: textArray[1] };
      }

      return false;
    });

    // removing empty values
    values = values.filter(Boolean);

    return values;
  }

  async testDatasourceRequest() {
    const result = await getBackendSrv().datasourceRequest({
      method: 'GET',
      url: this.url + this.routePath + '/api/v1/tags/hosts',
    });

    return result;
  }

  async testDatasource() {
    const response = await this.testDatasourceRequest();

    if ('error' in response.data) {
      throw new Error(response.data.error);
    }

    return {
      status: 'success',
      message: 'Success',
    };
  }
}
