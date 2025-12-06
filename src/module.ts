import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { MyQuery, MyDataSourceOptions, MySecureJsonData } from './types';

// Export DataSource class with both names for compatibility
export { DataSource };
export const Datasource = DataSource;

const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions, MySecureJsonData>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);

export default plugin;
export { plugin };
