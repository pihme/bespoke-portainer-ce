import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { PaginationControls } from './PaginationControls';

vi.mock('./PageSelector', () => ({
  PageSelector: ({
    onPageChange,
    currentPage,
  }: {
    onPageChange: (p: number) => void;
    currentPage: number;
  }) => (
    <button type="button" onClick={() => onPageChange(currentPage + 1)}>
      page-{currentPage}
    </button>
  ),
}));
vi.mock('./ItemsPerPageSelector', () => ({
  ItemsPerPageSelector: ({
    onChange,
    value,
  }: {
    onChange: (n: number) => void;
    value: number;
  }) => (
    <button type="button" onClick={() => onChange(value + 10)}>
      per-{value}
    </button>
  ),
}));

describe('PaginationControls', () => {
  it('renders page and page-size selectors and forwards changes', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageLimitChange = vi.fn();
    render(
      <PaginationControls
        page={2}
        onPageChange={onPageChange}
        pageLimit={10}
        onPageLimitChange={onPageLimitChange}
        pageCount={5}
      />
    );
    await user.click(screen.getByText('page-2'));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByText('per-10'));
    expect(onPageLimitChange).toHaveBeenCalledWith(20);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
