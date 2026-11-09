import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ItemsPerPageSelector } from './ItemsPerPageSelector';

describe('ItemsPerPageSelector', () => {
  it('changes the page size', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ItemsPerPageSelector value={10} onChange={onChange} />);
    await user.selectOptions(screen.getByTestId('paginationSelect'), '25');
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it('can show an All option', () => {
    render(
      <ItemsPerPageSelector value={10} onChange={() => {}} showAll />
    );
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
  });
});
