import { VariableInterpolationService } from '../variableInterpolation';
import { MyQuery } from '../../types';
import { ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

// Mock the template service
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

const mockTemplateSrv = {
  replace: jest.fn(),
  getVariables: jest.fn(),
};

describe('VariableInterpolationService', () => {
  let service: VariableInterpolationService;

  beforeEach(() => {
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);
    service = new VariableInterpolationService();
    jest.clearAllMocks();
  });

  describe('interpolateQuery', () => {
    it('should interpolate variables in query text and label', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'metric{service:$service}',
        label: 'Service: $service',
      };

      const scopedVars: ScopedVars = {
        service: { text: 'web', value: 'web' },
      };

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text.replace('$service', 'web');
      });

      const result = service.interpolateQuery(query, scopedVars);

      expect(result.queryText).toBe('metric{service:web}');
      expect(result.label).toBe('Service: web');
      expect(result.interpolatedQueryText).toBe('metric{service:web}');
      expect(result.interpolatedLabel).toBe('Service: web');
    });

    it('should handle empty query text and label gracefully', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: '',
        label: '',
      };

      const result = service.interpolateQuery(query, {});

      expect(result.queryText).toBe('');
      expect(result.label).toBe('');
      expect(result.interpolatedQueryText).toBe('');
      expect(result.interpolatedLabel).toBe('');
    });

    it('should return original query on interpolation error', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'metric{service:$service}',
        label: 'Service: $service',
      };

      mockTemplateSrv.replace.mockImplementation(() => {
        throw new Error('Template service error');
      });

      const result = service.interpolateQuery(query, {});

      expect(result.queryText).toBe('metric{service:$service}');
      expect(result.label).toBe('Service: $service');
      expect(result.interpolatedQueryText).toBe('metric{service:$service}');
      expect(result.interpolatedLabel).toBe('Service: $service');
    });
  });

  describe('interpolateLabel', () => {
    it('should interpolate variables in label string', () => {
      const label = 'Service: $service, Environment: $env';
      const scopedVars: ScopedVars = {
        service: { text: 'web', value: 'web' },
        env: { text: 'prod', value: 'prod' },
      };

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text.replace('$service', 'web').replace('$env', 'prod');
      });

      const result = service.interpolateLabel(label, scopedVars);

      expect(result).toBe('Service: web, Environment: prod');
    });

    it('should return original label on error', () => {
      const label = 'Service: $service';

      mockTemplateSrv.replace.mockImplementation(() => {
        throw new Error('Template service error');
      });

      const result = service.interpolateLabel(label, {});

      expect(result).toBe('Service: $service');
    });
  });

  describe('formatMultiValue', () => {
    it('should format values as CSV by default', () => {
      const values = ['web', 'api', 'worker'];
      const result = service.formatMultiValue(values);

      expect(result).toBe('web,api,worker');
    });

    it('should format values as CSV when specified', () => {
      const values = ['web', 'api', 'worker'];
      const result = service.formatMultiValue(values, 'csv');

      expect(result).toBe('web,api,worker');
    });

    it('should format values as pipe-separated when specified', () => {
      const values = ['web', 'api', 'worker'];
      const result = service.formatMultiValue(values, 'pipe');

      expect(result).toBe('web|api|worker');
    });

    it('should format values as JSON when specified', () => {
      const values = ['web', 'api', 'worker'];
      const result = service.formatMultiValue(values, 'json');

      expect(result).toBe('["web","api","worker"]');
    });

    it('should format values as Lucene query when specified', () => {
      const values = ['web', 'api', 'worker'];
      const result = service.formatMultiValue(values, 'lucene');

      expect(result).toBe('("web" OR "api" OR "worker")');
    });

    it('should return first value for raw format', () => {
      const values = ['web', 'api', 'worker'];
      const result = service.formatMultiValue(values, 'raw');

      expect(result).toBe('web');
    });

    it('should handle empty values array', () => {
      const values: string[] = [];
      const result = service.formatMultiValue(values);

      expect(result).toBe('');
    });

    it('should filter out null, undefined, and empty values', () => {
      const values = ['web', '', null as any, undefined as any, 'api'];
      const result = service.formatMultiValue(values);

      expect(result).toBe('web,api');
    });

    it('should escape special characters in Lucene format', () => {
      const values = ['web+api', 'test-service', 'query:value'];
      const result = service.formatMultiValue(values, 'lucene');

      expect(result).toBe('("web\\+api" OR "test\\-service" OR "query\\:value")');
    });
  });

  describe('hasVariables', () => {
    it('should detect simple variable patterns', () => {
      expect(service.hasVariables('metric{service:$service}')).toBe(true);
      expect(service.hasVariables('$__from to $__to')).toBe(true);
      expect(service.hasVariables('no variables here')).toBe(false);
      expect(service.hasVariables('')).toBe(false);
    });

    it('should detect formatted variable patterns', () => {
      expect(service.hasVariables('${service:csv}')).toBe(true);
      expect(service.hasVariables('${env:pipe}')).toBe(true);
      expect(service.hasVariables('no variables here')).toBe(false);
    });
  });

  describe('extractVariableNames', () => {
    it('should extract simple variable names', () => {
      const text = 'metric{service:$service,env:$environment}';
      const result = service.extractVariableNames(text);

      expect(result).toEqual(['service', 'environment']);
    });

    it('should extract formatted variable names', () => {
      const text = 'metric{service:${service:csv},env:${environment:pipe}}';
      const result = service.extractVariableNames(text);

      expect(result).toEqual(['service', 'environment']);
    });

    it('should extract mixed variable patterns', () => {
      const text = 'metric{service:$service,tags:${tags:csv}}';
      const result = service.extractVariableNames(text);

      expect(result).toEqual(['tags', 'service']);
    });

    it('should return empty array for text without variables', () => {
      const text = 'metric{service:web,env:prod}';
      const result = service.extractVariableNames(text);

      expect(result).toEqual([]);
    });

    it('should handle empty or null text', () => {
      expect(service.extractVariableNames('')).toEqual([]);
      expect(service.extractVariableNames(null as any)).toEqual([]);
    });

    it('should not duplicate variable names', () => {
      const text = '$service and $service again';
      const result = service.extractVariableNames(text);

      expect(result).toEqual(['service']);
    });
  });

  describe('custom format interpolation', () => {
    beforeEach(() => {
      mockTemplateSrv.getVariables.mockReturnValue([
        {
          name: 'service',
          current: { value: ['web', 'api', 'worker'] },
        },
        {
          name: 'env',
          current: { value: 'prod' },
        },
      ]);
    });

    it('should handle custom format specifiers in interpolation', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'metric{service:${service:pipe}}',
      };

      const result = service.interpolateQuery(query, {});

      expect(result.queryText).toBe('metric{service:web|api|worker}');
    });

    it('should handle multiple custom format specifiers', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'metric{service:${service:csv},env:${env:raw}}',
      };

      const result = service.interpolateQuery(query, {});

      expect(result.queryText).toBe('metric{service:web,api,worker,env:prod}');
    });

    it('should fallback to original text if variable not found', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'metric{service:${unknown:csv}}',
      };

      const result = service.interpolateQuery(query, {});

      expect(result.queryText).toBe('metric{service:${unknown:csv}}');
    });
  });
});