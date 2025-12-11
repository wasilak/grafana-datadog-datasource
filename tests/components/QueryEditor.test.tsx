import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryEditor } from '../../src/QueryEditor';
import { DataSource } from '../../src/datasource';
import { MyQuery, MyDataSourceOptions } from '../../src/types';
import * as useQueryAutocompleteModule from '../../src/hooks/useQueryAutocomplete';

jest.mock('../../src/hooks/useQueryAutocomplete');
jest.mock('@grafana/ui', () => ({
  TextArea: React.forwardRef(({ onChange, onKeyDown, onClick, ...props }: any, ref: any) => (
    <textarea ref={ref} onChange={onChange} onKeyDown={onKeyDown} onClick={onClick} {...props} />
  )),
  Input: (props: any) => <input {...props} />,
  Spinner: () => <div data-testid="spinner">Loading...</div>,
  Button: ({ onClick, children, icon, ...props }: any) => (
    <button onClick={onClick} data-icon={icon} {...props}>
      {children}
    </button>
  ),
  CodeEditor: ({ onChange, value, ...props }: any) => (
    <textarea onChange={(e) => onChange(e.target.value)} value={value} {...props} />
  ),
  Stack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Alert: ({ children, title, ...props }: any) => (
    <div data-testid="alert" {...props}>
      {title && <div>{title}</div>}
      {children}
    </div>
  ),
  useTheme2: () => ({
    colors: {
      text: { primary: '#000', secondary: '#666' },
      background: { primary: '#fff', secondary: '#f5f5f5' },
      border: { weak: '#ddd' },
      action: { selected: '#333' },
      primary: { text: '#007bff' }
    },
    spacing: (n: number) => `${n * 8}px`,
    typography: {
      fontWeightMedium: 500,
      h5: { fontSize: '16px' },
      bodySmall: { fontSize: '12px' },
      fontFamilyMonospace: 'monospace'
    },
    shape: { radius: { default: '4px' } },
    shadows: { z3: '0 2px 4px rgba(0,0,0,0.1)' },
    isDark: false
  }),
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>
}));

jest.mock('../../src/QueryEditorHelp', () => ({
  QueryEditorHelp: ({ onClickExample }: any) => (
    <div data-testid="query-editor-help">
      <button onClick={() => onClickExample({ queryText: 'test-query', label: 'test-label' })}>
        Use Example
      </button>
    </div>
  )
}));

describe('QueryEditor', () => {
  const mockDatasource = {
    uid: 'test-datasource-uid',
  } as any as DataSource;

  const mockQuery: MyQuery = {
    queryText: '',
    label: '',
  };

  const mockOnChange = jest.fn();
  const mockOnRunQuery = jest.fn();

  const defaultProps = {
    query: mockQuery,
    onChange: mockOnChange,
    onRunQuery: mockOnRunQuery,
    datasource: mockDatasource,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render query text area and label input', () => {
    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue({
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    });

    render(
      <QueryEditor
        {...defaultProps}
      />
    );

    expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Query text area
    const inputs = screen.getAllByDisplayValue('');
    expect(inputs.length).toBeGreaterThan(1); // Query and label inputs
  });

  it('should call onChange when query text changes', async () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    const { container } = render(
      <QueryEditor
        {...defaultProps}
      />
    );

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea!, { target: { value: 'avg:metric.cpu' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryText: 'avg:metric.cpu',
      })
    );
  });

  it('should trigger autocomplete on input', async () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    const { container } = render(
      <QueryEditor
        {...defaultProps}
      />
    );

    const textarea = container.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: 'metric', selectionStart: 6 } });

    expect(mockHook.onInput).toHaveBeenCalledWith('metric', 6);
  });

  it('should display autocomplete menu when isOpen and has suggestions', () => {
    const mockHook = {
      state: {
        isOpen: true,
        suggestions: [
          { label: 'metric.cpu', insertText: 'metric.cpu', kind: 1 },
          { label: 'metric.memory', insertText: 'metric.memory', kind: 1 },
        ],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(
      <QueryEditor
        {...defaultProps}
      />
    );

    expect(screen.getByText('metric.cpu')).toBeInTheDocument();
    expect(screen.getByText('metric.memory')).toBeInTheDocument();
  });

  it('should not display autocomplete menu when closed', () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [
          { label: 'metric.cpu', insertText: 'metric.cpu', kind: 1 },
        ],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(
      <QueryEditor
        {...defaultProps}
      />
    );

    expect(screen.queryByText('metric.cpu')).not.toBeInTheDocument();
  });

  it('should display loading state in autocomplete', () => {
    const mockHook = {
      state: {
        isOpen: true,
        suggestions: [],
        isLoading: true,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(
      <QueryEditor
        {...defaultProps}
      />
    );

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();
  });

  it('should display error in autocomplete', () => {
    const mockHook = {
      state: {
        isOpen: true,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: 'Failed to fetch suggestions',
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(
      <QueryEditor
        {...defaultProps}
      />
    );

    expect(screen.getByText(/Error: Failed to fetch suggestions/)).toBeInTheDocument();
  });

  it('should handle suggestion selection', () => {
    const mockHook = {
      state: {
        isOpen: true,
        suggestions: [
          { label: 'metric.cpu', insertText: 'metric.cpu', kind: 1 },
        ],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(
      <QueryEditor
        {...defaultProps}
      />
    );

    const suggestion = screen.getByText('metric.cpu');
    fireEvent.click(suggestion);

    expect(mockHook.onItemSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'metric.cpu',
        insertText: 'metric.cpu',
      })
    );
  });

  it('should handle keyboard navigation', () => {
    const mockHook = {
      state: {
        isOpen: true,
        suggestions: [
          { label: 'metric.cpu', insertText: 'metric.cpu', kind: 1 },
        ],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    const { container } = render(
      <QueryEditor
        {...defaultProps}
      />
    );

    const textarea = container.querySelector('textarea')!;
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });

    expect(mockHook.onKeyDown).toHaveBeenCalled();
  });

  it('should handle label change', () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    const { container } = render(
      <QueryEditor
        {...defaultProps}
      />
    );

    const inputs = container.querySelectorAll('input');
    const labelInput = inputs[inputs.length - 1]; // Last input is the label

    fireEvent.change(labelInput, { target: { value: 'CPU Usage' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'CPU Usage',
      })
    );
  });

  it('should highlight selected suggestion', () => {
    const mockHook = {
      state: {
        isOpen: true,
        suggestions: [
          { label: 'metric.cpu', insertText: 'metric.cpu', kind: 1 },
          { label: 'metric.memory', insertText: 'metric.memory', kind: 1 },
        ],
        isLoading: false,
        selectedIndex: 1,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    const { container } = render(
      <QueryEditor
        {...defaultProps}
      />
    );

    const listItems = container.querySelectorAll('li');
    expect(listItems[1]).toHaveStyle('backgroundColor: #333');
  });

  it('should handle comment toggle with Ctrl+/', () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    const { container } = render(
      <QueryEditor
        {...defaultProps}
        query={{ ...mockQuery, queryText: 'metric.cpu' }}
      />
    );

    const textarea = container.querySelector('textarea')!;
    fireEvent.keyDown(textarea, { key: '/', ctrlKey: true });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryText: expect.stringContaining('#'),
      })
    );
  });

  it('should show help button', () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(<QueryEditor {...defaultProps} />);

    expect(screen.getByText('Variable Examples')).toBeInTheDocument();
  });

  it('should toggle help component when help button is clicked', () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(<QueryEditor {...defaultProps} />);

    // Help should not be visible initially
    expect(screen.queryByTestId('query-editor-help')).not.toBeInTheDocument();

    // Click help button
    fireEvent.click(screen.getByText('Variable Examples'));

    // Help should now be visible
    expect(screen.getByTestId('query-editor-help')).toBeInTheDocument();
    expect(screen.getByText('Hide Help')).toBeInTheDocument();

    // Click help button again
    fireEvent.click(screen.getByText('Hide Help'));

    // Help should be hidden again
    expect(screen.queryByTestId('query-editor-help')).not.toBeInTheDocument();
    expect(screen.getByText('Variable Examples')).toBeInTheDocument();
  });

  it('should handle example selection from help component', () => {
    const mockHook = {
      state: {
        isOpen: false,
        suggestions: [],
        isLoading: false,
        selectedIndex: 0,
        error: undefined,
        validationError: undefined,
      },
      onInput: jest.fn(),
      onKeyDown: jest.fn(),
      onItemSelect: jest.fn(),
      onClose: jest.fn(),
    };

    (useQueryAutocompleteModule.useQueryAutocomplete as jest.Mock).mockReturnValue(mockHook);

    render(<QueryEditor {...defaultProps} />);

    // Show help
    fireEvent.click(screen.getByText('Variable Examples'));
    expect(screen.getByTestId('query-editor-help')).toBeInTheDocument();

    // Click example
    fireEvent.click(screen.getByText('Use Example'));

    // Should call onChange with example query
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryText: 'test-query',
        label: 'test-label'
      })
    );

    // Help should be hidden after selecting example
    expect(screen.queryByTestId('query-editor-help')).not.toBeInTheDocument();
  });
});
