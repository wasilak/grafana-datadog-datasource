import { DataQueryRequest } from '@grafana/data';
import { lastValueFrom } from 'rxjs';
import type { DataSource } from '../datasource';
import { DatadogVariableQuery } from '../types';
import { DatadogVariableSupport } from '../variables';

describe('DatadogVariableSupport', () => {
  const values = [{ text: 'host-a' }, { text: 'host-b' }];
  const metricFindQuery = jest.fn().mockResolvedValue(values);
  const support = new DatadogVariableSupport({ metricFindQuery } as unknown as DataSource);

  const run = (target: DatadogVariableQuery | string) =>
    lastValueFrom(support.query({ targets: [target] } as unknown as DataQueryRequest<DatadogVariableQuery>));

  beforeEach(() => metricFindQuery.mockClear());

  it('passes the saved query to metricFindQuery and returns its values as data', async () => {
    const target: DatadogVariableQuery = { refId: 'A', queryType: 'tag_values', metricName: 'system.cpu.user', tagKey: 'host' };

    const response = await run(target);

    expect(metricFindQuery).toHaveBeenCalledWith(target);
    expect(response.data).toEqual(values);
  });

  it('passes legacy JSON string queries through unchanged', async () => {
    const legacy = JSON.stringify({ queryType: 'metrics', metricName: 'system.*' });

    await run(legacy);

    expect(metricFindQuery).toHaveBeenCalledWith(legacy);
  });
});
