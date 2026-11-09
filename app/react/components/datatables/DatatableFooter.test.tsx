import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatatableFooter } from './DatatableFooter';

describe('DatatableFooter (backwards compatibility)', () => {
  it('shows the selected-rows count including hidden selections', () => {
    render(
      <DatatableFooter
        totalSelected={3}
        totalHiddenSelected={1}
        pageSize={10}
        page={0}
        pageCount={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(
      screen.getByText('3 items selected (1 hidden by filters)')
    ).toBeInTheDocument();
  });

  it('forwards page and page-size changes through PaginationControls', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <DatatableFooter
        totalSelected={0}
        totalHiddenSelected={0}
        pageSize={10}
        page={0}
        pageCount={3}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '›' }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.selectOptions(screen.getByLabelText(/Items per page/i), '25');
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
