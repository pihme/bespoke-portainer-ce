import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { confirmContainerDeletion } from './confirm-container-delete-modal';

describe('confirmContainerDeletion', () => {
  it('resolves with removeVolumes when confirmed', async () => {
    const user = userEvent.setup();
    const pending = confirmContainerDeletion('Remove container');

    expect(await screen.findByText('Remove container')).toBeVisible();
    await user.click(screen.getByTestId('modal-confirm-button'));
    await expect(pending).resolves.toEqual({ removeVolumes: false });
    await waitFor(() =>
      expect(document.querySelector('[id^="dialog-"]')).toBeNull()
    );
  });

  it('resolves undefined when cancelled', async () => {
    const user = userEvent.setup();
    const pending = confirmContainerDeletion('Cancel delete');

    expect(await screen.findByText('Cancel delete')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await expect(pending).resolves.toBeUndefined();
  });
});
