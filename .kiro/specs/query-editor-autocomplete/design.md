# Design Document: Query Editor Autocomplete (v2 - Refinements)

## Overview

This document describes the technical design for refining and improving the existing autocomplete functionality in the Grafana Datadog datasource query editor. The v1 implementation provided basic autocomplete with debouncing, metric/tag suggestions, and keyboard navigation. This v2 design addresses UX issues discovered during user testing and adds missing features to achieve production quality and parity with Grafana's native datasources like Prometheus.

The refinements focus on:
1. **Mouse interaction support** - Click selection and hover states
2. **Query execution integration** - Proper popup dismissal on Cmd+Enter
3. **Visual consistency** - Theme-aware styling matching Grafana's design system
4. **Suggestion organization** - Grouping by category with headers
5. **Positioning accuracy** - Cursor-based popup placement
6. **Visual feedback** - Matched text highlighting
7. **Backend quality** - Best practices review and improvements
8. **Developer experience** - Streamlined build process and linting
9. **Native Grafana components** - Use @grafana/ui components for consistency
10. **Syntax highlighting** - Color-coded Datadog query syntax

## Architecture

The autocomplete system follows a layered architecture:

```
QueryEditor Component (UI Layer)
    ↓
useQueryAutocomplete Hook (State Management)
    ├─ Mouse Event Handlers (new)
    ├─ Keyboard Event Handlers (existing)
    ├─ Position Calculator (new)
    └─ Theme Detector (new)
        ↓
Suggestion Engine (Business Logic)
    ├─ parser.ts (existing)
    ├─ suggestions.ts (enhanced with grouping)
    ├─ highlighter.ts (new - text highlighting)
    └─ api.ts (existing)
        ↓
Backend Resource Handlers (Go)
    ├─ MetricsHandler (existing, reviewed)
    ├─ TagsHandler (existing, reviewed)
    └─ Error Handling (enhanced)
```

## Components and Interfaces

### Component 1: Enhanced QueryEditor Component

**Purpose**: React component with improved autocomplete UI using native Grafana components

**Changes from v1**:
- **Replace custom TextArea with Grafana's CodeEditor** - Use `@grafana/ui`'s CodeEditor component for syntax highlighting
- **Use Grafana's native autocomplete components** - Leverage `@grafana/ui`'s suggestion/completion components
- Add mouse click handlers for suggestion selection
- Add hover state management
- Implement theme-aware styling using Grafana CSS variables
- Calculate and apply cursor-based positioning
- Render grouped suggestions with headers
- Highlight matched text in suggestions
- **Add syntax highlighting for Datadog queries** - Highlight metrics, aggregators, tags, operators

**Key Grafana Components to Use**:
- `CodeEditor` from `@grafana/ui` - For syntax-highlighted query input
- `CompletionItemGroup` from `@grafana/ui` - For grouped suggestions
- `useTheme2()` hook from `@grafana/ui` - For theme detection

**New Interfaces**:
```typescript
interface SuggestionGroup {
  category: 'metrics' | 'aggregators' | 'tags' | 'tag_values';
  label: string;
  suggestions: CompletionItem[];
}

interface PopupPosition {
  top: number;
  left: number;
  placement: 'below' | 'above'; // For viewport edge handling
}

interface HighlightedText {
  before: string;
  matched: string;
  after: string;
}

interface DatadogSyntaxToken {
  type: 'metric' | 'aggregator' | 'tag_key' | 'tag_value' | 'operator' | 'punctuation';
  value: string;
  start: number;
  end: number;
}
```

### Component 2: Enhanced useQueryAutocomplete Hook

**Purpose**: Manage autocomplete state with added mouse interaction and positioning logic

**New Functionality**:
- `onMouseEnter(index: number)` - Handle suggestion hover
- `onMouseClick(item: CompletionItem)` - Handle suggestion click
- `calculatePosition(textarea: HTMLTextAreaElement, cursorPos: number): PopupPosition` - Calculate popup position
- `detectTheme(): 'light' | 'dark'` - Detect current Grafana theme

**Enhanced State**:
```typescript
interface AutocompleteState {
  isOpen: boolean;
  suggestions: CompletionItem[];
  groupedSuggestions: SuggestionGroup[]; // New
  isLoading: boolean;
  selectedIndex: number;
  hoveredIndex: number | null; // New
  position: PopupPosition; // New
  theme: 'light' | 'dark'; // New
  error?: string;
  validationError?: string;
}
```

### Component 3: Text Highlighter Utility

**Purpose**: Highlight matched portions of suggestion text

**New File**: `src/utils/autocomplete/highlighter.ts`

**Interface**:
```typescript
function highlightMatch(
  text: string,
  query: string
): HighlightedText

function renderHighlightedText(
  highlighted: HighlightedText
): React.ReactNode
```

### Component 4: Suggestion Grouping Utility

**Purpose**: Group suggestions by category

**Enhanced File**: `src/utils/autocomplete/suggestions.ts`

**New Function**:
```typescript
function groupSuggestions(
  suggestions: CompletionItem[]
): SuggestionGroup[]
```

### Component 5: Syntax Highlighter for Datadog Queries

**Purpose**: Tokenize and highlight Datadog query syntax

**New File**: `src/utils/autocomplete/syntaxHighlighter.ts`

**Interface**:
```typescript
function tokenizeDatadogQuery(query: string): DatadogSyntaxToken[]

function getTokenColor(
  tokenType: DatadogSyntaxToken['type'],
  theme: GrafanaTheme2
): string

// Monaco editor language definition for Datadog queries
function registerDatadogLanguage(): void
```

### Component 6: Backend Enhancements

**Purpose**: Review and improve backend implementation

**Changes**:
- Add structured error responses
- Improve timeout handling
- Enhance cache thread-safety
- Add request validation
- Follow Grafana plugin SDK patterns

## Data Models

### SuggestionGroup
```typescript
interface SuggestionGroup {
  category: 'metrics' | 'aggregators' | 'tags' | 'tag_values';
  label: string; // Display name like "Metrics", "Aggregators", etc.
  suggestions: CompletionItem[];
}
```

### PopupPosition
```typescript
interface PopupPosition {
  top: number; // Pixels from viewport top
  left: number; // Pixels from viewport left
  placement: 'below' | 'above'; // Whether popup is below or above cursor
}
```

### HighlightedText
```typescript
interface HighlightedText {
  before: string; // Text before match
  matched: string; // Matched text to highlight
  after: string; // Text after match
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mouse click inserts suggestion correctly
*For any* autocomplete suggestion, when clicked, the suggestion should be inserted at the cursor position and the popup should close
**Validates: Requirements 1.1, 1.2**

### Property 2: Mouse click maintains focus
*For any* suggestion clicked, the query input field should retain focus after insertion
**Validates: Requirements 1.3**

### Property 3: Hover highlights suggestion
*For any* suggestion, when the mouse hovers over it, that suggestion should be visually highlighted
**Validates: Requirements 1.4**

### Property 4: Grouped suggestions maintain category order
*For any* set of mixed suggestions, grouping should organize them into categories (metrics, aggregators, tags, tag_values) in a consistent order
**Validates: Requirements 4.1, 4.2**

### Property 5: Keyboard navigation skips headers
*For any* grouped suggestion list, pressing arrow keys should navigate only through actual suggestions, skipping group headers
**Validates: Requirements 4.3**

### Property 6: Empty groups are hidden
*For any* suggestion set, if a category has zero suggestions, that category's header should not be rendered
**Validates: Requirements 4.4**

### Property 7: Popup positions at cursor
*For any* cursor position in the query field, the popup should appear at that position (with viewport edge adjustments)
**Validates: Requirements 5.1, 5.4**

### Property 8: Matched text is highlighted
*For any* suggestion and user input, the portion of the suggestion matching the input should be visually highlighted
**Validates: Requirements 6.1, 6.3, 6.4**

### Property 9: Backend error handling returns structured responses
*For any* backend error condition (timeout, auth failure, API error), the system should return a structured error response that the frontend can display
**Validates: Requirements 7.2, 7.4**

### Property 10: Cache is thread-safe with TTL
*For any* concurrent autocomplete requests, the cache should handle them safely and respect the 30-second TTL
**Validates: Requirements 7.3**

### Property 11: Syntax highlighting applies to all token types
*For any* Datadog query, all token types (metrics, aggregators, tags, operators) should be highlighted with appropriate colors
**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

## Error Handling

### Frontend Error Scenarios

1. **Theme Detection Failure**
   - **Handling**: Fall back to light theme as default
   - **User Impact**: Autocomplete may not match theme until page refresh

2. **Position Calculation Error**
   - **Handling**: Fall back to below-textarea positioning
   - **User Impact**: Popup appears in default position instead of at cursor

3. **Highlighting Failure**
   - **Handling**: Display suggestion without highlighting
   - **User Impact**: No visual emphasis on matched text

### Backend Error Scenarios

1. **Concurrent Request Limit Exceeded**
   - **Handling**: Return empty suggestions array
   - **User Impact**: No suggestions shown temporarily

2. **Cache Corruption**
   - **Handling**: Clear cache and refetch
   - **User Impact**: Slight delay while refetching

## Testing Strategy

### Unit Testing

- **Highlighter Tests** (`highlighter.test.ts`):
  - Test matching at beginning, middle, end of text
  - Test case-insensitive matching
  - Test no-match scenarios
  - Test special characters in query

- **Grouping Tests** (`suggestions.test.ts`):
  - Test grouping mixed suggestion types
  - Test empty group filtering
  - Test group order consistency
  - Test single-category suggestions

- **Position Calculator Tests** (`useQueryAutocomplete.test.ts`):
  - Test cursor position calculation
  - Test viewport edge detection
  - Test above/below placement logic
  - Test multi-line query positioning

### Integration Testing

- **Mouse Interaction Tests** (`QueryEditor.test.tsx`):
  - Test click selection inserts text
  - Test click closes popup
  - Test hover highlights suggestion
  - Test focus remains on input

- **Theme Tests** (`QueryEditor.test.tsx`):
  - Test dark theme styling
  - Test light theme styling
  - Test theme switching updates styles

- **Keyboard + Mouse Tests** (`QueryEditor.test.tsx`):
  - Test keyboard navigation after mouse hover
  - Test mouse click after keyboard navigation
  - Test Cmd+Enter closes popup

### Backend Testing

- **Error Handling Tests** (`datasource_test.go`):
  - Test timeout returns proper error
  - Test auth failure returns 401
  - Test API error returns structured response

- **Cache Tests** (`datasource_test.go`):
  - Test concurrent requests don't corrupt cache
  - Test TTL expiration
  - Test cache hit/miss scenarios

## Implementation Details

### Using Native Grafana Components

**CodeEditor Component**:
```typescript
import { CodeEditor } from '@grafana/ui';
import { useTheme2 } from '@grafana/ui';

function QueryEditor({ query, onChange }: Props) {
  const theme = useTheme2();
  
  return (
    <CodeEditor
      value={query.queryText || ''}
      language="datadog" // Custom language we'll register
      onBlur={(value) => onChange({ ...query, queryText: value })}
      monacoOptions={{
        minimap: { enabled: false },
        lineNumbers: 'off',
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
      }}
      getSuggestions={(model, position) => {
        // Return our autocomplete suggestions
        return generateSuggestions(model.getValue(), position);
      }}
    />
  );
}
```

**Theme Detection**:
```typescript
import { useTheme2 } from '@grafana/ui';

function MyComponent() {
  const theme = useTheme2();
  
  // theme.isDark tells us if we're in dark mode
  // theme.colors provides all theme colors
  const backgroundColor = theme.colors.background.primary;
  const textColor = theme.colors.text.primary;
  
  return <div style={{ backgroundColor, color: textColor }}>...</div>;
}
```

### Syntax Highlighting for Datadog Queries

Register a custom Monaco language for Datadog queries:

```typescript
import * as monaco from 'monaco-editor';

function registerDatadogLanguage() {
  // Register the language
  monaco.languages.register({ id: 'datadog' });
  
  // Define syntax highlighting rules
  monaco.languages.setMonarchTokensProvider('datadog', {
    tokenizer: {
      root: [
        // Aggregators: avg, sum, min, max, count, etc.
        [/\b(avg|sum|min|max|count|last|percentile|cardinality|pct_95|pct_99)\b/, 'keyword'],
        
        // Metric names: system.cpu, datadog.estimated_usage.metrics.custom
        [/[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+/, 'type'],
        
        // Tag keys (before colon in braces)
        [/\{[^:}]*/, 'variable'],
        
        // Tag values (after colon in braces)
        [/:[^,}]+/, 'string'],
        
        // Operators and punctuation
        [/[{}:,*]/, 'delimiter'],
        
        // Keywords: by
        [/\bby\b/, 'keyword'],
      ],
    },
  });
  
  // Define theme colors
  monaco.editor.defineTheme('datadog-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C586C0' }, // Purple for aggregators
      { token: 'type', foreground: '4EC9B0' },    // Teal for metrics
      { token: 'variable', foreground: '9CDCFE' }, // Light blue for tag keys
      { token: 'string', foreground: 'CE9178' },   // Orange for tag values
      { token: 'delimiter', foreground: 'D4D4D4' }, // Gray for punctuation
    ],
    colors: {},
  });
  
  monaco.editor.defineTheme('datadog-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'AF00DB' }, // Purple for aggregators
      { token: 'type', foreground: '267F99' },    // Teal for metrics
      { token: 'variable', foreground: '001080' }, // Blue for tag keys
      { token: 'string', foreground: 'A31515' },   // Red for tag values
      { token: 'delimiter', foreground: '000000' }, // Black for punctuation
    ],
    colors: {},
  });
}
```

### Theme Detection (Simplified with Grafana Hook)

Use Grafana's built-in theme hook instead of manual detection:

```typescript
import { useTheme2 } from '@grafana/ui';

function detectTheme(): 'light' | 'dark' {
  const theme = useTheme2();
  return theme.isDark ? 'dark' : 'light';
}
```

### Cursor Position Calculation

Calculate popup position based on cursor location in textarea:

```typescript
function calculatePosition(
  textarea: HTMLTextAreaElement,
  cursorPos: number
): PopupPosition {
  // Create hidden div with same text up to cursor
  const textBeforeCursor = textarea.value.substring(0, cursorPos);
  const lines = textBeforeCursor.split('\n');
  const currentLine = lines.length - 1;
  const charInLine = lines[currentLine].length;
  
  // Calculate pixel position
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
  const charWidth = measureCharWidth(textarea);
  
  const rect = textarea.getBoundingClientRect();
  const top = rect.top + (currentLine * lineHeight) + lineHeight;
  const left = rect.left + (charInLine * charWidth);
  
  // Check viewport edges
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  const placement = (top + 200 > viewportHeight) ? 'above' : 'below';
  const adjustedLeft = Math.min(left, viewportWidth - 250);
  
  return { top, left: adjustedLeft, placement };
}
```

### Text Highlighting

Highlight matched portions of suggestions:

```typescript
function highlightMatch(text: string, query: string): HighlightedText {
  if (!query) {
    return { before: text, matched: '', after: '' };
  }
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) {
    return { before: text, matched: '', after: '' };
  }
  
  return {
    before: text.substring(0, index),
    matched: text.substring(index, index + query.length),
    after: text.substring(index + query.length)
  };
}
```

### Suggestion Grouping

Group suggestions by category:

```typescript
function groupSuggestions(suggestions: CompletionItem[]): SuggestionGroup[] {
  const groups: Map<string, CompletionItem[]> = new Map();
  
  for (const suggestion of suggestions) {
    const category = suggestion.kind || 'other';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(suggestion);
  }
  
  // Convert to array with labels, filter empty groups
  const result: SuggestionGroup[] = [];
  const categoryOrder = ['aggregators', 'metrics', 'tags', 'tag_values'];
  
  for (const category of categoryOrder) {
    const suggestions = groups.get(category);
    if (suggestions && suggestions.length > 0) {
      result.push({
        category: category as any,
        label: getCategoryLabel(category),
        suggestions
      });
    }
  }
  
  return result;
}
```

## Build Process Improvements

### Makefile Structure

Create a comprehensive Makefile for streamlined development:

```makefile
.PHONY: build test dev clean install lint

# Build both frontend and backend
build:
	yarn build
	mage -v build:linux

# Run all tests
test:
	yarn test
	go test ./pkg/...

# Development mode with watch
dev:
	yarn dev

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/
	go clean

# Install dependencies
install:
	yarn install
	go mod download

# Run linters
lint:
	yarn lint
	golangci-lint run
```

## ESLint Configuration

Fix ESLint configuration for TypeScript and React:

```javascript
module.exports = {
  extends: [
    '@grafana/eslint-config',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

## Performance Considerations

1. **Position Calculation**: Cache character width measurements, recalculate only on font changes
2. **Theme Detection**: Detect once on mount, listen for theme change events
3. **Grouping**: Memoize grouped suggestions, recalculate only when suggestions change
4. **Highlighting**: Use React.memo for highlighted text components
5. **Mouse Events**: Debounce hover events to avoid excessive re-renders

## Migration Path

This is an enhancement to existing functionality, not a breaking change:

1. **Phase 1**: Add mouse interaction support (Requirements 1, 2)
2. **Phase 2**: Implement theme-aware styling (Requirement 3)
3. **Phase 3**: Add grouping and positioning (Requirements 4, 5)
4. **Phase 4**: Implement text highlighting (Requirement 6)
5. **Phase 5**: Backend review and improvements (Requirement 7)
6. **Phase 6**: Build process and linting (Requirements 8, 9)

All changes are backward compatible with existing functionality.
