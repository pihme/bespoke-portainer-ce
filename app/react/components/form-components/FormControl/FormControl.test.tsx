import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormControl, Props } from './FormControl';

function renderDefault({
  inputId = 'id',
  label,
  tooltip = '',
  errors,
  ...rest
}: Partial<Props> & { label?: Props['label'] }) {
  return render(
    <FormControl
      inputId={inputId}
      label={label ?? 'Label'}
      tooltip={tooltip}
      errors={errors}
      {...rest}
    >
      <input id={inputId} />
    </FormControl>
  );
}

test('should display a Input component', async () => {
  const label = 'test label';
  const { findByText } = renderDefault({ label });

  const inputElem = await findByText(label);
  expect(inputElem).toBeTruthy();
});

describe('FormControl', () => {
  it('shows required marker, tooltip, errors and size classes', () => {
    const { container, rerender } = renderDefault({
      label: 'Name',
      required: true,
      tooltip: 'help',
      errors: 'Name is required',
      size: 'large',
      dataCy: 'fc',
    });
    expect(screen.getByText('*')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    expect(container.querySelector('.col-sm-5')).toBeTruthy();

    rerender(
      <FormControl label="M" size="medium" inputId="m">
        <input id="m" />
      </FormControl>
    );
    expect(container.querySelector('.col-sm-4')).toBeTruthy();

    rerender(
      <FormControl label="X" size="xsmall" inputId="x">
        <input id="x" />
      </FormControl>
    );
    expect(container.querySelector('.col-sm-1')).toBeTruthy();

    rerender(
      <FormControl label="V" size="vertical" inputId="v">
        <input id="v" />
      </FormControl>
    );
    expect(screen.getByText('V')).toBeVisible();
  });

  it('shows loader instead of children when loading', () => {
    renderDefault({
      label: 'Slow',
      isLoading: true,
      loadingText: 'Please wait',
      errors: 'should hide',
    });
    expect(screen.getByText('Please wait')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
