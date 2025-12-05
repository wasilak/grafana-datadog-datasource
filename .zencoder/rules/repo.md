---
description: Repository Information Overview
alwaysApply: true
---

# Grafana Datadog Datasource Plugin Information

## Summary

This is an unofficial Grafana datasource plugin for Datadog that enables querying Datadog metrics through Grafana. The plugin integrates with Datadog API using provided API keys and application keys, supporting dashboard variables, Explore mode, visualizations, and custom graph series names with variable interpolation. It requires a paid Datadog subscription to obtain API credentials.

## Structure

- **src/**: Main plugin source code with TypeScript/React components
  - `module.ts`: Plugin entry point that registers the datasource, config, and query editors
  - `datasource.ts`: Core datasource implementation for querying Datadog API
  - `ConfigEditor.tsx`: UI component for configuring datasource credentials
  - `QueryEditor.tsx`: UI component for building Datadog queries
  - `types.ts`: TypeScript type definitions for queries and datasource options
  - `plugin.json`: Plugin metadata and Grafana API route configuration
  - `img/`: Screenshot images for documentation

- **.config/**: Build and development configuration
  - `webpack/`: Webpack build configuration
  - `jest/`: Jest testing utilities and mocks
  - `Dockerfile`: Development container based on Grafana with livereload support
  - `supervisord/`: Supervisor configuration for development mode
  - `tsconfig.json`: TypeScript configuration extended by root `tsconfig.json`

- **provisioning/**: Grafana provisioning configuration for datasources

## Language & Runtime

**Language**: TypeScript  
**Runtime**: Node.js >=14  
**Framework**: React 19.x  
**Build System**: Webpack 5  
**Package Manager**: Yarn

## Dependencies

**Main Dependencies**:
- `@grafana/data` ^12.3.0 - Grafana data types and utilities
- `@grafana/runtime` ^12.3.0 - Grafana runtime APIs
- `@grafana/schema` ^12.3.0 - Grafana schema definitions
- `@grafana/ui` ^12.3.0 - Grafana UI components
- `react` ^19.2.1 - React framework
- `react-dom` ^19.2.1 - React DOM
- `@emotion/css` 11.13.5 - CSS-in-JS styling

**Development Dependencies** (key tools):
- `typescript` ~5 - TypeScript compiler
- `webpack` ~5 and `webpack-cli` ~6 - Module bundler
- `jest` ^30.0.0 - Testing framework
- `@swc/jest` ^0.2.26 - SWC-based Jest transform
- `eslint` ~9 with Grafana config - Linting
- `prettier` ~3 - Code formatter
- `@testing-library/react` ~16 - React testing utilities
- `sass` 1.94.2 and loaders - SCSS support

## Build & Installation

```bash
# Install dependencies
yarn install

# Development build (watch mode)
yarn dev

# Production build
yarn build

# Run development server with Docker Compose
yarn server

# Lint and format
yarn lint
yarn lint:fix

# Type checking
yarn typecheck

# Testing
yarn test              # Watch mode
yarn test:ci          # CI mode (no watch)

# Plugin signing
yarn sign
```

## Docker

**Dockerfile**: `.config/Dockerfile`

The development Docker setup:
- **Base Image**: Grafana Enterprise or Grafana (configurable via `GRAFANA_IMAGE` and `GRAFANA_VERSION` env vars, default: grafana-enterprise:11.3.2)
- **Development Mode**: Installs supervisor and inotify-tools for hot-reload functionality
- **Configuration**: 
  - Anonymous auth enabled for development
  - Development app mode enabled
  - Plugin loading unsigned plugins enabled
  - Livereload script injected into Grafana index.html
  - Volumes mounted for plugin dist, provisioning, and workspace

**Docker Compose**: `docker-compose.yaml`
- Service: `grafana` container running on port 3000
- Mounts plugin code in `/var/lib/grafana/plugins/wasilak-datadog-datasource`
- Environment variables for debugging and plugin loading

## Testing

**Framework**: Jest 30  
**Test Location**: Tests can be placed in `src/**/__tests__/` directories or follow naming patterns `*.test.ts`, `*.spec.ts`, `*.jest.ts`  
**Configuration**: `.config/jest.config.js` - Uses SWC transformer, jsdom environment, CSS mocking  
**Naming Convention**: `{filename}.test.ts` or `{filename}.spec.ts` files

**Run Commands**:
```bash
yarn test        # Watch mode with only changed files
yarn test:ci     # CI mode (no watch, max 4 workers, pass with no tests)
```

## Main Files & Entry Points

**Plugin Entry**: `src/module.ts` - Exports DataSourcePlugin instance with ConfigEditor and QueryEditor

**Core Files**:
- `src/datasource.ts` - Implements query execution and Datadog API communication
- `src/types.ts` - Type definitions for `MyQuery` and `MyDataSourceOptions`
- `src/plugin.json` - Plugin metadata, API routes, and Grafana dependency configuration

**Build Output**: `dist/` directory contains compiled plugin

## Configuration Files

- `plugin.json` - Defines datasource routes to Datadog API with DD-API-KEY and DD-APPLICATION-KEY headers
- `.eslintrc` - ESLint configuration (extends Grafana config)
- `.prettierrc.js` - Prettier formatting config
- `renovate.json` - Automated dependency updates configuration
- `.nvmrc` - Node version specification

## Development Notes

- Plugin type: Datasource plugin for Grafana >=7.0.0
- Supports metrics queries only (no logs or traces)
- Requires Datadog API credentials (API key and Application key)
- Supports dashboard variables with custom labels and inline query comments
- Uses Grafana create-plugin scaffolding with customizations
