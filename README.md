# Grafana Datadog Datasource Plugin

[![Release](https://img.shields.io/github/v/release/wasilak/grafana-datadog-datasource)](https://github.com/wasilak/grafana-datadog-datasource/releases)
[![License](https://img.shields.io/github/license/wasilak/grafana-datadog-datasource)](https://github.com/wasilak/grafana-datadog-datasource/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/wasilak/grafana-datadog-datasource/ci.yml)](https://github.com/wasilak/grafana-datadog-datasource/actions)

An **unofficial** Grafana datasource plugin for Datadog metrics and logs with advanced query capabilities and intelligent autocomplete.

> [!NOTE]  
> This is an unofficial plugin that uses the Datadog API for metrics and logs queries. There is also an [official Datadog plugin](https://grafana.com/grafana/plugins/grafana-datadog-datasource/) available for Grafana Enterprise subscriptions.

## 📊 Feature Implementation Status

| Feature | Status | Description |
|---------|--------|-------------|
| **Metrics** | 🟢 **Stable** | Full Datadog metrics API support with advanced querying |
| **Logs** | 🟡 **Beta** | Complete logs search with automatic field parsing |
| **Traces** | 🔴 **Not Planned** | Use official Datadog plugin or Jaeger/Tempo instead |

## 🚀 Quick Start

1. **[Install the plugin](docs/installation.md)** - Multiple installation methods available
2. **[Configure your datasource](docs/configuration.md)** - Set up Datadog API credentials  
3. **[Write your first query](docs/getting-started.md)** - Learn the query syntax
4. **[Explore advanced features](docs/features/)** - Discover all capabilities

## ✨ Key Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| 🎯 **Smart Autocomplete** | Context-aware suggestions for metrics and logs | [Metrics](docs/metrics/autocomplete.md) • [Logs](docs/logs/autocomplete.md) |
| 🔧 **Advanced Query Editor** | Boolean operators, formulas, and custom legends | [Query Editor](docs/metrics/query-editor.md) |
| 📊 **Formula Support** | Mathematical expressions across multiple queries | [Formulas & Expressions](docs/metrics/formulas.md) |
| 📋 **Logs Support** | Full Datadog logs search with syntax highlighting | [Getting Started](docs/logs/getting-started.md) • [Query Syntax](docs/logs/query-syntax.md) |
| 🔧 **Automatic Field Parsing** | Automatic parsing of structured log attributes and tags | [JSON Parsing Guide](docs/logs/json-parsing.md) |
| 🏷️ **Custom Legends** | Template variables and dynamic series naming | [Legend Configuration](docs/metrics/legends.md) |
| 🔍 **Explore Integration** | Full support for Grafana Explore mode | [Using Explore](docs/features/explore.md) |
| 📈 **Dashboard Variables** | Complete variable support with autocomplete | [Variables Guide](docs/features/variables.md) |
| ⚡ **Performance Optimized** | Caching, debouncing, and concurrent request limiting | [Performance](docs/advanced/performance.md) |

## 📋 Requirements

- **Grafana**: Version 9.0+ (recommended: 10.0+)
- **Datadog Account**: Paid subscription with API access
- **API Credentials**: API Key and Application Key
- **Supported Platforms**: Linux, macOS, Windows (x86-64, ARM64)

## 🎯 What's Supported

### ✅ Supported
- **Metrics queries** with full Datadog query language
- **Logs queries** with Datadog logs search syntax and autocomplete
- **Formulas and expressions** (`$A * 100 / $B`)
- **Boolean operators** (`OR`, `AND`, `IN`, `NOT IN`)
- **Custom legends** with template variables
- **Dashboard variables** and templating
- **Grafana Explore** integration
- **All visualization types** (graphs, tables, stat panels, logs panels, etc.)
- **Logs volume histograms** for time-series visualization

### ❌ Not Supported
- **Traces** - Use official Datadog plugin or Jaeger/Tempo
- **Events** - Metrics and logs only
- **Synthetic monitoring** - Use official Datadog plugin

## 📚 Documentation

### Getting Started
- [Installation Guide](docs/installation.md) - Install the plugin
- [Configuration](docs/configuration.md) - Set up your datasource
- [Getting Started](docs/getting-started.md) - Your first queries
- [Migration Guide](docs/migration.md) - Upgrade from older versions

### Metrics
- [Query Editor](docs/metrics/query-editor.md) - Advanced query capabilities
- [Autocomplete](docs/metrics/autocomplete.md) - Smart suggestions system
- [Formulas & Expressions](docs/metrics/formulas.md) - Mathematical operations
- [Legend Configuration](docs/metrics/legends.md) - Custom series naming

### Logs
- [Getting Started](docs/logs/getting-started.md) - Your first logs queries
- [Query Syntax](docs/logs/query-syntax.md) - Complete syntax reference
- [Autocomplete](docs/logs/autocomplete.md) - Context-aware suggestions
- [JSON Parsing](docs/logs/json-parsing.md) - Automatic field parsing and filtering
- [Correlation](docs/logs/correlation.md) - Linking logs with metrics

### Features
- [Variables](docs/features/variables.md) - Dashboard templating
- [Explore Integration](docs/features/explore.md) - Ad-hoc exploration

### Examples
- [Metrics Queries](docs/examples/metrics-queries.md) - Real-world metrics patterns
- [Logs Queries](docs/examples/logs-queries.md) - Common logs search patterns
- [Logs Dashboards](docs/examples/logs-dashboards.md) - Complete logs dashboard setups

### Advanced Usage
- [Performance Tuning](docs/advanced/performance.md) - Optimization tips
- [Troubleshooting](docs/advanced/troubleshooting.md) - Common issues and solutions

### Development
- [Development Guide](docs/development/setup.md) - Local development setup
- [Architecture](docs/development/architecture.md) - Plugin architecture overview
- [API Reference](docs/development/api.md) - Backend API documentation
- [Contributing](docs/development/contributing.md) - How to contribute

## 🔧 Quick Configuration

```bash
# Environment variable installation
GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource

# Allow unsigned plugins (required for localhost)
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
```

## 📊 Example Queries

### Metrics Queries
```bash
# Basic CPU usage
avg:system.cpu.user{*} by {host}

# Complex filtering with formulas
$A * 100 / $B
# Where A: sum:container.memory.usage{service:web}
# Where B: sum:container.memory.limit{service:web}

# Boolean operators
avg:system.load.1{env IN (prod,staging) AND service:web} by {host}

# Custom legends
CPU: {{host}} ({{availability_zone}})
```

### Logs Queries
```bash
# Basic error logs
status:ERROR

# Service-specific logs with level filtering
service:web-app AND (status:ERROR OR status:WARN)

# Complex boolean operations
service:(web-app OR api-service) AND NOT host:test-*

# Facet filtering with wildcards
source:nginx AND @env:prod* AND message:"timeout"
```

## 🏆 Why Choose This Plugin?

| Advantage | This Plugin | Official Plugin |
|-----------|-------------|-----------------|
| **Cost** | Free & Open Source | Grafana Enterprise Required |
| **Logs Support** | Full logs search with autocomplete | Available |
| **Autocomplete** | Advanced context-aware (metrics & logs) | Basic |
| **Formulas** | Full mathematical expressions | Limited |
| **Query Editor** | Modern with validation | Basic |
| **Variables** | Complete support | Limited |
| **Community** | Active development | Enterprise support |

## 🤝 Community & Support

- **Issues**: [GitHub Issues](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **Community**: [GitHub Issues](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **Contributing**: [Contributing Guide](docs/development/contributing.md)
- **Changelog**: [Release Notes](CHANGELOG.md)

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](https://github.com/wasilak/grafana-datadog-datasource/blob/main/LICENSE) file for details.

---

**Ready to get started?** → [Installation Guide](docs/installation.md)