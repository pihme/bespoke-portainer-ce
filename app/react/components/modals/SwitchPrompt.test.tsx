import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { openSwitchPrompt } from './SwitchPrompt';

describe('openSwitchPrompt', () => {
  it('opens a switch prompt and resolves with the switch value', async () => {
    const user = userEvent.setup();
    const pending = openSwitchPrompt('Enable feature', 'Feature flag', {
      'data-cy': 'switch-prompt',
      message: 'Toggle me',
    });

    expect(await screen.findByText('Enable feature')).toBeVisible();
    expect(screen.getByText('Toggle me')).toBeVisible();
    await user.click(screen.getByTestId('modal-confirm-button'));
    await expect(pending).resolves.toEqual({ value: false });
    await waitFor(() =>
      expect(document.querySelector('[id^="dialog-"]')).toBeNull()
    );
  });
});
