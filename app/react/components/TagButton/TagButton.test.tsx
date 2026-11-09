import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TagButton } from './TagButton';

describe('TagButton', () => {
  it('renders the label and calls onRemove when clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <TagButton
        value={7}
        label="production"
        title="Remove production"
        onRemove={onRemove}
      />
    );

    const button = screen.getByRole('button', { name: /production/i });
    expect(button).toHaveAttribute('title', 'Remove production');
    await user.click(button);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
