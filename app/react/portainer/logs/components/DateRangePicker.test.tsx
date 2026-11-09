import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DateRangePicker,
  dateRangePickerValidation,
} from './DateRangePicker';

const rangeOnChange = vi.fn();

vi.mock('@wojtekmaj/react-daterange-picker', () => ({
  default: function MockRangePicker({
    onChange,
    value,
    name,
  }: {
    onChange: (v: unknown) => void;
    value: unknown;
    name?: string;
  }) {
    rangeOnChange.mockImplementation(onChange);
    return (
      <div data-cy="mock-range-picker" data-name={name}>
        {JSON.stringify(value)}
        <button type="button" onClick={() => onChange(null)}>
          clear
        </button>
        <button
          type="button"
          onClick={() =>
            onChange([new Date('2024-01-01'), new Date('2024-01-02')])
          }
        >
          both
        </button>
        <button type="button" onClick={() => onChange([new Date('2024-01-01')])}>
          partial
        </button>
        <button
          type="button"
          onClick={() => onChange(new Date('2024-01-03'))}
        >
          single
        </button>
      </div>
    );
  },
}));

describe('DateRangePicker', () => {
  it('renders with null value when uncontrolled range is empty', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={undefined} onChange={onChange} name="dr" />);
    expect(screen.getByText('Date range')).toBeVisible();
    expect(screen.getByTestId('mock-range-picker')).toHaveAttribute(
      'data-name',
      'dr'
    );
    expect(screen.getByTestId('mock-range-picker')).toHaveTextContent('null');
  });

  it('maps picker callbacks into Value objects', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ start: new Date('2024-01-01'), end: new Date('2024-01-02') }}
        onChange={onChange}
      />
    );

    screen.getByText('clear').click();
    expect(onChange).toHaveBeenLastCalledWith(undefined);

    screen.getByText('both').click();
    expect(onChange).toHaveBeenLastCalledWith({
      start: new Date('2024-01-01'),
      end: new Date('2024-01-02'),
    });

    screen.getByText('partial').click();
    expect(onChange).toHaveBeenLastCalledWith(undefined);

    screen.getByText('single').click();
    expect(onChange).toHaveBeenLastCalledWith({
      start: new Date('2024-01-03'),
      end: null,
    });
  });

  it('exposes a yup schema for date ranges', async () => {
    const schema = dateRangePickerValidation();
    await expect(
      schema.validate({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      })
    ).resolves.toBeTruthy();
  });
});
