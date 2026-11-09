import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  const items = [
    { id: 'simple', label: 'Simple' },
    { id: 'advanced', label: 'Advanced', title: 'Advanced mode' },
    { id: 'off', label: 'Off', disabled: true },
  ];

  it('renders items and marks the active one', () => {
    render(
      <SegmentedControl
        label="Mode"
        items={items}
        activeId="simple"
        onChange={() => {}}
      />
    );
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Simple' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Advanced mode' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Off' })).toBeDisabled();
  });

  it('calls onChange when selecting another item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Mode"
        items={items}
        activeId="simple"
        onChange={onChange}
        size="sm"
        variant="pill"
      />
    );
    await user.click(screen.getByRole('radio', { name: 'Advanced mode' }));
    expect(onChange).toHaveBeenCalledWith('advanced');
  });
});
