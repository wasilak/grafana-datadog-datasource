import { useCallback, useEffect, useRef, useState } from 'react';
import { AutocompleteState, QueryContext, CompletionItem } from '../types';
import { parseQuery } from '../utils/autocomplete/parser';
import { generateSuggestions, groupSuggestions } from '../utils/autocomplete/suggestions';
import { validateQuery } from '../utils/queryValidator';
import { getBackendSrv } from '@grafana/runtime';

const DEFAULT_DEBOUNCE_MS = 400; // 300-500ms as per design

interface UseQueryAutocompleteOptions {
  datasourceUid: string;
  debounceMs?: number;
  onSelect?: (item: CompletionItem) => void;
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
  const { datasourceUid, debounceMs = DEFAULT_DEBOUNCE_MS, onSelect } = options;

  // Validate datasource UID is provided
  if (!datasourceUid) {
    console.warn('useQueryAutocomplete: datasourceUid is required but not provided');
  }

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
        // Validate query
        const validationResult = validateQuery(queryText);

        // Fetch metric names from backend
        let metrics: string[] = [];
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

        // Fetch tags for the metric if in tag context
        let tags: string[] = [];
        if ((context.contextType === 'tag' || context.contextType === 'tag_value') && context.metricName) {
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

        clearTimeout(timeoutHandle);

        // Generate suggestions based on context
        const suggestions = generateSuggestions(context, metrics, tags);
        
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

      // Parse query to get context
      const context = parseQuery(queryText, cursorPosition);
      contextRef.current = context;

      // Set debounce timer for API call
      debounceTimerRef.current = setTimeout(() => {
        fetchAndUpdateSuggestions(context, queryText);
      }, debounceMs);
    },
    [debounceMs, fetchAndUpdateSuggestions]
  );

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
    setState((prev: AutocompleteState) => {
      if (!prev.isOpen || prev.suggestions.length === 0) {
        return prev;
      }
      const selectedItem = prev.suggestions[prev.selectedIndex];
      if (selectedItem && onSelect) {
        onSelect(selectedItem);
      }
      return { ...prev, isOpen: false };
    });
  }, [onSelect]);

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