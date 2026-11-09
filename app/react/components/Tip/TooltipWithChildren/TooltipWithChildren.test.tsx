import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeatureId } from '@/react/portainer/feature-flags/enums';

import { TooltipWithChildren } from './TooltipWithChildren';

vi.mock('@@/BEFeatureIndicator/utils', () => ({
  getFeatureDetails: vi.fn(() => ({
    url: 'https://example.com/be',
    limitedToBE: false,
  })),
}));

import { getFeatureDetails } from '@@/BEFeatureIndicator/utils';

describe('TooltipWithChildren', () => {
  it('wraps children and shows the message on hover', async () => {
    const user = userEvent.setup();
    render(
      <TooltipWithChildren message="Helpful tip" heading="Title">
        <span>trigger</span>
      </TooltipWithChildren>
    );

    await user.hover(screen.getByText('trigger'));
    expect(await screen.findByText('Helpful tip')).toBeVisible();
    expect(screen.getByText('Title')).toBeVisible();
  });

  it('renders children in a focusable button when focusable is set', () => {
    render(
      <TooltipWithChildren message="tip" focusable>
        <span>focus me</span>
      </TooltipWithChildren>
    );
    expect(screen.getByRole('button')).toContainElement(
      screen.getByText('focus me')
    );
  });

  it('stops click propagation from the tooltip content', async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick} onKeyDown={() => {}}>
        <TooltipWithChildren message="inner">
          <span>hover</span>
        </TooltipWithChildren>
      </div>
    );
    await user.hover(screen.getByText('hover'));
    const tip = await screen.findByText('inner');
    await user.click(tip);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('shows Business Feature teaser when limited to BE', async () => {
    vi.mocked(getFeatureDetails).mockReturnValue({
      url: 'https://example.com/be',
      limitedToBE: true,
    });
    const user = userEvent.setup();
    render(
      <TooltipWithChildren
        message="be tip"
        BEFeatureID={FeatureId.RBAC_ROLES}
      >
        <span>be</span>
      </TooltipWithChildren>
    );
    await user.hover(screen.getByText('be'));
    expect(await screen.findByText('Business Feature')).toBeVisible();
    vi.mocked(getFeatureDetails).mockReturnValue({
      url: 'https://example.com/be',
      limitedToBE: false,
    });
  });
});
