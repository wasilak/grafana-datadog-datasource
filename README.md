# Grafana Data Source Plugin for Datadog (metrics only)

## Getting started

1. Install dependencies

   ```bash
   yarn install
   ```

2. Build plugin in development mode or run in watch mode

   ```bash
   yarn dev
   ```

   or

   ```bash
   yarn watch
   ```

3. Build plugin in production mode

   ```bash
   yarn build
   ```

```
docker run -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-dd-plugin" -d -p 3000:3000 -v "$(pwd)"/grafana-plugins:/var/lib/grafana/plugins -v "$(pwd)"/data:/var/lib/grafana --name=grafana grafana/grafana
```
