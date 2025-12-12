# Installation Guide

This guide covers all methods to install the Grafana Datadog Datasource Plugin.

## 🚀 Quick Installation

### Method 1: Environment Variable (Recommended)

Add to your Grafana configuration:

```bash
# Install plugin
GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource

# Allow unsigned plugins (required)
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
```

Restart Grafana and the plugin will be automatically installed.

### Method 2: Direct Download

1. **Download the latest release**:
   ```bash
   wget https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip
   ```

2. **Extract to plugins directory**:
   ```bash
   # Default Grafana plugins directory
   sudo unzip wasilak-datadog-datasource-v0.4.2.zip -d /var/lib/grafana/plugins/
   
   # Or custom plugins directory
   unzip wasilak-datadog-datasource-v0.4.2.zip -d /path/to/grafana/plugins/
   ```

3. **Configure Grafana**:
   ```bash
   # Add to grafana.ini or environment variables
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
   ```

4. **Restart Grafana**:
   ```bash
   sudo systemctl restart grafana-server
   ```

## 🐳 Docker Installation

### Docker Compose

```yaml
version: '3.8'
services:
  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
    ports:
      - "3000:3000"
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

### Docker Run

```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -e "GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource" \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource" \
  grafana/grafana:latest
```

### Custom Dockerfile

```dockerfile
FROM grafana/grafana:latest

# Install plugin during build
ENV GF_INSTALL_PLUGINS="https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource"
ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS="wasilak-datadog-datasource"

# Optional: Pre-configure datasource
COPY datasource.yaml /etc/grafana/provisioning/datasources/
```

## ☸️ Kubernetes Installation

### Helm Chart

```yaml
# values.yaml
grafana:
  env:
    GF_INSTALL_PLUGINS: "https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource"
    GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "wasilak-datadog-datasource"
  
  # Optional: Provision datasource
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Datadog
          type: wasilak-datadog-datasource
          access: backend
          jsonData:
            site: datadoghq.com
          secureJsonData:
            apiKey: ${DATADOG_API_KEY}
            appKey: ${DATADOG_APP_KEY}
```

### Kubernetes Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        env:
        - name: GF_INSTALL_PLUGINS
          value: "https://github.com/wasilak/grafana-datadog-datasource/releases/download/v0.4.2/wasilak-datadog-datasource-v0.4.2.zip;wasilak-datadog-datasource"
        - name: GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS
          value: "wasilak-datadog-datasource"
        ports:
        - containerPort: 3000
```

## 🔧 Advanced Installation

### Custom Plugin Directory

If using a custom plugins directory:

```bash
# Set custom plugins path
export GF_PATHS_PLUGINS="/custom/plugins/path"

# Extract plugin
unzip wasilak-datadog-datasource-v0.4.2.zip -d $GF_PATHS_PLUGINS/

# Configure Grafana
echo "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource" >> /etc/grafana/grafana.ini
```

### Self-Signed Plugin

For production deployments on custom domains:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/wasilak/grafana-datadog-datasource.git
   cd grafana-datadog-datasource
   ```

2. **Build the plugin**:
   ```bash
   make build
   ```

3. **Sign with your private key**:
   ```bash
   npx @grafana/sign-plugin@latest --rootUrls https://your-domain.com
   ```

4. **Install the signed plugin**:
   ```bash
   cp -r dist/ /var/lib/grafana/plugins/wasilak-datadog-datasource/
   ```

## 📋 Platform Support

The plugin includes pre-built binaries for:

| Platform | Architecture | Binary Name |
|----------|-------------|-------------|
| Linux | x86-64 | `gpx_wasilak-datadog-datasource_linux_amd64` |
| Linux | ARM64 | `gpx_wasilak-datadog-datasource_linux_arm64` |
| macOS | Intel | `gpx_wasilak-datadog-datasource_darwin_amd64` |
| macOS | Apple Silicon | `gpx_wasilak-datadog-datasource_darwin_arm64` |
| Windows | x86-64 | `gpx_wasilak-datadog-datasource_windows_amd64.exe` |

## ✅ Verification

After installation, verify the plugin is working:

1. **Check plugin is loaded**:
   - Go to **Administration** → **Plugins**
   - Search for "Datadog"
   - Verify status shows "Enabled"

2. **Test datasource creation**:
   - Go to **Connections** → **Data Sources**
   - Click **Add data source**
   - Search for "Datadog"
   - Plugin should appear in results

3. **Check logs** (if issues):
   ```bash
   # Check Grafana logs
   sudo journalctl -u grafana-server -f
   
   # Or check log files
   tail -f /var/log/grafana/grafana.log
   ```

## 🔍 Troubleshooting

### Plugin Not Appearing

**Issue**: Plugin doesn't show in datasource list

**Solutions**:
1. Verify `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` is set
2. Check plugin extracted to correct directory
3. Restart Grafana service
4. Check Grafana logs for errors

### Signature Errors

**Issue**: "Plugin signature invalid" or similar

**Solutions**:
1. Add plugin to unsigned plugins list:
   ```bash
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
   ```
2. For production, consider self-signing the plugin

### Permission Errors

**Issue**: "Permission denied" during extraction

**Solutions**:
1. Use `sudo` for system directories:
   ```bash
   sudo unzip plugin.zip -d /var/lib/grafana/plugins/
   ```
2. Fix ownership:
   ```bash
   sudo chown -R grafana:grafana /var/lib/grafana/plugins/
   ```

### Binary Architecture Mismatch

**Issue**: "exec format error" or binary won't run

**Solutions**:
1. Verify your platform architecture:
   ```bash
   uname -m  # x86_64, arm64, etc.
   ```
2. Download correct release for your platform
3. Check binary permissions:
   ```bash
   chmod +x /path/to/plugin/gpx_*
   ```

## 🔄 Updating

To update to a newer version:

1. **Stop Grafana**:
   ```bash
   sudo systemctl stop grafana-server
   ```

2. **Remove old plugin**:
   ```bash
   sudo rm -rf /var/lib/grafana/plugins/wasilak-datadog-datasource/
   ```

3. **Install new version** (follow installation steps above)

4. **Start Grafana**:
   ```bash
   sudo systemctl start grafana-server
   ```

## 📚 Next Steps

After successful installation:

1. **[Configure your datasource](configuration.md)** - Set up Datadog API credentials
2. **[Getting started guide](getting-started.md)** - Write your first queries
3. **[Feature overview](features/)** - Explore all capabilities

## 🆘 Need Help?

- **Installation Issues**: [GitHub Issues](https://github.com/wasilak/grafana-datadog-datasource/issues)
- **General Questions**: [GitHub Discussions](https://github.com/wasilak/grafana-datadog-datasource/discussions)
- **Documentation**: [Full Documentation](../README.md)