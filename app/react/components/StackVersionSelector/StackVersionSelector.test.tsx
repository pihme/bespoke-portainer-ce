import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StackVersionSelector } from './StackVersionSelector';

describe('StackVersionSelector', () => {
  it('renders nothing when versions are missing or empty', () => {
    const { container: empty } = render(
      <StackVersionSelector onChange={vi.fn()} />
    );
    expect(empty).toBeEmptyDOMElement();

    const { container: zero } = render(
      <StackVersionSelector versions={[]} onChange={vi.fn()} />
    );
    expect(zero).toBeEmptyDOMElement();
  });

  it('shows a single version as plain text without a select', () => {
    render(<StackVersionSelector versions={[3]} onChange={vi.fn()} />);
    expect(screen.getByText('Version:')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders a select and notifies onChange for multiple versions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StackVersionSelector versions={[1, 2, 3]} onChange={onChange} />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeVisible();
    await user.selectOptions(select, '2');
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
