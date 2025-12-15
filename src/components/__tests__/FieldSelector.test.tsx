import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldSelector, FieldOption } from '../FieldSelector';

// Mock Grafana UI components
jest.mock('@grafana/ui', () => ({
  Select: ({ value, options, onChange, placeholder, disabled, invalid, width, ...props }: any) => (
    <select
      data-testid="field-selector"
      value={value?.value || ''}
      onChange={(e) => {
        const selectedOption = options.find((opt: any) => opt.value === e.target.value);
        if (selectedOption) {
          onChange(selectedOption);
        }
      }}
      disabled={disabled}
      data-invalid={invalid}
      data-width={width}
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  InlineField: ({ label, children, required, invalid, tooltip, labelWidth, ...props }: any) => (
    <div data-testid="inline-field" data-required={required} data-invalid={invalid} data-label-width={labelWidth} {...props}>
      <label>{label}</label>
      {children}
    </div>
  ),
  Alert: ({ title, severity, children, ...props }: any) => (
    <div data-testid="alert" data-severity={severity} {...props}>
      {title && <div>{title}</div>}
      {children}
    </div>
  ),
}));

describe('FieldSelector', () => {
  const mockOptions: FieldOption[] = [
    { value: 'message', label: 'Message Field', description: 'Parse JSON from message field' },
    { value: 'data', label: 'Data Field', description: 'Parse JSON from data field' },
    { value: 'attributes', label: 'Attributes Field', description: 'Parse JSON from attributes field' },
  ];

  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    options: mockOptions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<FieldSelector {...defaultProps} />);
    
    expect(screen.getByText('Field')).toBeInTheDocument();
    expect(screen.getByTestId('field-selector')).toBeInTheDocument();
  });

  it('displays custom label when provided', () => {
    render(<FieldSelector {...defaultProps} label="Parse Field" />);
    
    expect(screen.getByText('Parse Field')).toBeInTheDocument();
  });

  it('shows validation error when required but no value selected', () => {
    render(<FieldSelector {...defaultProps} required={true} />);
    
    expect(screen.getByText('Field is required')).toBeInTheDocument();
    expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'error');
  });

  it('shows custom validation error when provided', () => {
    const customError = 'Custom validation error';
    render(<FieldSelector {...defaultProps} validationError={customError} />);
    
    expect(screen.getByText(customError)).toBeInTheDocument();
    expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'error');
  });

  it('does not show validation error when value is selected', () => {
    render(<FieldSelector {...defaultProps} value="message" required={true} />);
    
    expect(screen.queryByText('Field is required')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
  });

  it('calls onChange when selection changes', () => {
    const mockOnChange = jest.fn();
    render(<FieldSelector {...defaultProps} onChange={mockOnChange} />);
    
    const select = screen.getByTestId('field-selector');
    fireEvent.change(select, { target: { value: 'message' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('message');
  });

  it('applies disabled state correctly', () => {
    render(<FieldSelector {...defaultProps} disabled={true} />);
    
    const select = screen.getByTestId('field-selector');
    expect(select).toBeDisabled();
  });

  it('applies required styling when required prop is true', () => {
    render(<FieldSelector {...defaultProps} required={true} />);
    
    const inlineField = screen.getByTestId('inline-field');
    expect(inlineField).toHaveAttribute('data-required', 'true');
  });

  it('applies invalid styling when validation error exists', () => {
    render(<FieldSelector {...defaultProps} validationError="Error message" />);
    
    const inlineField = screen.getByTestId('inline-field');
    expect(inlineField).toHaveAttribute('data-invalid', 'true');
  });

  it('displays placeholder text correctly', () => {
    const customPlaceholder = 'Choose a field';
    render(<FieldSelector {...defaultProps} placeholder={customPlaceholder} />);
    
    expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
  });

  it('sets correct width on select component', () => {
    render(<FieldSelector {...defaultProps} width={30} />);
    
    const select = screen.getByTestId('field-selector');
    expect(select).toHaveAttribute('data-width', '30');
  });

  it('renders all field options correctly', () => {
    render(<FieldSelector {...defaultProps} />);
    
    mockOptions.forEach(option => {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    });
  });

  it('selects the correct option when value is provided', () => {
    render(<FieldSelector {...defaultProps} value="data" />);
    
    const select = screen.getByTestId('field-selector');
    expect(select).toHaveValue('data');
  });

  it('applies custom label width', () => {
    render(<FieldSelector {...defaultProps} labelWidth={20} />);
    
    const inlineField = screen.getByTestId('inline-field');
    expect(inlineField).toHaveAttribute('data-label-width', '20');
  });
});