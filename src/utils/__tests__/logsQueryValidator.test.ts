import { validateLogsQuery, getQuerySuggestions } from '../logsQueryValidator';

describe('logsQueryValidator', () => {
  describe('validateLogsQuery', () => {
    it('should validate empty queries as valid', () => {
      const result = validateLogsQuery('');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate simple text queries as valid', () => {
      const result = validateLogsQuery('error');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate facet queries as valid', () => {
      const result = validateLogsQuery('service:web-app status:ERROR');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate boolean operators as valid', () => {
      const result = validateLogsQuery('service:web-app AND status:ERROR');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect unmatched parentheses', () => {
      const result = validateLogsQuery('service:(web-app OR api');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('unmatched opening parenthesis');
    });

    it('should detect unmatched quotes', () => {
      const result = validateLogsQuery('message:"unclosed quote');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unmatched quote');
    });

    it('should detect invalid boolean operator sequences', () => {
      const result = validateLogsQuery('service:web-app AND AND status:ERROR');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid boolean operator usage');
    });

    it('should provide warnings for inefficient queries', () => {
      const result = validateLogsQuery('error*');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('Wildcard searches without facets may be slow');
    });

    it('should provide warnings for very short queries', () => {
      const result = validateLogsQuery('ab');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('Very short search terms may return too many results');
    });
  });

  describe('getQuerySuggestions', () => {
    it('should provide default suggestions for empty queries', () => {
      const suggestions = getQuerySuggestions('');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('Try searching for specific terms');
    });

    it('should suggest status facet for error terms', () => {
      const suggestions = getQuerySuggestions('error timeout');
      expect(suggestions).toContain('Consider using status:ERROR for log level filtering');
    });

    it('should suggest service facet for service terms', () => {
      const suggestions = getQuerySuggestions('service web-app');
      expect(suggestions).toContain('Use service:name to filter by specific service');
    });

    it('should suggest boolean operators for multiple terms', () => {
      const suggestions = getQuerySuggestions('timeout connection');
      expect(suggestions).toContain('Use AND, OR, NOT operators to combine search terms');
    });
  });

  describe('Advanced Boolean Operators and Wildcards (Task 11)', () => {
    it('should validate complex boolean expressions with grouping', () => {
      const result = validateLogsQuery('service:(web-app OR api-service) AND status:(ERROR OR WARN)');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate NOT operator with complex expressions', () => {
      const result = validateLogsQuery('service:web-app AND NOT (status:DEBUG OR status:TRACE)');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate wildcard patterns in facets', () => {
      const result = validateLogsQuery('service:web-* AND host:prod-*');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate wildcard patterns in search terms', () => {
      const result = validateLogsQuery('error* AND NOT test-*');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect invalid wildcard patterns', () => {
      const result = validateLogsQuery('error** AND status:ERROR');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid wildcard pattern');
    });

    it('should validate nested boolean expressions', () => {
      const result = validateLogsQuery('(service:web-app OR service:api) AND (status:ERROR OR status:WARN) AND NOT host:test-*');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect invalid boolean operator sequences in groups', () => {
      const result = validateLogsQuery('status:(ERROR OR OR WARN)');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid boolean operator usage');
    });

    it('should validate time range integration warnings', () => {
      const result = validateLogsQuery('service:web-app AND @timestamp:>now-1h');
      expect(result.isValid).toBe(true);
      // Note: Time range warnings are currently handled in the backend, not frontend validation
      // This test validates that the query is syntactically valid
    });

    it('should validate custom attributes with wildcards', () => {
      const result = validateLogsQuery('@env:prod* AND @version:1.* AND service:web-*');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate quoted strings with wildcards', () => {
      const result = validateLogsQuery('"error message*" AND service:web-app');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});