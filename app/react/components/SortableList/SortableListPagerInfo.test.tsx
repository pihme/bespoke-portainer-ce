import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SortableListPagerInfo } from './SortableListPagerInfo';

describe('SortableListPagerInfo (backwards compatibility)', () => {
  it('renders nothing when totalCount is zero', () => {
    const { container } = render(
      <SortableListPagerInfo
        page={0}
        pageSize={10}
        totalCount={0}
        onPageSizeChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the visible range for the current page', () => {
    render(
      <SortableListPagerInfo
        page={1}
        pageSize={10}
        totalCount={25}
        onPageSizeChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent('11–20');
    expect(screen.getByText(/of/)).toHaveTextContent('25');
  });

  it('clamps the end index on the last partial page', () => {
    render(
      <SortableListPagerInfo
        page={2}
        pageSize={10}
        totalCount={25}
        onPageSizeChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent('21–25');
  });

  it('changing page size calls onPageSizeChange and resets to page 0', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    const onPageChange = vi.fn();

    render(
      <SortableListPagerInfo
        page={2}
        pageSize={10}
        totalCount={100}
        onPageSizeChange={onPageSizeChange}
        onPageChange={onPageChange}
      />
    );

    await user.selectOptions(screen.getByRole('combobox'), '25');

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
    expect(onPageChange).toHaveBeenCalledWith(0);
  });
});
