import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SortableListPagerNav } from './SortableListPagerNav';

describe('SortableListPagerNav (backwards compatibility)', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <SortableListPagerNav
        safePage={0}
        totalPages={1}
        onPageChange={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('lists every page when totalPages is at most 7', () => {
    render(
      <SortableListPagerNav
        safePage={2}
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('shows leading and trailing ellipses when the current page is in the middle', () => {
    render(
      <SortableListPagerNav
        safePage={5}
        totalPages={12}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '6' })).toHaveClass(
      'border-blue-7'
    );
  });

  it('shows only a trailing ellipsis near the start', () => {
    render(
      <SortableListPagerNav
        safePage={1}
        totalPages={12}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('…')).toHaveLength(1);
  });

  it('shows only a leading ellipsis near the end', () => {
    render(
      <SortableListPagerNav
        safePage={10}
        totalPages={12}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('…')).toHaveLength(1);
  });

  it('disables first/previous on page 0 and calls onPageChange for next/last', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <SortableListPagerNav
        safePage={0}
        totalPages={4}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByTitle('First page')).toBeDisabled();
    expect(screen.getByTitle('Previous page')).toBeDisabled();

    await user.click(screen.getByTitle('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByTitle('Last page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables next/last on the last page and navigates first/previous', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <SortableListPagerNav
        safePage={3}
        totalPages={4}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByTitle('Next page')).toBeDisabled();
    expect(screen.getByTitle('Last page')).toBeDisabled();

    await user.click(screen.getByTitle('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByTitle('First page'));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('clicking a page number button selects that zero-based page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <SortableListPagerNav
        safePage={0}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '4' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
