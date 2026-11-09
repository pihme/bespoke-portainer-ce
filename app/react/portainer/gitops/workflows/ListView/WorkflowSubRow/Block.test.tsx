import { render } from '@testing-library/react';

import { Block, Dot } from './Block';

describe('Block and Dot', () => {
  it('renders status-colored block and dot', () => {
    const { container, rerender } = render(
      <Block status="healthy">ok</Block>
    );
    expect(container.firstChild).toHaveClass('rounded');
    expect(container.textContent).toBe('ok');

    rerender(<Dot status="error" />);
    expect(container.querySelector('span')).toHaveClass('rounded-full');
  });
});
