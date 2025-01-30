import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  DataFrame,
  MetricFindValue,
} from '@grafana/data';

import _ from 'lodash';

import { firstValueFrom } from 'rxjs';

import { MyQuery, MyDataSourceOptions } from './types';

import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';

type FetchResponse<T> = {
  data: T;
};

type DatadogHostTagsResponse = {
  tags: {
    [key: string]: string[]; // Dynamic keys with string arrays as values
  };
};

type DatadogTagsResponse = {
  data: {
    attributes: {
      tags: string[];
    };
    id: string;
    type: string;
  };
};

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;

  routePath = '/wasilak-datadog-datasource';

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url;
  }

  async doRequest(from: number, to: number, query: MyQuery, options: any) {
    const parsedQuery = encodeURIComponent(getTemplateSrv().replace(query.queryText, options.scopedVars, 'csv'));

    const response = await firstValueFrom(
      getBackendSrv().fetch({
        method: 'GET',
        url: this.url + this.routePath + '/api/v1/query?from=' + from + '&to=' + to + '&query=' + parsedQuery,
      })
    );

    return response;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;

    // Datadog accepts seconds not milliseconds
    const from = range!.from.valueOf() / 1000;
    const to = range!.to.valueOf() / 1000;

    const promises = options.targets.map((query) => {
      const frames: DataFrame[] = [];

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
            const labels = Object.fromEntries(s.tag_set.map((tag: string) => tag.split(':')));

            const timeValues = s.pointlist.map((point: any) => point[0]); // Extract timestamps
            const valueValues = s.pointlist.map((point: any) => point[1]); // Extract values

            let seriesName: string = s.metric + ' {' + s.tag_set.join(', ') + '}';
            if ('label' in query && query.label.length > 0) {
              seriesName = query.label;

              // Normalize {{host}} to $host
              seriesName = seriesName.replace(/\{\{(.+?)\}\}/g, '$$$1');

              // Build a scoped variable object for the tags
              const scopedVars: Record<string, any> = {};
              for (const tag of s.tag_set) {
                const [key, value] = tag.split(':');
                scopedVars[key] = { value };
              }

              // Replace placeholders in the label using getTemplateSrv().replace()
              seriesName = getTemplateSrv().replace(seriesName, scopedVars);
            }

            const frame = {
              schema: {
                refId: query.refId,
                meta: {
                  type: 'timeseries-multi',
                  typeVersion: [0, 1],
                  custom: {
                    resultType: 'matrix',
                  },
                  executedQueryString: query.queryText,
                },
              },
              fields: [
                {
                  name: 'Time',
                  type: FieldType.time,
                  config: { interval: s.interval * 1000 },
                  values: timeValues,
                },
                {
                  name: seriesName,
                  type: FieldType.number,
                  labels: labels,
                  config: {
                    displayNameFromDS: seriesName,
                  },
                  values: valueValues,
                },
              ],
              length: timeValues.length, // Add the length property
            };

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

  async fetchMetricNames(query: string, options?: any): Promise<string[]> {
    const parsedQuery = getTemplateSrv().replace(query, options?.scopedVars);

    // Fetch the response from the Datadog API
    const response = await firstValueFrom(
      getBackendSrv().fetch({
        method: 'GET',
        url: `${this.url}${this.routePath}/api/v2/metrics/${parsedQuery}/all-tags`,
      })
    );

    // Cast the response to the expected structure
    const result = response as FetchResponse<DatadogTagsResponse>;

    // Extract and return the tags array
    return result.data.data.attributes.tags || [];
  }

  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    const splitQuery: string[] = query.split('|'); // Split the query into parts
    const metricName = splitQuery[0];
    const filterPrefix = splitQuery[1]?.trim(); // Trim whitespace to avoid issues with empty input

    // Fetch the tags for the given metric name
    const tags = await this.fetchMetricNames(metricName, options);

    // Map the tags to the MetricFindValue[] format
    const values: MetricFindValue[] = tags
      .map((tag: string) => {
        const [prefix, value] = tag.split(':'); // Split the tag into prefix and value

        if (!value) {
          // Skip tags that don't have a proper `prefix:value` structure
          return null;
        }

        // If filterPrefix is not provided, return the full tag (prefix:value)
        if (!filterPrefix) {
          return { text: `${prefix}:${value}` }; // Return the full tag
        }

        // Otherwise, filter by prefix and return only the value
        if (filterPrefix === prefix) {
          return { text: value }; // Return a valid MetricFindValue
        }

        return null; // Exclude unmatched tags
      })
      .filter((value): value is MetricFindValue => value !== null); // Remove null values

    return values;
  }

  async testDatasourceRequest() {
    // Fetch the response and cast it to the correct type
    const response = await firstValueFrom(
      getBackendSrv().fetch({
        method: 'GET',
        url: this.url + this.routePath + '/api/v1/tags/hosts',
      })
    );

    return response;
  }

  async testDatasource() {
    const response = await this.testDatasourceRequest();

    const result = response as FetchResponse<DatadogHostTagsResponse>;

    if (response.status !== 200) {
      throw new Error(response.statusText);
    }

    return {
      status: 'success',
      message: 'Success',
      result: result.data,
    };
  }
}
