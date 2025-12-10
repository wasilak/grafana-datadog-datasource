# Provisioning Configuration

This directory contains Grafana provisioning configuration for local development.

## Setup for Local Development

1. Create your datasource configuration:
   ```bash
   mkdir -p provisioning/datasources
   ```

2. Create `provisioning/datasources/datadog.yaml` with your credentials:
   ```yaml
   apiVersion: 1
   datasources:
     - name: wasilak-datadog-datasource
       type: Datadog
       jsonData:
         site: datadoghq.eu  # or datadoghq.com for US
       secureJsonData:
         apiKey: YOUR_ACTUAL_DATADOG_API_KEY
         appKey: YOUR_ACTUAL_DATADOG_APP_KEY
   ```

3. Start the development environment:
   ```bash
   make server
   ```

## Security Note

The `datasources/` directory is gitignored to prevent accidental commits of credentials.
Never commit actual API keys or secrets to the repository.