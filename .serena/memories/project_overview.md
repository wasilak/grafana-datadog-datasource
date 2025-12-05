# Grafana Datadog Datasource Plugin - Project Overview

## Project Purpose
Unofficial Grafana datasource plugin that enables querying Datadog metrics through Grafana dashboards. Allows users to visualize Datadog metrics directly in Grafana using Datadog API (requires paid Datadog subscription with API key and Application key).

## Key Capabilities
- Metrics querying only (no logs/traces support)
- Explore mode support
- Dashboard variables support
- Custom graph series names with variable interpolation
- Inline query comments (lines starting with #)
- All standard Grafana visualizations supported

## Tech Stack
- **Language**: TypeScript 5
- **Runtime**: Node.js >=14
- **Framework**: React 19.2.1
- **Build**: Webpack 5
- **Package Manager**: Yarn
- **Grafana Version**: >=7.0.0 (uses Grafana v12.3.0 APIs)

## Core Dependencies
- @grafana/data, @grafana/runtime, @grafana/ui, @grafana/schema (v12.3.0)
- react, react-dom (v19.2.1)
- @emotion/css (11.13.5)

## Project Structure
```
src/
├── module.ts           # Plugin entry point
├── datasource.ts       # Core datasource with API logic
├── QueryEditor.tsx     # Query building UI component
├── ConfigEditor.tsx    # Datasource configuration UI
├── types.ts           # TypeScript type definitions
├── types.js           # (duplicate/legacy)
├── plugin.json        # Plugin metadata & routes
└── img/               # Documentation screenshots
```

## Known Issues/Improvement Areas
1. **No autocomplete** - Currently users must write queries manually
2. **HTTP-based API calls** - Uses basic HTTP, could upgrade to official Datadog TypeScript API client
3. **Query validation** - No validation or helpful error feedback with debounce
4. **Code patterns** - May need modernization to follow latest Grafana plugin best practices
