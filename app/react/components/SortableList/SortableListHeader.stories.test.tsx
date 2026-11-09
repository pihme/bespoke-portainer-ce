import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  Interactive,
  WithActionButton,
  WithGroupFilter,
} from './SortableListHeader.stories';

vi.mock('@reach/menu-button');

describe('SortableListHeader.stories (backwards compatibility)', () => {
  it('Interactive toggles sort direction on the active option', async () => {
    const user = userEvent.setup();
    render(<Interactive />);

    const nameBtn = screen.getByRole('button', { name: /^Name/i });
    expect(nameBtn).toHaveTextContent('Asc');
    await user.click(nameBtn);
    expect(screen.getByRole('button', { name: /^Name/i })).toHaveTextContent(
      'Desc'
    );
  });

  it('WithGroupFilter shows the active group badge', () => {
    render(<WithGroupFilter />);
    expect(screen.getByRole('button', { name: /Group/i })).toHaveTextContent(
      'Production'
    );
  });

  it('WithActionButton renders the action control', () => {
    render(<WithActionButton />);
    expect(
      screen.getByRole('button', { name: /Add environment/i })
    ).toBeInTheDocument();
  });
});
