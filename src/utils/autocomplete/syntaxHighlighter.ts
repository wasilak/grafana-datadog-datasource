import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

/**
 * Register the Datadog query language with Monaco editor
 * This enables syntax highlighting for Datadog queries
 */
export function registerDatadogLanguage(monaco: typeof monacoType): void {
  // Register the language
  monaco.languages.register({ id: 'datadog' });

  // Define syntax highlighting rules using Monarch tokenizer
  monaco.languages.setMonarchTokensProvider('datadog', {
    tokenizer: {
      root: [
        // Aggregators: avg, sum, min, max, count, etc.
        [
          /\b(avg|sum|min|max|count|last|percentile|cardinality|pct_95|pct_99|median|stddev|rate)\b/,
          'keyword.aggregator',
        ],

        // Keywords: by, as, rollup
        [/\b(by|as|rollup)\b/, 'keyword'],

        // Metric names: system.cpu.user, datadog.estimated_usage.metrics.custom
        // Matches patterns like word.word.word
        [/[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+/, 'type.metric'],

        // Tag keys (inside braces, before colon)
        [/\{[^:}]*(?=:)/, 'variable.tagkey'],

        // Tag values (inside braces, after colon)
        [/:[^,}]+/, 'string.tagvalue'],

        // Operators and punctuation
        [/[{}:,*()]/, 'delimiter'],

        // Numbers
        [/\d+(\.\d+)?/, 'number'],

        // Whitespace
        [/\s+/, 'white'],
      ],
    },
  });

  // Define dark theme colors
  monaco.editor.defineTheme('datadog-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.aggregator', foreground: 'C586C0', fontStyle: 'bold' }, // Purple for aggregators
      { token: 'keyword', foreground: '569CD6' }, // Blue for keywords
      { token: 'type.metric', foreground: '4EC9B0' }, // Teal for metrics
      { token: 'variable.tagkey', foreground: '9CDCFE' }, // Light blue for tag keys
      { token: 'string.tagvalue', foreground: 'CE9178' }, // Orange for tag values
      { token: 'delimiter', foreground: 'D4D4D4' }, // Gray for punctuation
      { token: 'number', foreground: 'B5CEA8' }, // Light green for numbers
    ],
    colors: {},
  });

  // Define light theme colors
  monaco.editor.defineTheme('datadog-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword.aggregator', foreground: 'AF00DB', fontStyle: 'bold' }, // Purple for aggregators
      { token: 'keyword', foreground: '0000FF' }, // Blue for keywords
      { token: 'type.metric', foreground: '267F99' }, // Teal for metrics
      { token: 'variable.tagkey', foreground: '001080' }, // Blue for tag keys
      { token: 'string.tagvalue', foreground: 'A31515' }, // Red for tag values
      { token: 'delimiter', foreground: '000000' }, // Black for punctuation
      { token: 'number', foreground: '098658' }, // Green for numbers
    ],
    colors: {},
  });
}
