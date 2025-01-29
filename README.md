# Grafana Data Source Plugin for Datadog

> [!NOTE]  
> It is an **unofficial** Datadog plugin utilising Datadog API for metrics queries. There is also [official Datadog plugin](https://grafana.com/grafana/plugins/grafana-datadog-datasource/) available for Enterprise Grafana subscriptions. This is also the reason why this plugin probably won't be available on official Grafana plugins site... :/

## Features:

- **Does not support** logs nor traces, only **metrics**
- Supports:
  - Explore
  - Dashboard variables
  - Most of visualisations, at least stock ones
  - Custom graph series names/labels (including variables), e.g. `$host` or `{{host}}`
  - Inline comments in query field: lines starting with `#` + toggling using `cmd+/` or `ctrl+/`
- Requirements:
  - Site name i.e. `datadoghq.eu`
  - (Probably) paid Datadog subscription in order to get:
    - API key
    - Application key (it worked for me with "not scoped" Application key)

## Installation

1. Add this plugin to "trusted" using i.e. env variable:

   ```shell
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource"
   ```

2. Install either by unpacking to plugin dir or by using env variable i.e.:

   ```shell
   GF_INSTALL_PLUGINS=https://github.com/wasilak/grafana-datadog-datasource/releases/download/0.1.0/wasilak-datadog-datasource-0.1.0.zip;Datadog
   ```

   Or

3. You can checkout plugin code and sign it yourself with so-called private signature level as descibed [here](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/).
4. Install plugin code

## Test run

You can test it out e.g. with following:

- query:

  ```plain
  sum:datadog.apis.usage.per_user{*} by {rate_limit_status,limit_name}
  ```

- label:

  ```plain
  {{limit_name}}: {{rate_limit_status}}
  ```

## Screenshots

### Datasource

![Datasource](https://github.com/wasilak/grafana-datadog-datasource/raw/main/src/img/datasource.jpg)

### Query

![Query](https://github.com/wasilak/grafana-datadog-datasource/raw/main/src/img/query_full.jpg)
