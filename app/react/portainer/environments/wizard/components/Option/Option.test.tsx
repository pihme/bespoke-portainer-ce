import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Option } from './Option';

function Icon({
  selected,
  className,
}: {
  selected?: boolean;
  className?: string;
}) {
  return (
    <span
      data-cy="option-icon"
      data-selected={String(!!selected)}
      className={className}
    >
      icon
    </span>
  );
}

describe('Option', () => {
  it('renders title, description and icon and calls onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Option
        icon={Icon}
        title="Docker"
        description="Connect a Docker environment"
        onClick={onClick}
      />
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Docker' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        level: 5,
        name: 'Connect a Docker environment',
      })
    ).toBeVisible();
    expect(screen.getByTestId('option-icon')).toHaveAttribute(
      'data-selected',
      'false'
    );

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the icon selected when active', () => {
    render(<Option icon={Icon} title="Docker" description="desc" active />);
    expect(screen.getByTestId('option-icon')).toHaveAttribute(
      'data-selected',
      'true'
    );
  });

  it('uses a no-op onClick by default', async () => {
    const user = userEvent.setup();
    render(<Option icon={Icon} title="X" description="Y" />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('REQ-TAI-018 is never shown as a disabled Business Edition teaser', () => {
    render(<Option icon={Icon} title="K8s" description="desc" />);
    expect(screen.getByRole('button')).toBeEnabled();
    expect(screen.queryByText(/business/i)).not.toBeInTheDocument();
  });
});
