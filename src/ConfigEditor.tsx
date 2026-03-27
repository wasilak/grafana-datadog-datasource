import React, { ChangeEvent, useState } from 'react';
import { InlineField, Input, SecretInput, Button, Alert } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { MyDataSourceOptions, MySecureJsonData } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions, MySecureJsonData> {}

// Valid Datadog site hostnames
const VALID_SITE_PATTERN =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function validateSite(site: string): string | null {
  if (!site) {
    return null; // Empty is ok — backend defaults to datadoghq.com
  }
  // Strip protocol prefix if user accidentally typed it
  const stripped = site.replace(/^https?:\/\//, '');
  if (!VALID_SITE_PATTERN.test(stripped)) {
    return `"${site}" is not a valid hostname. Use format like: datadoghq.com, datadoghq.eu, us3.datadoghq.com`;
  }
  return null;
}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const [siteError, setSiteError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  const onSiteChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSiteError(validateSite(value));
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        site: value,
      },
    });
  };

  const onSiteBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setSiteError(validateSite(event.target.value));
  };

  const onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        apiKey: event.target.value,
      },
    });
  };

  const onResetAPIKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...secureJsonData,
        apiKey: '',
      },
    });
  };

  const onAPPKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        appKey: event.target.value,
      },
    });
  };

  const onResetAPPKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        appKey: false,
      },
      secureJsonData: {
        ...secureJsonData,
        appKey: '',
      },
    });
  };

  const onTestConnection = async () => {
    setTestStatus('loading');
    setTestMessage('');
    try {
      const response = await getBackendSrv()
        .fetch({
          url: `/api/datasources/uid/${options.uid}/health`,
          method: 'GET',
        })
        .toPromise();
      const data = (response as any).data;
      if (data?.status === 'OK') {
        setTestStatus('success');
        setTestMessage(data.message || 'Successfully connected to Datadog');
      } else {
        setTestStatus('error');
        setTestMessage(data?.message || 'Connection test failed');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      const errMessage = err instanceof Error ? err.message : 'Connection test failed — check your API and App keys';
      setTestMessage(errMessage);
    }
  };

  return (
    <>
      <InlineField
        label="Site"
        labelWidth={14}
        interactive
        tooltip="Datadog site (e.g., datadoghq.com or datadoghq.eu)"
        invalid={!!siteError}
        error={siteError || undefined}
      >
        <Input
          id="config-editor-site"
          onChange={onSiteChange}
          onBlur={onSiteBlur}
          value={jsonData.site || ''}
          placeholder="datadoghq.com"
          width={40}
          invalid={!!siteError}
        />
      </InlineField>
      <InlineField label="API Key" labelWidth={14} interactive tooltip="Datadog API key (backend only)">
        <SecretInput
          required
          id="config-editor-api-key"
          isConfigured={secureJsonFields?.apiKey}
          value={secureJsonData?.apiKey}
          placeholder="Enter your API key"
          width={40}
          onReset={onResetAPIKey}
          onChange={onAPIKeyChange}
        />
      </InlineField>
      <InlineField label="APP Key" labelWidth={14} interactive tooltip="Datadog application key (backend only)">
        <SecretInput
          required
          id="config-editor-app-key"
          isConfigured={secureJsonFields?.appKey}
          value={secureJsonData?.appKey}
          placeholder="Enter your application key"
          width={40}
          onReset={onResetAPPKey}
          onChange={onAPPKeyChange}
        />
      </InlineField>
      <InlineField label=" " labelWidth={14}>
        <Button
          variant="secondary"
          onClick={onTestConnection}
          disabled={testStatus === 'loading' || !!siteError}
          icon={testStatus === 'loading' ? 'spinner' : 'heart'}
        >
          {testStatus === 'loading' ? 'Testing...' : 'Test Connection'}
        </Button>
      </InlineField>
      {testStatus === 'success' && (
        <Alert title="Connection successful" severity="success">
          {testMessage}
        </Alert>
      )}
      {testStatus === 'error' && (
        <Alert title="Connection failed" severity="error">
          {testMessage}
        </Alert>
      )}
    </>
  );
}
