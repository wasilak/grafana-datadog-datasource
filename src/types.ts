import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  label?: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  queryText: '',
  label: '',
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  site?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
  appKey?: string;
}

export interface MyVariableQuery {
  rawQuery: string;
}
