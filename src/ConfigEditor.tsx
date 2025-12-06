import React, { ChangeEvent } from 'react';
import { InlineField, Input, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions, MySecureJsonData> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const onSiteChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        site: event.target.value,
      },
    });
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

  return (
    <>
      <InlineField label="Site" labelWidth={14} interactive tooltip="Datadog site (e.g., datadoghq.com or datadoghq.eu)">
        <Input
          id="config-editor-site"
          onChange={onSiteChange}
          value={jsonData.site || ''}
          placeholder="datadoghq.com"
          width={40}
        />
      </InlineField>
      <InlineField label="API Key" labelWidth={14} interactive tooltip="Secure json field (backend only)">
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
      <InlineField label="APP Key" labelWidth={14} interactive tooltip="Secure json field (backend only)">
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
    </>
  );
}
