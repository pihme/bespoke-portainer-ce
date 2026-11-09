import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { PageButton } from './PageButton';

describe('PageButton', () => {
  it('invokes onPageChange when clicked with a numeric page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PageButton page={3} onPageChange={onPageChange}>
        3
      </PageButton>
    );
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('ignores clicks for ellipsis pages', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PageButton page="..." onPageChange={onPageChange}>
        ...
      </PageButton>
    );
    await user.click(screen.getByRole('button', { name: '...' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
