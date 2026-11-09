import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { TagsDatatable } from './TagsDatatable';

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: vi.fn().mockResolvedValue(true),
}));

describe('TagsDatatable', () => {
  it('renders tags and removes selected rows', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const Wrapped = withTestQueryProvider(() => (
      <TagsDatatable
        dataset={[
          { ID: 1, Name: 'prod', Endpoints: {} },
          { ID: 2, Name: 'dev', Endpoints: {} },
        ]}
        onRemove={onRemove}
      />
    ));
    render(<Wrapped />);
    expect(await screen.findByText('Tags')).toBeVisible();
    expect(screen.getByText('prod')).toBeVisible();

    const checkboxes = screen.getAllByRole('checkbox');
    // first is select-all; pick a row checkbox
    await user.click(checkboxes[1]);
    await user.click(screen.getByTestId('remove-tag-button'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows loading state when dataset is undefined', () => {
    const Wrapped = withTestQueryProvider(() => (
      <TagsDatatable dataset={undefined} onRemove={vi.fn()} />
    ));
    render(<Wrapped />);
    expect(screen.getByTestId('tags-datatable')).toBeInTheDocument();
  });
});
