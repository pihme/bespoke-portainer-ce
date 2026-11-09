import { PropsWithChildren } from 'react';
import { render } from '@testing-library/react';

import { ButtonGroup, Props } from './ButtonGroup';

function renderDefault({
  size = 'small',
  children = 'null',
}: Partial<PropsWithChildren<Props>> = {}) {
  return render(<ButtonGroup size={size}>{children}</ButtonGroup>);
}

test('should display a ButtonGroup component', async () => {
  const { findByRole } = renderDefault({});

  const element = await findByRole('group');
  expect(element).toBeTruthy();
});

test('applies size classes for xsmall and large and omits size class by default', () => {
  const { rerender, getByRole } = render(
    <ButtonGroup size="xsmall" aria-label="sizes">
      a
    </ButtonGroup>
  );
  expect(getByRole('group')).toHaveClass('btn-group-xs');

  rerender(
    <ButtonGroup size="large" aria-label="sizes">
      a
    </ButtonGroup>
  );
  expect(getByRole('group')).toHaveClass('btn-group-lg');

  rerender(<ButtonGroup aria-label="sizes">a</ButtonGroup>);
  expect(getByRole('group').className).toBe('btn-group');
});
