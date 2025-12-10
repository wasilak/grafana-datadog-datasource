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
   
   > **Note**: This is required because the plugin is signed for `localhost:3000` only. For production deployments on other domains, you'll need to either allow unsigned plugins or re-sign the plugin for your domain.
4. Restart Grafana

### Option 2: Environment Variable Installation
```bash
GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/0.4.0/wasilak-datadog-datasource-0.4.0.zip;wasilak-datadog-datasource
```

### Option 3: Self-Signed Plugin
1. Clone this repository
2. Sign the plugin with a [private signature](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/)
3. Install the signed plugin

## ⚙️ Configuration

### Adding the Datasource

1. **Navigate to Datasources**
   - Go to **Configuration** → **Data Sources** (or **Connections** → **Data sources** in newer Grafana versions)
   - Click **"Add data source"**

2. **Select Datadog**
   - Search for "Datadog" or scroll to find it
   - Click on the **Datadog** datasource

3. **Configure Connection Settings**
   - **Name**: Give your datasource a name (e.g., "Datadog Production")
   - **Site**: Your Datadog site URL
     - `datadoghq.com` (US)
     - `datadoghq.eu` (EU)
     - `us3.datadoghq.com` (US3)
     - `us5.datadoghq.com` (US5)
     - `ap1.datadoghq.com` (AP1)
     - `ddog-gov.com` (Government)

4. **Add API Credentials**
   - **API Key**: Your Datadog API key
   - **Application Key**: Your Datadog application key
   
   > **Note**: The application key can be "unscoped" - it doesn't need specific permissions

5. **Test & Save**
   - Click **"Save & Test"** to verify the connection
   - You should see a green "Data source is working" message

### Getting Datadog API Keys

1. **API Key**:
   - Go to [Datadog API Keys](https://app.datadoghq.com/organization-settings/api-keys)
   - Create a new API key or use an existing one

2. **Application Key**:
   - Go to [Datadog Application Keys](https://app.datadoghq.com/organization-settings/application-keys)
   - Create a new application key
   - No specific scopes are required (unscoped works fine)

### Troubleshooting

#### Plugin Installation Issues
- **"Plugin ID mismatch"**: Use `wasilak-datadog-datasource` as the plugin ID, not `Datadog`
  ```bash
  # Correct
  GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/0.4.0/wasilak-datadog-datasource-0.4.0.zip;wasilak-datadog-datasource
  ```
- **"Invalid signature"**: The plugin is signed for `localhost:3000` only. For other domains:
  ```bash
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
  ```
- **Plugin not appearing**: Check Grafana logs for installation errors and ensure both environment variables above are set

#### Datasource Configuration Issues
- **"Unauthorized" error**: Check your API key and application key
- **"Forbidden" error**: Verify your Datadog site URL is correct
- **No metrics showing**: Ensure your Datadog account has metrics data
- **Autocomplete not working**: Check browser console for API errors

## 🧪 Using the Plugin

### Creating Your First Query

1. **Create a Dashboard**
   - Go to **Dashboards** → **New** → **New Dashboard**
   - Click **"Add visualization"**

2. **Select Datadog Datasource**
   - In the query editor, select your Datadog datasource from the dropdown

3. **Write a Query**
   - Use the query editor with autocomplete support
   - Start typing a metric name and see suggestions appear
   - Use `{` to trigger tag key autocomplete
   - Use `:` after a tag key to get tag value suggestions

### Query Examples

#### Basic Queries
```
# Simple metric query
avg:system.cpu.user{*}

# Query with specific host
avg:system.cpu.user{host:web-server-01}

# Query with aggregation
sum:docker.containers.running{*}
```

#### Advanced Queries with Autocomplete
```
# Grouping by tags (autocomplete will suggest available tags)
avg:system.cpu.user{*} by {host}

# Multiple filters with boolean operators
avg:container.cpu.usage{service:web OR service:api} by {host}

# Using IN operator for multiple values
avg:system.load.1{host IN (web-01,web-02,web-03)}

# Complex filtering
max:kubernetes.cpu.usage{cluster_name:production AND namespace:frontend} by {pod_name}
```

#### Custom Series Labels
```
# Using template variables
CPU Usage: {{host}}

# Multiple variables
{{service}} on {{host}}: {{cluster_name}}

# With static text
Production CPU: {{host}} ({{availability_zone}})
```

### Autocomplete Features

- **Metric Names**: Start typing to see available metrics
- **Tag Keys**: Type `{` after a metric to see available tags
- **Tag Values**: Type `:` after a tag key to see possible values
- **Boolean Operators**: Use `OR`, `AND`, `IN`, `NOT IN` with full autocomplete support
- **Keyboard Shortcuts**: 
  - `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows/Linux) to execute query
  - Works in both query field and label field

### Using in Explore

1. Go to **Explore** in Grafana
2. Select your Datadog datasource
3. Use the same query syntax with full autocomplete support
4. Perfect for ad-hoc metric exploration and debugging

## 🧪 Local Development & Testing

### Prerequisites
- Node.js (LTS version)
- Yarn package manager
- Go 1.21+
- Mage build tool
- Docker & Docker Compose

### Quick Start with Docker
```bash
# Clone repository
git clone https://github.com/wasilak/grafana-datadog-datasource.git
cd grafana-datadog-datasource

# Install dependencies and build
make build

# Start Grafana with plugin loaded
docker compose up --build
```

This will start Grafana at `http://localhost:3000` with:
- **Anonymous authentication enabled** (no login required)
- **Plugin pre-loaded** and trusted
- **Debug logging enabled** for development
- **Hot reload** - changes to `dist/` are reflected immediately

### Manual Setup
```bash
# Install dependencies
yarn install

# Build plugin
make build

# Start development server (watch mode)
make watch

# In another terminal, start Grafana
docker compose up --build
```

### Build Commands
```bash
make build                    # Build frontend + backend for current platform
make build-backend-all        # Build backend for all platforms
make clean                    # Clean build artifacts
make lint                     # Run linting
make test                     # Run tests
make watch                    # Start development server (watch mode)
```

### Docker Configuration Details

The included `docker-compose.yaml` provides a complete development environment:

```yaml
services:
  grafana:
    build:
      context: ./.config
      args:
        grafana_image: grafana                    # Use OSS Grafana
        grafana_version: 12.3.0                  # Grafana version
        development: true                        # Development mode
        anonymous_auth_enabled: true             # No login required
    ports:
      - 3000:3000/tcp
    volumes:
      - ./dist:/var/lib/grafana/plugins/wasilak-datadog-datasource  # Plugin files
      - .:/root/wasilak-datadog-datasource                          # Source code
    environment:
      GF_LOG_FILTERS: plugin.wasilak-datadog-datasource:debug      # Plugin debug logs
      GF_LOG_LEVEL: debug                                           # Grafana debug logs
      GF_DATAPROXY_LOGGING: 1                                      # HTTP proxy debug logs
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: wasilak-datadog-datasource  # Trust plugin
```

### Environment Variables

You can customize the Docker setup with environment variables:

```bash
# Use Grafana Enterprise
GRAFANA_IMAGE=grafana-enterprise docker compose up

# Use different Grafana version
GRAFANA_VERSION=11.0.0 docker compose up

# Combine both
GRAFANA_IMAGE=grafana-enterprise GRAFANA_VERSION=11.0.0 docker compose up
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
