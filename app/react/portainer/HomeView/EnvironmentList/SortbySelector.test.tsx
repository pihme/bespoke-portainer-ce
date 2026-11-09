import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { SortbySelector } from './SortbySelector';

describe('SortbySelector (backwards compatibility)', () => {
  it('notifies when a sort option is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SortbySelector
        placeHolder="Sort by"
        onChange={onChange}
        onDescending={vi.fn()}
        sortByDescending={false}
        sortByButton={false}
      />
    );

    await user.click(screen.getByText('Sort by'));
    await user.click(await screen.findByText('Name'));
    expect(onChange).toHaveBeenCalledWith('Name');
  });

  it('enables descending toggle when a sort is active', async () => {
    const user = userEvent.setup();
    const onDescending = vi.fn();
    render(
      <SortbySelector
        placeHolder="Sort by"
        onChange={vi.fn()}
        onDescending={onDescending}
        sortByDescending={false}
        sortByButton
        value="Name"
      />
    );

    const buttons = screen.getAllByRole('button');
    const sortButton = buttons.find((b) => !b.hasAttribute('disabled') || b.getAttribute('disabled') === null);
    // the descending toggle button should not be disabled when sorted
    const descButton = buttons.find((b) => b.querySelector('svg'));
    expect(descButton).toBeTruthy();
    if (descButton) {
      expect(descButton).not.toBeDisabled();
      await user.click(descButton);
      expect(onDescending).toHaveBeenCalled();
    }
  });

  it('disables descending toggle when no sort is active', () => {
    render(
      <SortbySelector
        placeHolder="Sort by"
        onChange={vi.fn()}
        onDescending={vi.fn()}
        sortByDescending={false}
        sortByButton={false}
      />
    );

    const buttons = screen.getAllByRole('button');
    const descButton = buttons.find((b) => b.querySelector('svg'));
    expect(descButton).toBeDisabled();
  });
});
