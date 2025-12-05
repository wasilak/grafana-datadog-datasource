import { parseQuery } from '../../../src/utils/autocomplete/parser';
import { QueryContext } from '../../../src/types';

describe('parseQuery', () => {
  describe('empty query handling', () => {
    it('should return empty context for empty query', () => {
      const result = parseQuery('', 0);
      expect(result.contextType).toBe('metric');
      expect(result.currentToken).toBe('');
      expect(result.existingTags.size).toBe(0);
      expect(result.lineContent).toBe('');
    });

    it('should return empty context for whitespace-only query', () => {
      const result = parseQuery('   ', 1);
      expect(result.contextType).toBe('metric');
      expect(result.currentToken).toBe('');
      expect(result.existingTags.size).toBe(0);
    });
  });

  describe('metric context detection', () => {
    it('should detect metric context at query start', () => {
      const result = parseQuery('system.cpu', 0);
      expect(result.contextType).toBe('metric');
      expect(result.currentToken).toBe('system');
    });

    it('should detect metric context while typing metric name', () => {
      const result = parseQuery('system.cpu', 5);
      expect(result.contextType).toBe('metric');
      expect(result.currentToken).toBe('system');
    });

    it('should extract metric name', () => {
      const result = parseQuery('system.cpu.by_host', 18);
      expect(result.metricName).toBe('system.cpu.by_host');
    });

    it('should handle metric with dots and underscores', () => {
      const result = parseQuery('system.mem.pct_free', 19);
      expect(result.contextType).toBe('metric');
      expect(result.metricName).toBe('system.mem.pct_free');
    });

    it('should stop metric extraction at opening brace', () => {
      const result = parseQuery('system.cpu{', 10);
      expect(result.metricName).toBe('system.cpu');
    });

    it('should stop metric extraction at "by" keyword', () => {
      const result = parseQuery('system.cpu by avg', 10);
      expect(result.metricName).toBe('system.cpu');
    });
  });

  describe('tag context detection', () => {
    it('should detect tag context inside braces', () => {
      const result = parseQuery('system.cpu{host', 14);
      expect(result.contextType).toBe('tag');
      expect(result.currentToken).toBe('host');
    });

    it('should detect tag context after opening brace', () => {
      const result = parseQuery('system.cpu{', 11);
      expect(result.contextType).toBe('tag');
      expect(result.currentToken).toBe('');
    });

    it('should detect tag context with multiple tags', () => {
      const result = parseQuery('system.cpu{host:web-01,env', 26);
      expect(result.contextType).toBe('tag');
      expect(result.currentToken).toBe('env');
    });

    it('should extract existing tags', () => {
      const result = parseQuery('system.cpu{host:web-01,env:prod}', 20);
      expect(result.existingTags.has('host')).toBe(true);
      expect(result.existingTags.has('env')).toBe(true);
      expect(result.existingTags.size).toBe(2);
    });

    it('should handle incomplete tag without colon in existing tags', () => {
      const result = parseQuery('system.cpu{host:web-01,env', 26);
      expect(result.existingTags.has('host')).toBe(true);
      expect(result.existingTags.has('env')).toBe(true);
    });

    it('should not extract tags when closing brace is reached', () => {
      const result = parseQuery('system.cpu{host:web-01}', 23);
      expect(result.contextType).toBe('metric');
    });

    it('should handle tags with whitespace', () => {
      const result = parseQuery('system.cpu{ host : web-01 }', 15);
      expect(result.existingTags.has('host')).toBe(true);
    });

    it('should handle empty tag section', () => {
      const result = parseQuery('system.cpu{}', 11);
      expect(result.existingTags.size).toBe(0);
    });
  });

  describe('tag_value context detection', () => {
    it('should detect tag_value context after colon', () => {
      const result = parseQuery('system.cpu{host:web', 19);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('web');
    });

    it('should detect tag_value context right after colon', () => {
      const result = parseQuery('system.cpu{host:', 15);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('');
    });

    it('should detect tag_value with multiple existing tags', () => {
      const result = parseQuery('system.cpu{host:web-01,env:prod', 31);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('prod');
      expect(result.existingTags.has('host')).toBe(true);
      expect(result.existingTags.has('env')).toBe(true);
    });

    it('should handle tag_value with hyphens', () => {
      const result = parseQuery('system.cpu{host:web-01-prod', 27);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('web-01-prod');
    });

    it('should handle tag_value with underscores', () => {
      const result = parseQuery('system.cpu{service:my_service_name', 34);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('my_service_name');
    });
  });

  describe('aggregation context detection', () => {
    it('should detect aggregation context after "by"', () => {
      const result = parseQuery('system.cpu{host:web} by avg', 26);
      expect(result.contextType).toBe('aggregation');
      expect(result.currentToken).toBe('avg');
    });

    it('should detect aggregation context right after "by"', () => {
      const result = parseQuery('system.cpu{host:web} by ', 24);
      expect(result.contextType).toBe('aggregation');
      expect(result.currentToken).toBe('');
    });

    it('should detect aggregation with various spacing', () => {
      const result = parseQuery('system.cpu{host:web}  by  sum', 29);
      expect(result.contextType).toBe('aggregation');
      expect(result.currentToken).toBe('sum');
    });

    it('should handle "by" at different positions', () => {
      const result = parseQuery('metric{tag:val} by max', 21);
      expect(result.contextType).toBe('aggregation');
    });

    it('should not detect aggregation if "by" appears in tag value', () => {
      const result = parseQuery('system.cpu{host:web-by-01}', 25);
      expect(result.contextType).toBe('tag_value');
    });

    it('should require whitespace before and after "by"', () => {
      const result = parseQuery('system.cpu_by{host:web}', 22);
      expect(result.contextType).not.toBe('aggregation');
    });
  });

  describe('current token extraction', () => {
    it('should extract current token at cursor position', () => {
      const result = parseQuery('system.cpu{host:web-', 19);
      expect(result.currentToken).toBe('web-');
    });

    it('should extract token with dots', () => {
      const result = parseQuery('system.mem.pct{', 10);
      expect(result.currentToken).toBe('system');
    });

    it('should handle cursor at token boundary', () => {
      const result = parseQuery('system cpu', 6);
      expect(result.currentToken).toBe('system');
    });

    it('should return empty token at whitespace', () => {
      const result = parseQuery('system  ', 7);
      expect(result.currentToken).toBe('');
    });

    it('should handle token with numbers', () => {
      const result = parseQuery('env123', 6);
      expect(result.currentToken).toBe('env123');
    });

    it('should stop token extraction at special characters', () => {
      const result = parseQuery('metric{tag', 9);
      expect(result.currentToken).toBe('tag');
    });

    it('should handle cursor at line start', () => {
      const result = parseQuery('system.cpu', 0);
      expect(result.currentToken).toBe('system');
    });

    it('should handle cursor at line end', () => {
      const result = parseQuery('system.cpu', 10);
      expect(result.currentToken).toBe('cpu');
    });
  });

  describe('multiline query handling', () => {
    it('should handle cursor on first line of multiline query', () => {
      const query = 'system.cpu\nhost:web';
      const result = parseQuery(query, 5);
      expect(result.lineContent).toBe('system.cpu');
      expect(result.contextType).toBe('metric');
    });

    it('should handle cursor on second line of multiline query', () => {
      const query = 'system.cpu\nhost:web';
      const result = parseQuery(query, 15);
      expect(result.lineContent).toBe('host:web');
    });

    it('should handle cursor at newline character', () => {
      const query = 'system.cpu\nhost:web';
      const result = parseQuery(query, 10);
      expect(result.contextType).toBe('metric');
    });

    it('should handle multiple newlines', () => {
      const query = 'system.cpu\n\n\nhost:web';
      const result = parseQuery(query, 13);
      expect(result.contextType).toBe('metric');
    });

    it('should process tag context on second line', () => {
      const query = 'first_query\nsystem.cpu{host';
      const result = parseQuery(query, 23);
      expect(result.contextType).toBe('tag');
      expect(result.currentToken).toBe('host');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in metric names', () => {
      const result = parseQuery('system-cpu.load', 15);
      expect(result.contextType).toBe('metric');
    });

    it('should handle cursor beyond query length', () => {
      const result = parseQuery('system.cpu', 100);
      expect(result.cursorPosition).toBe(100);
    });

    it('should handle query with only opening brace', () => {
      const result = parseQuery('system.cpu{', 11);
      expect(result.contextType).toBe('tag');
    });

    it('should handle query with only closing brace', () => {
      const result = parseQuery('system.cpu}', 11);
      expect(result.contextType).toBe('metric');
    });

    it('should handle mismatched braces - multiple opening', () => {
      const result = parseQuery('system.cpu{host{web', 19);
      expect(result.contextType).toBe('tag');
    });

    it('should handle tags with colons in values (edge case)', () => {
      const result = parseQuery('system.cpu{url:http://test}', 15);
      expect(result.contextType).toBe('tag_value');
    });

    it('should handle empty token between special chars', () => {
      const result = parseQuery('system.cpu{}', 11);
      expect(result.currentToken).toBe('');
      expect(result.contextType).toBe('tag');
    });

    it('should handle very long metric names', () => {
      const longMetric = 'system.' + 'a'.repeat(1000);
      const result = parseQuery(longMetric, 1000);
      expect(result.metricName).toBeDefined();
    });

    it('should handle query with numbers and special chars', () => {
      const result = parseQuery('metric123{tag_1:value-2', 23);
      expect(result.contextType).toBe('tag_value');
      expect(result.metricName).toBe('metric123');
    });

    it('should handle cursor right after comma in tags', () => {
      const result = parseQuery('system.cpu{host:web,env:prod,', 29);
      expect(result.contextType).toBe('tag');
      expect(result.currentToken).toBe('');
    });

    it('should handle tag with no value (incomplete)', () => {
      const result = parseQuery('system.cpu{host:', 15);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('');
    });

    it('should return context position correctly', () => {
      const result = parseQuery('system.cpu{host:web}', 15);
      expect(result.cursorPosition).toBe(15);
    });

    it('should handle tabs in query', () => {
      const result = parseQuery('system.cpu\t{host:web}', 11);
      expect(result.contextType).toBe('tag');
    });
  });

  describe('return value structure', () => {
    it('should always return QueryContext with all required fields', () => {
      const result = parseQuery('system.cpu{host:web}', 10);
      expect(result).toHaveProperty('cursorPosition');
      expect(result).toHaveProperty('currentToken');
      expect(result).toHaveProperty('contextType');
      expect(result).toHaveProperty('existingTags');
      expect(result).toHaveProperty('lineContent');
      expect(result.existingTags).toBeInstanceOf(Set);
    });

    it('should have metricName property when applicable', () => {
      const result = parseQuery('system.cpu{host:web}', 10);
      expect(result).toHaveProperty('metricName');
    });

    it('should have contextType be one of valid options', () => {
      const validTypes = ['metric', 'aggregation', 'tag', 'tag_value', 'other'];
      const result = parseQuery('system.cpu{host:web}', 10);
      expect(validTypes).toContain(result.contextType);
    });

    it('should have existingTags be an empty Set when no tags', () => {
      const result = parseQuery('system.cpu', 5);
      expect(result.existingTags).toBeInstanceOf(Set);
      expect(result.existingTags.size).toBe(0);
    });
  });

  describe('real-world query examples', () => {
    it('should handle typical simple metric query', () => {
      const result = parseQuery('system.load.1', 5);
      expect(result.contextType).toBe('metric');
      expect(result.metricName).toBe('system.load.1');
    });

    it('should handle typical query with tags', () => {
      const result = parseQuery('system.cpu{host:web-01,env:prod}', 28);
      expect(result.contextType).toBe('tag_value');
      expect(result.existingTags.size).toBe(2);
      expect(result.metricName).toBe('system.cpu');
    });

    it('should handle query with aggregation', () => {
      const result = parseQuery('system.memory{service:db} by avg', 32);
      expect(result.contextType).toBe('aggregation');
      expect(result.currentToken).toBe('avg');
    });

    it('should handle partial query being typed', () => {
      const query = 'system.cpu{host:web-01,service:app-';
      const result = parseQuery(query, query.length - 1);
      expect(result.contextType).toBe('tag_value');
      expect(result.currentToken).toBe('app-');
    });

    it('should handle query with no tags specified yet', () => {
      const result = parseQuery('system.cpu{}', 11);
      expect(result.contextType).toBe('tag');
      expect(result.existingTags.size).toBe(0);
    });

    it('should handle query with spaces around braces', () => {
      const result = parseQuery('system.cpu { host : web } by avg', 20);
      expect(result.contextType).toBe('tag_value');
    });
  });
});
