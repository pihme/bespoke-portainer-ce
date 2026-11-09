import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { PageSelector } from './PageSelector';

describe('PageSelector', () => {
  it('returns null when there is only one page', () => {
    const { container } = render(
      <PageSelector currentPage={1} pageCount={1} onPageChange={() => {}} maxSize={5} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders page buttons and changes page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PageSelector
        currentPage={1}
        pageCount={5}
        onPageChange={onPageChange}
        maxSize={5}
        directionLinks
      />
    );
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
