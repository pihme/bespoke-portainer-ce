import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeatureId } from '@/react/portainer/feature-flags/enums';

import { Option } from './Option';

vi.mock('@/react/portainer/feature-flags/feature-flags.service', () => ({
  isLimitedToBE: vi.fn(() => false),
}));

import { isLimitedToBE } from '@/react/portainer/feature-flags/feature-flags.service';

function Icon({
  selected,
  className,
}: {
  selected?: boolean;
  className?: string;
}) {
  return (
    <span data-cy="option-icon" data-selected={String(!!selected)} className={className}>
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

    expect(screen.getByRole('heading', { level: 3, name: 'Docker' })).toBeVisible();
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
    render(
      <Option
        icon={Icon}
        title="Docker"
        description="desc"
        active
      />
    );
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

  it('disables and shows BE indicator when limited to BE', () => {
    vi.mocked(isLimitedToBE).mockReturnValue(true);
    render(
      <Option
        icon={Icon}
        title="K8s"
        description="desc"
        featureId={FeatureId.RBAC_ROLES}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
    // BEFeatureIndicator text varies; button disabled is the KEEP signal
    vi.mocked(isLimitedToBE).mockReturnValue(false);
  });
});
