# Grafana Datadog Datasource Plugin

[![Release](https://img.shields.io/github/v/release/wasilak/grafana-datadog-datasource)](https://github.com/wasilak/grafana-datadog-datasource/releases)
[![License](https://img.shields.io/github/license/wasilak/grafana-datadog-datasource)](https://github.com/wasilak/grafana-datadog-datasource/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/wasilak/grafana-datadog-datasource/ci.yml)](https://github.com/wasilak/grafana-datadog-datasource/actions)

An **unofficial** Grafana datasource plugin for Datadog metrics with advanced query capabilities and intelligent autocomplete.

> [!NOTE]  
> This is an unofficial plugin that uses the Datadog API for metrics queries. There is also an [official Datadog plugin](https://grafana.com/grafana/plugins/grafana-datadog-datasource/) available for Grafana Enterprise subscriptions.

## 🚀 Quick Start

1. **[Install the plugin](docs/installation.md)** - Multiple installation methods available
2. **[Configure your datasource](docs/configuration.md)** - Set up Datadog API credentials  
3. **[Write your first query](docs/getting-started.md)** - Learn the query syntax
4. **[Explore advanced features](docs/features/)** - Discover all capabilities

## ✨ Key Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| 🎯 **Smart Autocomplete** | Context-aware suggestions with real-time validation | [Autocomplete Guide](docs/features/autocomplete.md) |
| 🔧 **Advanced Query Editor** | Boolean operators, formulas, and custom legends | [Query Editor](docs/features/query-editor.md) |
| 📊 **Formula Support** | Mathematical expressions across multiple queries | [Formulas & Expressions](docs/features/formulas.md) |
| 🏷️ **Custom Legends** | Template variables and dynamic series naming | [Legend Configuration](docs/features/legends.md) |
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
- **Formulas and expressions** (`$A * 100 / $B`)
- **Boolean operators** (`OR`, `AND`, `IN`, `NOT IN`)
- **Custom legends** with template variables
- **Dashboard variables** and templating
- **Grafana Explore** integration
- **All visualization types** (graphs, tables, stat panels, etc.)

### ❌ Not Supported
- **Logs** - Use official Datadog plugin or Loki
- **Traces** - Use official Datadog plugin or Jaeger/Tempo
- **Events** - Metrics only
- **Synthetic monitoring** - Use official Datadog plugin

## 📚 Documentation

### Getting Started
- [Installation Guide](docs/installation.md) - Install the plugin
- [Configuration](docs/configuration.md) - Set up your datasource
- [Getting Started](docs/getting-started.md) - Your first queries
- [Migration Guide](docs/migration.md) - Upgrade from older versions

### Features
- [Query Editor](docs/features/query-editor.md) - Advanced query capabilities
- [Autocomplete](docs/features/autocomplete.md) - Smart suggestions system
- [Formulas & Expressions](docs/features/formulas.md) - Mathematical operations
- [Legend Configuration](docs/features/legends.md) - Custom series naming
- [Variables](docs/features/variables.md) - Dashboard templating
- [Explore Integration](docs/features/explore.md) - Ad-hoc exploration

### Advanced Usage
- [Query Examples](docs/examples/queries.md) - Real-world query patterns
- [Dashboard Examples](docs/examples/dashboards.md) - Complete dashboard setups
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

## 🏆 Why Choose This Plugin?

| Advantage | This Plugin | Official Plugin |
|-----------|-------------|-----------------|
| **Cost** | Free & Open Source | Grafana Enterprise Required |
| **Autocomplete** | Advanced context-aware | Basic |
| **Formulas** | Full mathematical expressions | Limited |
| **Query Editor** | Modern with validation | Basic |
| **Variables** | Complete support | Limited |
| **Community** | Active development | Enterprise support |

## 🤝 Community & Support

- **Issues**: [GitHub Issues](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **Discussions**: [GitHub Discussions](https://github.com/wasilak/grafana-datadog-datasource/discussions)
- **Contributing**: [Contributing Guide](docs/development/contributing.md)
- **Changelog**: [Release Notes](CHANGELOG.md)

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

**Ready to get started?** → [Installation Guide](docs/installation.md)