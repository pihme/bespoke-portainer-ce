import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActionBarButton } from './ActionBarButton';

describe('ActionBarButton', () => {
  it('renders children and forwards a click handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <ActionBarButton data-cy="action-bar-btn" onClick={onClick}>
        Add environment
      </ActionBarButton>
    );

    expect(screen.getByText('Add environment')).toBeVisible();
    await user.click(screen.getByTestId('action-bar-btn'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom className and color', () => {
    render(
      <ActionBarButton
        data-cy="action-bar-btn"
        className="extra-class"
        color="primary"
      >
        Save
      </ActionBarButton>
    );

    const btn = screen.getByTestId('action-bar-btn');
    expect(btn).toHaveClass('extra-class');
    expect(btn).toBeVisible();
  });
});
