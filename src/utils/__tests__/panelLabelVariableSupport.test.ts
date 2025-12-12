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

describe('Panel Legend Variable Support', () => {
  let service: VariableInterpolationService;

  beforeEach(() => {
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);
    service = new VariableInterpolationService();
    jest.clearAllMocks();
  });

  describe('Real-time legend updates', () => {
    it('should interpolate variables in panel legends', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:cpu.usage{service:$service}',
        legendMode: 'custom',
        legendTemplate: 'CPU Usage for $service',
      };

      const scopedVars: ScopedVars = {
        service: { text: 'web-server', value: 'web-server' },
      };

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text.replace('$service', 'web-server');
      });

      const result = service.interpolateQuery(query, scopedVars);

      // Verify that both legendTemplate and interpolatedLabel are populated
      expect(result.legendTemplate).toBe('CPU Usage for web-server');
      expect(result.interpolatedLabel).toBe('CPU Usage for web-server');
    });

    it('should handle multi-value variables in legends', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:cpu.usage{service:${service:csv}}',
        legendMode: 'custom',
        legendTemplate: 'CPU Usage for ${service:csv}',
      };

      // Mock multi-value variable
      mockTemplateSrv.getVariables.mockReturnValue([
        {
          name: 'service',
          current: { value: ['web-server', 'api-server', 'worker'] },
        },
      ]);

      const result = service.interpolateQuery(query, {});

      // Verify that multi-value variables are formatted correctly in legends
      expect(result.interpolatedLabel).toBe('CPU Usage for web-server,api-server,worker');
    });

    it('should gracefully handle interpolation failures in legends', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:cpu.usage{service:$service}',
        legendMode: 'custom',
        legendTemplate: 'CPU Usage for $service',
      };

      // Mock template service to throw an error
      mockTemplateSrv.replace.mockImplementation(() => {
        throw new Error('Template service error');
      });

      const result = service.interpolateQuery(query, {});

      // Verify graceful fallback - original legend template should be preserved
      expect(result.legendTemplate).toBe('CPU Usage for $service');
      expect(result.interpolatedLabel).toBe('CPU Usage for $service');
    });

    it('should handle empty legend templates gracefully', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:cpu.usage{service:$service}',
        legendMode: 'auto',
        legendTemplate: '',
      };

      const result = service.interpolateQuery(query, {});

      expect(result.legendTemplate).toBe('');
      expect(result.interpolatedLabel).toBe('');
    });

    it('should handle legend templates with built-in variables', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:cpu.usage{*}',
        legendMode: 'custom',
        legendTemplate: 'CPU Usage from $__from to $__to',
      };

      const scopedVars: ScopedVars = {
        __from: { text: '2023-01-01', value: '2023-01-01' },
        __to: { text: '2023-01-02', value: '2023-01-02' },
      };

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text.replace('$__from', '2023-01-01').replace('$__to', '2023-01-02');
      });

      const result = service.interpolateQuery(query, scopedVars);

      expect(result.interpolatedLabel).toBe('CPU Usage from 2023-01-01 to 2023-01-02');
    });

    it('should handle complex legend templates with multiple variables', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:cpu.usage{service:$service,env:$environment}',
        legendMode: 'custom',
        legendTemplate: '$metric for $service in $environment (${format:pipe})',
      };

      const scopedVars: ScopedVars = {
        service: { text: 'web-server', value: 'web-server' },
        environment: { text: 'production', value: 'production' },
        metric: { text: 'CPU Usage', value: 'CPU Usage' },
      };

      // Mock multi-value variable for format
      mockTemplateSrv.getVariables.mockReturnValue([
        {
          name: 'format',
          current: { value: ['json', 'csv'] },
        },
      ]);

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text
          .replace('$service', 'web-server')
          .replace('$environment', 'production')
          .replace('$metric', 'CPU Usage');
      });

      const result = service.interpolateQuery(query, scopedVars);

      expect(result.interpolatedLabel).toBe('CPU Usage for web-server in production (json|csv)');
    });
  });

  describe('Backend integration', () => {
    it('should populate interpolatedLabel field for backend consumption with custom legend', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:memory.usage{service:$service}',
        legendMode: 'custom',
        legendTemplate: 'Memory Usage - $service',
      };

      const scopedVars: ScopedVars = {
        service: { text: 'database', value: 'database' },
      };

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text.replace('$service', 'database');
      });

      const result = service.interpolateQuery(query, scopedVars);

      // Verify that the result has the interpolatedLabel field that the backend can use
      expect(result).toHaveProperty('interpolatedLabel');
      expect(result.interpolatedLabel).toBe('Memory Usage - database');
      
      // Verify that the legend template is also interpolated
      expect(result.legendTemplate).toBe('Memory Usage - database');
    });

    it('should handle auto legend mode for backend consumption', () => {
      const query: MyQuery = {
        refId: 'A',
        queryText: 'avg:memory.usage{service:$service}',
        legendMode: 'auto',
        legendTemplate: '',
      };

      const scopedVars: ScopedVars = {
        service: { text: 'database', value: 'database' },
      };

      mockTemplateSrv.replace.mockImplementation((text: string) => {
        return text.replace('$service', 'database');
      });

      const result = service.interpolateQuery(query, scopedVars);

      // Verify that auto mode results in empty interpolated label
      expect(result).toHaveProperty('interpolatedLabel');
      expect(result.interpolatedLabel).toBe('');
      expect(result.legendTemplate).toBe('');
    });


  });
});