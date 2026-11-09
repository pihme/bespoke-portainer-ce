import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders label and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox
        id="cb"
        label="Enable GPU"
        checked={false}
        onChange={onChange}
        data-cy="cb"
      />
    );
    expect(screen.getByText('Enable GPU')).toBeVisible();
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalled();
  });

  it('sets indeterminate via ref and supports non-bold label', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <Checkbox
        id="cb2"
        label="Pick some"
        indeterminate
        bold={false}
        data-cy="cb2"
        ref={ref}
      />
    );
    expect(ref.current?.indeterminate).toBe(true);
    expect(screen.getByText('Pick some')).toHaveClass('!font-normal');
  });

  it('uses an internal ref when none is provided', () => {
    render(
      <Checkbox id="cb3" label="Internal" indeterminate data-cy="cb3" />
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
