import { Rocket } from 'lucide-react';
import { render, fireEvent, screen } from '@testing-library/react';

import { BoxSelector } from './BoxSelector';
import { BoxSelectorOption, Value } from './types';

function renderDefault<T extends Value>({
  options = [],
  onChange = () => {},
  radioName = 'radio',
  value,
  ...rest
}: {
  options?: BoxSelectorOption<T>[];
  onChange?: (value: T | T[], limitedToBE: boolean) => void;
  radioName?: string;
  value: T | T[];
  isMulti?: boolean;
  slim?: boolean;
  hiddenSpacingCount?: number;
  error?: string;
  useGridLayout?: boolean;
  label?: string;
}) {
  return render(
    <BoxSelector
      options={options}
      onChange={onChange}
      radioName={radioName}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value={value as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(rest as any)}
    />
  );
}

const options: BoxSelectorOption<number>[] = [
  {
    description: 'description 1',
    icon: Rocket,
    id: '1',
    value: 3,
    label: 'option 1',
  },
  {
    description: 'description 2',
    icon: Rocket,
    id: '2',
    value: 4,
    label: 'option 2',
  },
  {
    description: 'hidden',
    icon: Rocket,
    id: '3',
    value: 5,
    label: 'hidden option',
    hide: true,
  },
];

describe('BoxSelector', () => {
  it('should render with the initial value selected and call onChange when clicking a different value', () => {
    const onChange = vi.fn();
    const { getByLabelText } = renderDefault({
      options,
      onChange,
      value: options[0].value,
    });

    const item1 = getByLabelText(options[0].label, {
      exact: false,
    }) as HTMLInputElement;
    expect(item1.checked).toBeTruthy();

    const item2 = getByLabelText(options[1].label, {
      exact: false,
    }) as HTMLInputElement;
    expect(item2.checked).toBeFalsy();

    fireEvent.click(item2);
    expect(onChange).toHaveBeenCalledWith(options[1].value);
  });

  it('does not call onChange when clicking the already selected value', () => {
    const onChange = vi.fn();
    const { getByLabelText } = renderDefault({
      options,
      onChange,
      value: options[0].value,
    });

    fireEvent.click(
      getByLabelText(options[0].label, { exact: false }) as HTMLInputElement
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hides options marked hide and supports multi-select toggles', () => {
    const onChange = vi.fn();
    renderDefault({
      options,
      onChange,
      value: [3],
      isMulti: true,
      label: 'Pick options',
      error: 'required',
      hiddenSpacingCount: 2,
      useGridLayout: true,
      slim: true,
    });

    expect(screen.queryByText('hidden option')).not.toBeInTheDocument();
    expect(screen.getByText('Pick options')).toBeVisible();
    expect(screen.getByText('required')).toBeVisible();

    fireEvent.click(
      screen.getByLabelText(options[1].label, {
        exact: false,
      }) as HTMLInputElement
    );
    expect(onChange).toHaveBeenCalledWith([3, 4]);

    onChange.mockClear();
    fireEvent.click(
      screen.getByLabelText(options[0].label, {
        exact: false,
      }) as HTMLInputElement
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('supports a disabled option factory and tooltip', () => {
    const onChange = vi.fn();
    renderDefault({
      options: [
        {
          ...options[0],
          disabled: () => true,
          tooltip: () => 'not available',
        },
        options[1],
      ],
      onChange,
      value: 4,
    });

    const disabled = screen.getByLabelText(options[0].label, {
      exact: false,
    }) as HTMLInputElement;
    expect(disabled.disabled).toBe(true);
  });

  it('renders badge and raw icon types', () => {
    renderDefault({
      options: [
        {
          id: 'badge',
          value: 1,
          label: 'badge option',
          description: 'b',
          icon: Rocket,
          iconType: 'badge',
        },
        {
          id: 'raw',
          value: 2,
          label: 'raw option',
          description: 'r',
          icon: Rocket,
          iconType: 'raw',
        },
        {
          id: 'none',
          value: 3,
          label: 'no icon',
          description: 'n',
        },
      ],
      value: 1,
    });

    expect(screen.getByText('badge option')).toBeVisible();
    expect(screen.getByText('raw option')).toBeVisible();
    expect(screen.getByText('no icon')).toBeVisible();
  });
});
