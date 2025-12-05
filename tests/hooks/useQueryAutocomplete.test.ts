import { renderHook, act, waitFor } from '@testing-library/react';
import { useQueryAutocomplete } from '../../src/hooks/useQueryAutocomplete';
import * as parser from '../../src/utils/autocomplete/parser';
import * as suggestions from '../../src/utils/autocomplete/suggestions';
import * as validator from '../../src/utils/queryValidator';
import { getBackendSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime');
jest.mock('../../src/utils/autocomplete/parser');
jest.mock('../../src/utils/autocomplete/suggestions');
jest.mock('../../src/utils/queryValidator');

describe('useQueryAutocomplete', () => {
  const mockDatasourceUid = 'test-datasource-uid';
  const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid })
    );

    expect(result.current.state).toEqual({
      isOpen: false,
      suggestions: [],
      isLoading: false,
      selectedIndex: 0,
      error: undefined,
      validationError: undefined,
    });
  });

  it('should handle input and debounce API calls', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: ['metric.cpu', 'metric.memory'] });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
      cursorPosition: 5,
    });

    (suggestions.generateSuggestions as jest.Mock).mockReturnValue([
      { label: 'metric.cpu', insertText: 'metric.cpu' },
      { label: 'metric.memory', insertText: 'metric.memory' },
    ]);

    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid, debounceMs: 100 })
    );

    act(() => {
      result.current.onInput('met', 3);
    });

    // Should not call fetch immediately
    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward debounce timer
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Wait for async API call
    await waitFor(() => {
      expect(result.current.state.suggestions).toHaveLength(2);
    });

    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.suggestions[0].label).toBe('metric.cpu');
  });

  it('should handle keyboard navigation - arrow down', () => {
    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid })
    );

    // Manually set suggestions and open state
    act(() => {
      // We need to trigger input that sets suggestions
      // For now, set state directly via the hook's internal state
      result.current.onInput('met', 3);
    });

    // Set state to have suggestions by mocking the fetch
    const mockFetch = jest.fn().mockResolvedValue({
      data: ['metric.cpu', 'metric.memory', 'metric.disk'],
    });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
    });

    (suggestions.generateSuggestions as jest.Mock).mockReturnValue([
      { label: 'metric.cpu', insertText: 'metric.cpu' },
      { label: 'metric.memory', insertText: 'metric.memory' },
      { label: 'metric.disk', insertText: 'metric.disk' },
    ]);

    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });

    // Simulate arrow down key press
    const event = { key: 'ArrowDown', preventDefault: jest.fn() } as any;

    act(() => {
      result.current.onKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should handle escape key to close autocomplete', () => {
    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid })
    );

    // Open autocomplete by setting suggestions
    const mockFetch = jest.fn().mockResolvedValue({ data: ['metric.cpu'] });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
    });

    (suggestions.generateSuggestions as jest.Mock).mockReturnValue([
      { label: 'metric.cpu', insertText: 'metric.cpu' },
    ]);

    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });

    act(() => {
      result.current.onInput('met', 3);
      jest.advanceTimersByTime(400);
    });

    const event = { key: 'Escape', preventDefault: jest.fn() } as any;

    act(() => {
      result.current.onKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.state.isOpen).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    const mockFetch = jest.fn().mockRejectedValue({
      status: 401,
      name: 'Error',
    });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
    });

    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid, debounceMs: 100 })
    );

    act(() => {
      result.current.onInput('met', 3);
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.state.error).toBe('Datadog credentials invalid');
    });

    expect(result.current.state.isLoading).toBe(false);
  });

  it('should handle timeout errors', async () => {
    const mockFetch = jest.fn().mockRejectedValue({
      name: 'AbortError',
    });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
    });

    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid, debounceMs: 100 })
    );

    act(() => {
      result.current.onInput('met', 3);
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.state.error).toBe('Suggestions request timeout');
    });
  });

  it('should cancel debounce on new input', () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: [] });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
    });

    (suggestions.generateSuggestions as jest.Mock).mockReturnValue([]);
    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid, debounceMs: 100 })
    );

    act(() => {
      result.current.onInput('m', 1);
      jest.advanceTimersByTime(50);
      result.current.onInput('me', 2);
      jest.advanceTimersByTime(50);
      result.current.onInput('met', 3);
      jest.advanceTimersByTime(100);
    });

    // Should only call fetch once (last input)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should cleanup on unmount', () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: [] });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    const { unmount } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid })
    );

    unmount();

    // Should not throw errors during unmount
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle validation errors', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: ['metric.cpu'] });
    mockGetBackendSrv.mockReturnValue({ fetch: mockFetch } as any);

    (parser.parseQuery as jest.Mock).mockReturnValue({
      contextType: 'metric',
      metricName: '',
    });

    (suggestions.generateSuggestions as jest.Mock).mockReturnValue([
      { label: 'metric.cpu', insertText: 'metric.cpu' },
    ]);

    (validator.validateQuery as jest.Mock).mockReturnValue({
      isValid: false,
      errors: [{ message: 'Missing aggregation function' }],
    });

    const { result } = renderHook(() =>
      useQueryAutocomplete({ datasourceUid: mockDatasourceUid, debounceMs: 100 })
    );

    act(() => {
      result.current.onInput('metric.cpu', 10);
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.state.validationError).toBe('Missing aggregation function');
    });
  });
});
