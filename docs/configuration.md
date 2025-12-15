# Datasource Configuration

## Creating a Datadog Datasource

To use the Grafana Datadog datasource plugin, you need to create a datasource instance in Grafana with the correct settings.

### Web UI Setup

1. Go to **Connections > Data Sources** in Grafana
2. Click **Create data source**
3. Search for and select **Datadog**
4. Configure the following:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | Any name | e.g., "Datadog", "Datadog Prod" |
| **Site** | `datadoghq.com` or `datadoghq.eu` | Depends on your Datadog account region |
| **API Key** | Your Datadog API key | Available at https://app.datadoghq.com/account/settings#api |
| **App Key** | Your Datadog App key | Available at https://app.datadoghq.com/account/settings#api |

**Important:** Do NOT set a URL - leave it blank. This plugin uses backend-only communication.

### API Setup (Programmatic)

```bash
curl -X POST http://localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Datadog",
    "type": "wasilak-datadog-datasource",
    "access": "backend",
    "jsonData": {
      "site": "datadoghq.com"
    },
    "secureJsonData": {
      "apiKey": "YOUR_DATADOG_API_KEY",
      "appKey": "YOUR_DATADOG_APP_KEY"
    }
  }'
```

**Key Requirements:**
- `access` MUST be set to `"backend"` for this plugin
- Leave `url` field empty (don't include it)
- `jsonData.site` can be `datadoghq.com` (US) or `datadoghq.eu` (EU)
- `secureJsonData.apiKey` and `secureJsonData.appKey` must be valid Datadog credentials

### Getting Your Datadog Credentials

1. Log in to your Datadog account
2. Go to [Organization Settings > API Keys](https://app.datadoghq.com/organization/settings/api_keys)
3. Copy your **API Key** and **App Key**
4. Paste them into the Grafana datasource configuration

**For Logs Support:** Ensure your API key has the `logs_read_data` scope enabled:
1. In Datadog, go to [Organization Settings > API Keys](https://app.datadoghq.com/organization/settings/api_keys)
2. Click on your API key
3. Under "Scopes", ensure `logs_read_data` is checked
4. Save the changes

Without the `logs_read_data` scope, you'll only be able to query metrics.

### Testing the Connection

After creating the datasource, click **Save & Test** to verify:
- ✓ "Connected to Datadog" message appears
- ✓ Health check passes
- ✓ Autocomplete endpoints are accessible

### Troubleshooting

**Error: "Bad Gateway" or "502"**
- Ensure `access` is set to `"backend"`
- Ensure URL field is empty
- Check that API and App keys are valid

**Error: "Missing API key" or "Invalid credentials"**
- Verify API and App keys are correctly entered
- Check that keys haven't been rotated in Datadog
- Ensure you're using the correct Datadog site (US vs EU)

**Autocomplete not working**
- Verify the datasource health check passes
- Check browser console for API errors
- Ensure datasource UID is passed correctly to the query editor hook

## Architecture Note

This plugin uses a **backend-only architecture**:
- All API credentials are handled securely by the Grafana backend
- Frontend autocomplete suggestions are fetched via `GET /api/datasources/uid/{uid}/resources/autocomplete/*`
- No direct API calls from the browser
- All communication is proxied through the Go plugin backend
