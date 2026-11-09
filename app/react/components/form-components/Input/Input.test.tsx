import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input, InputWithRef } from './Input';
import { InputLabeled } from './InputLabeled';
import { Select } from './Select';
import { TextArea } from './Textarea';

describe('Input', () => {
  it('renders with form-control class and data-cy', () => {
    render(<Input data-cy="name" value="abc" onChange={() => {}} />);
    const input = screen.getByDisplayValue('abc');
    expect(input).toHaveClass('form-control');
    expect(input).toHaveAttribute('data-cy', 'name');
  });

  it('renders empty string for NaN number values', () => {
    render(
      <Input
        type="number"
        value={Number.NaN}
        onChange={() => {}}
        data-cy="num"
      />
    );
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
  });

  it('forwards a ref through InputWithRef', () => {
    const ref = createRef<HTMLInputElement>();
    render(<InputWithRef ref={ref} data-cy="ref" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('InputLabeled', () => {
  it('renders label addon and input; disables when needsDeletion', () => {
    render(
      <InputLabeled
        label="name"
        id="env-name"
        value="FOO"
        onChange={() => {}}
        needsDeletion
        data-cy="labeled"
        required
      />
    );
    expect(screen.getByText('name')).toBeVisible();
    expect(screen.getByDisplayValue('FOO')).toBeDisabled();
  });
});

describe('Select', () => {
  it('renders options including disabled ones', () => {
    render(
      <Select
        data-cy="mode"
        value="a"
        onChange={() => {}}
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta', disabled: true },
        ]}
      />
    );
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeDisabled();
  });
});

describe('TextArea', () => {
  it('renders a textarea with form-control', () => {
    render(
      <TextArea data-cy="notes" value="hello" onChange={() => {}} />
    );
    expect(screen.getByDisplayValue('hello')).toHaveClass('form-control');
  });
});
