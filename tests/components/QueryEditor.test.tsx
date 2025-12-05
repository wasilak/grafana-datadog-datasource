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
});
