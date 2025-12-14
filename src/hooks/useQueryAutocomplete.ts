import { useCallback, useEffect, useRef, useState } from 'react';
import { AutocompleteState, QueryContext, CompletionItem } from '../types';
import { parseQuery, parseLogsQuery } from '../utils/autocomplete/parser';
import { generateSuggestions, generateLogsSuggestions, groupSuggestions } from '../utils/autocomplete/suggestions';
import { validateQuery } from '../utils/queryValidator';
import { validateLogsQuery } from '../utils/logsQueryValidator';
import { getBackendSrv } from '@grafana/runtime';
import { variableInterpolationService } from '../utils/variableInterpolation';
import { LogsCompletionItemProvider } from '../utils/autocomplete/logsCompletionProvider';

const DEFAULT_DEBOUNCE_MS = 1000; // 1s for debugging (normally 400ms)

interface UseQueryAutocompleteOptions {
  datasourceUid: string;
  debounceMs?: number;
  onSelect?: (item: CompletionItem) => void;
  queryType?: 'metrics' | 'logs'; // Add query type to determine which autocomplete to use
}

interface UseQueryAutocompleteReturn {
  state: AutocompleteState;
  onInput: (queryText: string, cursorPosition: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onItemSelect: (item: CompletionItem) => void;
  onMouseEnter: (index: number) => void;
  onMouseClick: (item: CompletionItem) => void;
  onClose: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onSelectCurrent: () => void;
}

/**
 * Hook that manages autocomplete state, debouncing, and API orchestration
 * Handles keyboard navigation and suggestion selection
 *
 * @param options - Configuration options including datasource instance and debounce timing
 * @returns Object with state and handlers for autocomplete UI
 */
export function useQueryAutocomplete(options: UseQueryAutocompleteOptions): UseQueryAutocompleteReturn {
  const { datasourceUid, debounceMs = DEFAULT_DEBOUNCE_MS, onSelect, queryType = 'metrics' } = options;

  // Validate datasource UID is provided
  if (!datasourceUid) {
    console.warn('useQueryAutocomplete: datasourceUid is required but not provided');
  }

  // Initialize logs completion provider for context-aware suggestions
  const logsProviderRef = useRef<LogsCompletionItemProvider>(new LogsCompletionItemProvider());

  // State management
  const [state, setState] = useState<AutocompleteState>({
    isOpen: false,
    suggestions: [],
    groupedSuggestions: [],
    isLoading: false,
    selectedIndex: 0,
    hoveredIndex: null,
    error: !datasourceUid ? 'Backend datasource UID not available' : undefined,
    validationError: undefined,
  });

  // Track current query for context and suggestion regeneration
  const currentQueryRef = useRef<string>('');
  const currentCursorRef = useRef<number>(0);
  const contextRef = useRef<QueryContext | null>(null);

  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch suggestions from backend endpoints and update state
   */
  const fetchAndUpdateSuggestions = useCallback(
    async (context: QueryContext, queryText: string) => {
      setState((prev: AutocompleteState) => ({ ...prev, isLoading: true, error: undefined }));

      const timeoutHandle = setTimeout(() => {
        // Timeout - abort the fetch
        setState((prev: AutocompleteState) => ({
          ...prev,
          isLoading: false,
          error: 'Suggestions request timeout',
          suggestions: [],
          isOpen: true,
        }));
      }, 2000); // 2-second timeout

      try {
        // Validate query based on query type
        const validationResult = queryType === 'logs' 
          ? validateLogsQuery(queryText)
          : validateQuery(queryText);

        // Fetch data based on query type - metrics for metrics queries, logs data for logs queries
        let metrics: string[] = [];
        let logsServices: string[] = [];
        let logsSources: string[] = [];
        let logsLevels: string[] = [];
        let logsFields: string[] = [];
        
        if (queryType === 'metrics') {
          // Fetch metric names from backend (existing pattern)
          try {
            const metricsResponse = await getBackendSrv()
              .fetch({
                url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/metrics`,
                method: 'GET',
              })
              .toPromise();
            metrics = (metricsResponse as any).data as string[];
          } catch (metricsError) {
            const err = metricsError as any;
            if (err.status === 401) {
              throw new Error('Datadog credentials invalid');
            } else if (err.status === 404) {
              throw new Error('Endpoint not found (backend not available)');
            } else {
              console.warn('Failed to fetch metrics:', metricsError);
              // Continue with empty metrics if backend call fails
              metrics = [];
            }
          }
        } else if (queryType === 'logs') {
          // Fetch logs services, sources, levels, and fields from backend (reusing existing patterns)
          const logsEndpoints = [
            { name: 'services', url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/logs/services`, target: 'logsServices' },
            { name: 'sources', url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/logs/sources`, target: 'logsSources' },
            { name: 'levels', url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/logs/levels`, target: 'logsLevels' },
            { name: 'fields', url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/logs/fields`, target: 'logsFields' }
          ];

          // Fetch all logs autocomplete data in parallel for better performance
          const logsPromises = logsEndpoints.map(async (endpoint) => {
            try {
              const response = await getBackendSrv()
                .fetch({
                  url: endpoint.url,
                  method: 'GET',
                })
                .toPromise();
              return { target: endpoint.target, data: (response as any).data as string[] };
            } catch (error) {
              const err = error as any;
              if (err.status === 401) {
                throw new Error('Datadog credentials invalid');
              } else if (err.status === 404) {
                throw new Error(`Logs ${endpoint.name} endpoint not found (backend not available)`);
              } else {
                console.warn(`Failed to fetch logs ${endpoint.name}:`, error);
                // Continue with empty data if backend call fails
                return { target: endpoint.target, data: [] };
              }
            }
          });

          // Wait for all logs data to be fetched
          const logsResults = await Promise.all(logsPromises);
          
          // Assign results to appropriate variables
          logsResults.forEach(result => {
            switch (result.target) {
              case 'logsServices':
                logsServices = result.data;
                break;
              case 'logsSources':
                logsSources = result.data;
                break;
              case 'logsLevels':
                logsLevels = result.data;
                break;
              case 'logsFields':
                logsFields = result.data;
                break;
            }
          });
        }

        // Fetch tags for the metric if in tag context or grouping_tag context
        let tags: string[] = [];
        if ((context.contextType === 'tag' || context.contextType === 'tag_value' || context.contextType === 'grouping_tag' || context.contextType === 'filter_tag_key') && context.metricName) {
          try {
            const tagsResponse = await getBackendSrv()
              .fetch({
                url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/tags/${context.metricName}`,
                method: 'GET',
              })
              .toPromise();
            tags = (tagsResponse as any).data as string[];
          } catch (tagsError) {
            const err = tagsError as any;
            if (err.status === 401) {
              throw new Error('Datadog credentials invalid');
            } else if (err.status === 404) {
              throw new Error('Endpoint not found (backend not available)');
            } else {
              console.warn('Failed to fetch tags:', tagsError);
              // Continue with metrics-only suggestions if tags fail
              tags = [];
            }
          }
        }

        // Fetch tag values for the specific tag key if in filter_tag_value context
        let tagValues: string[] = [];
        if (context.contextType === 'filter_tag_value' && context.metricName && context.tagKey) {
          try {
            const tagValuesResponse = await getBackendSrv()
              .fetch({
                url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/tag-values/${context.metricName}/${context.tagKey}`,
                method: 'GET',
              })
              .toPromise();
            tagValues = (tagValuesResponse as any).data as string[];
          } catch (tagValuesError) {
            const err = tagValuesError as any;
            if (err.status === 401) {
              throw new Error('Datadog credentials invalid');
            } else if (err.status === 404) {
              throw new Error('Endpoint not found (backend not available)');
            } else {
              console.warn('Failed to fetch tag values:', tagValuesError);
              // Continue with empty tag values if backend call fails
              tagValues = [];
            }
          }
        }

        // Fetch specific field values for logs contexts (service values, source values, etc.)
        let logsFieldValues: string[] = [];
        if (queryType === 'logs' && ['logs_service', 'logs_source', 'logs_level', 'logs_host', 'logs_env'].includes(context.contextType)) {
          try {
            let fieldName = '';
            switch (context.contextType) {
              case 'logs_service':
                fieldName = 'service';
                break;
              case 'logs_source':
                fieldName = 'source';
                break;
              case 'logs_level':
                fieldName = 'status'; // Datadog uses 'status' for log levels
                break;
              case 'logs_host':
                fieldName = 'host';
                break;
              case 'logs_env':
                fieldName = 'env';
                break;
            }
            
            if (fieldName) {
              const fieldValuesResponse = await getBackendSrv()
                .fetch({
                  url: `/api/datasources/uid/${datasourceUid}/resources/autocomplete/logs/field-values/${fieldName}`,
                  method: 'GET',
                })
                .toPromise();
              logsFieldValues = (fieldValuesResponse as any).data as string[];
            }
          } catch (fieldValuesError) {
            const err = fieldValuesError as any;
            if (err.status === 401) {
              throw new Error('Datadog credentials invalid');
            } else if (err.status === 404) {
              console.warn('Logs field values endpoint not found, using cached data');
              // Fall back to using the general lists we already fetched
              switch (context.contextType) {
                case 'logs_service':
                  logsFieldValues = logsServices;
                  break;
                case 'logs_source':
                  logsFieldValues = logsSources;
                  break;
                case 'logs_level':
                  logsFieldValues = logsLevels;
                  break;
                case 'logs_host':
                case 'logs_env':
                  // No fallback data for host/env, will use empty array
                  logsFieldValues = [];
                  break;
              }
            } else {
              console.warn('Failed to fetch logs field values:', fieldValuesError);
              // Fall back to using the general lists we already fetched
              switch (context.contextType) {
                case 'logs_service':
                  logsFieldValues = logsServices;
                  break;
                case 'logs_source':
                  logsFieldValues = logsSources;
                  break;
                case 'logs_level':
                  logsFieldValues = logsLevels;
                  break;
                case 'logs_host':
                case 'logs_env':
                  // No fallback data for host/env, will use empty array
                  logsFieldValues = [];
                  break;
                  break;
              }
            }
          }
        }

        clearTimeout(timeoutHandle);

        // Generate suggestions based on context and query type
        let suggestions: CompletionItem[] = [];
        if (queryType === 'metrics') {
          suggestions = generateSuggestions(context, metrics, tags, tagValues);
        } else if (queryType === 'logs') {
          // Update logs provider with backend data
          const logsProvider = logsProviderRef.current;
          logsProvider.updateServices(logsServices);
          logsProvider.updateSources(logsSources);
          logsProvider.updateLevels(logsLevels);
          logsProvider.updateFields(logsFields);
          
          // If we have specific field values for the current context, use them
          if (logsFieldValues.length > 0) {
            switch (context.contextType) {
              case 'logs_service':
                logsProvider.updateServices(logsFieldValues);
                break;
              case 'logs_source':
                logsProvider.updateSources(logsFieldValues);
                break;
              case 'logs_level':
                logsProvider.updateLevels(logsFieldValues);
                break;
              case 'logs_host':
                logsProvider.updateHosts(logsFieldValues);
                break;
              case 'logs_env':
                logsProvider.updateEnvironments(logsFieldValues);
                break;
            }
          }
          
          // Use context-aware completion provider for enhanced suggestions
          suggestions = logsProvider.getContextSpecificSuggestions(queryText, context.cursorPosition, context);
        }
        
        console.log('Suggestions generated:', {
          queryType,
          contextType: context.contextType,
          currentToken: context.currentToken,
          metricsCount: metrics.length,
          tagsCount: tags.length,
          tagValuesCount: tagValues.length,
          logsServicesCount: logsServices.length,
          logsSourcesCount: logsSources.length,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.slice(0, 5), // First 5 for debugging
        });
        
        // Group suggestions by category
        const groupedSuggestions = groupSuggestions(suggestions);

        setState((prev: AutocompleteState) => ({
          ...prev,
          isLoading: false,
          suggestions,
          groupedSuggestions,
          selectedIndex: 0,
          isOpen: suggestions.length > 0,
          validationError: validationResult.isValid ? undefined : validationResult.errors[0]?.message,
        }));
      } catch (error) {
        clearTimeout(timeoutHandle);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions';
        setState((prev: AutocompleteState) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          suggestions: [],
          isOpen: true, // Keep open to show error
        }));
      }
    },
    [datasourceUid]
  );

  /**
   * Handle input from query editor
   */
  const onInput = useCallback(
    (queryText: string, cursorPosition: number) => {
      currentQueryRef.current = queryText;
      currentCursorRef.current = cursorPosition;

      // Cancel existing debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Check if query contains variables for better context analysis
      const hasVariables = variableInterpolationService.hasVariables(queryText);
      let contextQuery = queryText;
      
      if (hasVariables) {
        // For autocomplete context analysis, we need to understand the structure
        // even with variables present. We'll use the original query for parsing
        // but log that variables are present for debugging
        console.log('Query contains variables:', {
          queryText,
          variables: variableInterpolationService.extractVariableNames(queryText)
        });
      }

      // Parse query to get context based on query type
      const context = queryType === 'logs' 
        ? parseLogsQuery(contextQuery, cursorPosition)
        : parseQuery(contextQuery, cursorPosition);
      contextRef.current = context;

      console.log('onInput - context detected:', {
        queryText,
        cursorPosition,
        contextType: context.contextType,
        currentToken: context.currentToken,
        metricName: context.metricName,
        hasVariables,
      });

      // Set debounce timer for API call
      debounceTimerRef.current = setTimeout(() => {
        fetchAndUpdateSuggestions(context, queryText);
      }, debounceMs);
    },
    [debounceMs, fetchAndUpdateSuggestions]
  );;

  /**
   * Handle keyboard navigation and selection
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Detect Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) for query execution
      // Close popup before query execution (Requirements 2.1)
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        if (state.isOpen) {
          setState((prev: AutocompleteState) => ({ ...prev, isOpen: false, hoveredIndex: null }));
        }
        // Don't prevent default - let the query execution happen
        return;
      }

      // Only handle when autocomplete is open
      if (!state.isOpen) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setState((prev: AutocompleteState) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % prev.suggestions.length,
            hoveredIndex: null, // Reset hover when using keyboard
          }));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setState((prev: AutocompleteState) => ({
            ...prev,
            selectedIndex:
              prev.selectedIndex === 0 ? prev.suggestions.length - 1 : prev.selectedIndex - 1,
            hoveredIndex: null, // Reset hover when using keyboard
          }));
          break;

        case 'Enter':
        case 'Tab':
          event.preventDefault();
          const selectedItem = state.suggestions[state.selectedIndex];
          if (selectedItem) {
            onItemSelect(selectedItem);
          }
          break;

        case 'Escape':
          event.preventDefault();
          setState((prev: AutocompleteState) => ({ ...prev, isOpen: false, hoveredIndex: null }));
          break;

        default:
          // Keep autocomplete open for any other key
          return;
      }
    },
    [state.isOpen, state.selectedIndex, state.suggestions]
  );

  /**
   * Handle suggestion item selection
   * This is typically called when user clicks or presses Enter on a suggestion
   */
  const onItemSelect = useCallback((item: CompletionItem) => {
    // Call the provided selection callback if available
    if (onSelect) {
      onSelect(item);
    }
    // Close the autocomplete menu
    setState((prev: AutocompleteState) => ({ ...prev, isOpen: false }));
  }, [onSelect]);

  /**
   * Close autocomplete menu
   */
  const onClose = useCallback(() => {
    setState((prev: AutocompleteState) => ({ ...prev, isOpen: false, hoveredIndex: null }));
  }, []);

  /**
   * Handle mouse enter on a suggestion item
   * Updates both hoveredIndex and selectedIndex for visual feedback
   */
  const onMouseEnter = useCallback((index: number) => {
    setState((prev: AutocompleteState) => ({
      ...prev,
      hoveredIndex: index,
      selectedIndex: index,
    }));
  }, []);

  /**
   * Handle mouse click on a suggestion item
   * Selects the item and closes the autocomplete menu
   */
  const onMouseClick = useCallback((item: CompletionItem) => {
    onItemSelect(item);
  }, [onItemSelect]);

  /**
   * Navigate up in the suggestion list
   * Uses setState with function to get current state, avoiding stale closures
   */
  const onNavigateUp = useCallback(() => {
    setState((prev: AutocompleteState) => {
      if (!prev.isOpen || prev.suggestions.length === 0) {
        return prev;
      }
      return {
        ...prev,
        selectedIndex: prev.selectedIndex === 0 ? prev.suggestions.length - 1 : prev.selectedIndex - 1,
        hoveredIndex: null,
      };
    });
  }, []);

  /**
   * Navigate down in the suggestion list
   * Uses setState with function to get current state, avoiding stale closures
   */
  const onNavigateDown = useCallback(() => {
    setState((prev: AutocompleteState) => {
      if (!prev.isOpen || prev.suggestions.length === 0) {
        return prev;
      }
      return {
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % prev.suggestions.length,
        hoveredIndex: null,
      };
    });
  }, []);

  /**
   * Select the currently highlighted suggestion
   * Uses setState with function to get current state, avoiding stale closures
   */
  const onSelectCurrent = useCallback(() => {
    console.log('onSelectCurrent called');
    setState((prev: AutocompleteState) => {
      console.log('onSelectCurrent setState:', { isOpen: prev.isOpen, suggestionsLength: prev.suggestions.length, selectedIndex: prev.selectedIndex });
      if (!prev.isOpen || prev.suggestions.length === 0) {
        console.log('onSelectCurrent: autocomplete not open or no suggestions');
        return prev;
      }
      const selectedItem = prev.suggestions[prev.selectedIndex];
      console.log('onSelectCurrent: selectedItem:', selectedItem);
      if (selectedItem) {
        // Call onItemSelect which will handle the callback and close the menu
        // Do this outside setState to avoid stale closure issues
        console.log('onSelectCurrent: calling onItemSelect via setTimeout');
        setTimeout(() => onItemSelect(selectedItem), 0);
      }
      return { ...prev, isOpen: false };
    });
  }, [onItemSelect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel pending requests
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    onInput,
    onKeyDown,
    onItemSelect,
    onMouseEnter,
    onMouseClick,
    onClose,
    onNavigateUp,
    onNavigateDown,
    onSelectCurrent,
  };
}