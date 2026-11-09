import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { confirmStackUpdate } from './confirm-stack-update';

describe('confirmStackUpdate', () => {
  it('resolves with repullImageAndRedeploy when confirmed', async () => {
    const user = userEvent.setup();
    const pending = confirmStackUpdate('Update this stack?', true);

    expect(await screen.findByText('Are you sure?')).toBeVisible();
    expect(screen.getByText('Update this stack?')).toBeVisible();
    await user.click(screen.getByTestId('modal-confirm-button'));
    await expect(pending).resolves.toEqual({ repullImageAndRedeploy: true });
    await waitFor(() =>
      expect(document.querySelector('[id^="dialog-"]')).toBeNull()
    );
  });

  it('resolves undefined when cancelled', async () => {
    const user = userEvent.setup();
    const pending = confirmStackUpdate('Cancel me', false);

    expect(await screen.findByText('Are you sure?')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await expect(pending).resolves.toBeUndefined();
  });
});
