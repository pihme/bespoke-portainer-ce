import { PropsWithChildren } from 'react';
import { Plus } from 'lucide-react';
import { fireEvent, render } from '@testing-library/react';

import { Button, ButtonWithRef, Props } from './Button';

function renderDefault({
  type = 'button',
  color = 'primary',
  size = 'small',
  disabled = false,
  onClick = () => {},
  children = null,
}: Partial<PropsWithChildren<Props>> = {}) {
  return render(
    <Button
      type={type}
      data-cy="button"
      color={color}
      size={size}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

test('should display a Button component and allow onClick', async () => {
  const children = 'test label';
  const onClick = vi.fn();
  const { findByText } = renderDefault({ children, onClick });

  const buttonLabel = await findByText(children);
  expect(buttonLabel).toBeTruthy();

  fireEvent.click(buttonLabel);
  expect(onClick).toHaveBeenCalled();
});

test('applies size classes and icon sizes for every Size', () => {
  const { rerender, container } = render(
    <Button data-cy="button" size="xsmall" icon={Plus}>
      xs
    </Button>
  );
  expect(container.querySelector('button')).toHaveClass('btn-xs');

  rerender(
    <Button data-cy="button" size="medium" icon={Plus}>
      md
    </Button>
  );
  expect(container.querySelector('button')).toHaveClass('btn-md');

  rerender(
    <Button data-cy="button" size="large" icon={Plus}>
      lg
    </Button>
  );
  expect(container.querySelector('button')).toHaveClass('btn-lg');
});

test('does not call onClick when disabled', () => {
  const onClick = vi.fn();
  const { getByRole } = render(
    <Button data-cy="button" disabled onClick={onClick}>
      blocked
    </Button>
  );
  fireEvent.click(getByRole('button', { name: 'blocked' }));
  expect(onClick).not.toHaveBeenCalled();
});

test('ButtonWithRef forwards the ref to the button element', () => {
  const ref = { current: null as HTMLButtonElement | null };
  render(
    <ButtonWithRef
      data-cy="button"
      ref={(el) => {
        ref.current = el;
      }}
    >
      ref
    </ButtonWithRef>
  );
  expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  expect(ref.current?.textContent).toBe('ref');
});
