import React from 'react';
import { Combobox, ComboboxOption, InlineField, Alert } from '@grafana/ui';

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FieldSelectorProps {
  value: string;
  onChange: (field: string) => void;
  options: FieldOption[];
  label?: string;
  labelWidth?: number;
  tooltip?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  width?: number;
  validationError?: string;
}

/**
 * Reusable FieldSelector component with dropdown functionality
 * Provides validation and visual feedback for field selection
 * Requirements: 1.2, 7.3, 7.5
 */
export function FieldSelector({
  value,
  onChange,
  options,
  label = "Field",
  labelWidth = 12,
  tooltip,
  placeholder = "Select field",
  required = false,
  disabled = false,
  width = 20,
  validationError
}: FieldSelectorProps) {
  
  // Convert FieldOption[] to ComboboxOption[] for Grafana Combobox component
  const selectOptions: Array<ComboboxOption<string>> = options.map(option => ({
    value: option.value,
    label: option.label,
    description: option.description
  }));

  // Handle selection change
  const handleChange = (option: ComboboxOption<string>) => {
    if (option?.value) {
      onChange(option.value);
    }
  };

  // Show validation error if field is required but not selected
  const showValidationError = validationError || (required && !value);
  const errorMessage = validationError || (required && !value ? `${label} is required` : '');

  return (
    <>
      <InlineField 
        label={label}
        labelWidth={labelWidth}
        tooltip={tooltip}
        required={required}
        invalid={!!showValidationError}
      >
        <Combobox
          width={width}
          value={value || null}
          options={selectOptions}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          invalid={!!showValidationError}
        />
      </InlineField>
      
      {/* Display validation error */}
      {showValidationError && (
        <Alert 
          title="Field Selection Error" 
          severity="error" 
          style={{ marginTop: '4px', marginBottom: '8px' }}
        >
          {errorMessage}
        </Alert>
      )}
    </>
  );
}
