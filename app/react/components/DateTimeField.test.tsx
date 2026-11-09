import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-datetime-picker', () => ({
  default: ({
    name,
    value,
    onChange,
    'data-cy': dataCy,
  }: {
    name: string;
    value: Date | null;
    onChange: (d: Date | null) => void;
    'data-cy': string;
  }) => (
    <input
      data-cy={dataCy}
      name={name}
      value={value ? value.toISOString() : ''}
      onChange={() => onChange(new Date('2024-01-02T03:04:00Z'))}
    />
  ),
}));

import { DateTimeField, FORMAT } from './DateTimeField';

describe('DateTimeField', () => {
  it('exports the display format constant', () => {
    expect(FORMAT).toBe('YYYY-MM-DD HH:mm');
  });

  it('renders an enabled datetime picker', () => {
    const onChange = vi.fn();
    render(
      <DateTimeField
        label="Starts at"
        name="startsAt"
        value={new Date('2024-01-01T00:00:00Z')}
        onChange={onChange}
        data-cy="starts-at"
      />
    );
    expect(screen.getByText('Starts at')).toBeVisible();
    expect(screen.getByTestId('starts-at')).toBeInTheDocument();
  });

  it('renders a disabled read-only value', () => {
    render(
      <DateTimeField
        label="Ends at"
        name="endsAt"
        value={new Date('2024-06-15T12:30:00Z')}
        onChange={() => {}}
        disabled
        data-cy="ends-at"
        error="required"
      />
    );
    expect(screen.getByTestId('ends-at-disabled-value')).toBeDisabled();
  });
});
