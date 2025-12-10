# Grafana Datadog Datasource Plugin

[![Release](https://img.shields.io/github/v/release/wasilak/grafana-datadog-datasource)](https://github.com/wasilak/grafana-datadog-datasource/releases)
[![License](https://img.shields.io/github/license/wasilak/grafana-datadog-datasource)](LICENSE)

An **unofficial** Grafana datasource plugin for Datadog metrics with advanced query autocomplete functionality.

> [!NOTE]  
> This is an unofficial plugin that uses the Datadog API for metrics queries. There is also an [official Datadog plugin](https://grafana.com/grafana/plugins/grafana-datadog-datasource/) available for Grafana Enterprise subscriptions.

## ✨ Features

### 🎯 Core Functionality
- **Metrics support only** - Does not support logs or traces
- **Explore integration** - Full support for Grafana Explore
- **Dashboard variables** - Complete variable support
- **All visualizations** - Works with standard Grafana visualizations
- **Custom series labels** - Support for variables like `$host` or `{{host}}`
- **Inline comments** - Lines starting with `#`, toggle with `Cmd+/` or `Ctrl+/`

### 🚀 Advanced Query Editor (v0.4.0+)
- **Smart autocomplete** - Real-time suggestions from Datadog API
  - Metric name autocomplete
  - Tag key autocomplete based on selected metrics  
  - Tag value autocomplete with filter context awareness
- **Boolean operators** - Full support for `OR`, `AND`, `IN`, `NOT IN` operators
- **Keyboard shortcuts** - `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux) for query execution
- **Context-aware parsing** - Intelligent cursor position detection for accurate suggestions

## 📋 Requirements

- **Datadog site** - e.g., `datadoghq.eu` or `datadoghq.com`
- **Datadog subscription** - API access requires a paid Datadog subscription
- **API credentials**:
  - **API Key** - Your Datadog API key
  - **Application Key** - Datadog application key (unscoped key works)

## 🚀 Installation

### Option 1: Direct Download
1. Download the latest release from [GitHub Releases](https://github.com/wasilak/grafana-datadog-datasource/releases)
2. Extract to your Grafana plugins directory
3. Allow unsigned plugins:
   ```bash
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
   ```
4. Restart Grafana

### Option 2: Environment Variable Installation
```bash
GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/0.4.0/wasilak-datadog-datasource-0.4.0.zip;Datadog
```

### Option 3: Self-Signed Plugin
1. Clone this repository
2. Sign the plugin with a [private signature](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/)
3. Install the signed plugin

## ⚙️ Configuration

1. **Add Datasource** - Go to Configuration → Data Sources → Add data source
2. **Select Datadog** - Choose "Datadog" from the list
3. **Configure Settings**:
   - **Site**: Your Datadog site (e.g., `datadoghq.eu`)
   - **API Key**: Your Datadog API key
   - **Application Key**: Your Datadog application key
4. **Test Connection** - Click "Save & Test" to verify the configuration

## 🧪 Example Usage

### Basic Query
```
avg:system.cpu.user{*}
```

### Query with Grouping
```
avg:system.cpu.user{*} by {host}
```

### Query with Filters and Boolean Operators
```
avg:container.cpu.usage{service:web OR service:api} by {host}
```

### Custom Series Label
```
CPU Usage: {{host}}
```

## 🏗️ Development

### Prerequisites
- Node.js (LTS version)
- Yarn package manager
- Go 1.21+
- Mage build tool

### Setup
```bash
# Clone repository
git clone https://github.com/wasilak/grafana-datadog-datasource.git
cd grafana-datadog-datasource

# Install dependencies
yarn install

# Build plugin
make build

# Start development server
make server
```

### Build Commands
```bash
make build                    # Build frontend + backend for current platform
make build-backend-all        # Build backend for all platforms
make clean                    # Clean build artifacts
make lint                     # Run linting
make test                     # Run tests
```

## 📦 Multi-Platform Support

The plugin includes pre-built binaries for:
- **Linux**: x86-64, ARM64
- **macOS**: Intel, Apple Silicon  
- **Windows**: x86-64

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Screenshots

### Datasource

![Datasource](https://github.com/wasilak/grafana-datadog-datasource/raw/main/src/img/datasource.jpg)

### Query

![Query](https://github.com/wasilak/grafana-datadog-datasource/raw/main/src/img/query_full.jpg)
