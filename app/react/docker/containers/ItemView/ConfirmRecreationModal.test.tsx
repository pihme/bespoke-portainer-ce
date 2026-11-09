import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { confirmContainerRecreation } from './ConfirmRecreationModal';

const openModalMock = vi.hoisted(() => vi.fn());

vi.mock('@@/modals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@@/modals')>();
  return {
    ...actual,
    openModal: openModalMock,
  };
});

describe('confirmContainerRecreation', () => {
  it('opens the recreation modal and submits pullLatest', async () => {
    const user = userEvent.setup();
    openModalMock.mockImplementation(async (Component, props) => {
      const onSubmit = vi.fn();
      render(<Component {...props} onSubmit={onSubmit} />);
      expect(
        screen.getByLabelText(/confirm recreate container modal/i)
      ).toBeVisible();
      await user.click(screen.getByTestId('recreate-pull-latest-switch'));
      await user.click(screen.getByTestId('confirm-recreate'));
      expect(onSubmit).toHaveBeenCalledWith({ pullLatest: true });
      return { pullLatest: true };
    });

    await confirmContainerRecreation(false);
    expect(openModalMock).toHaveBeenCalled();
  });

  it('shows cannot-pull tip and allows cancel', async () => {
    const user = userEvent.setup();
    openModalMock.mockImplementation(async (Component, props) => {
      const onSubmit = vi.fn();
      render(<Component {...props} onSubmit={onSubmit} />);
      expect(
        screen.getByText(/Cannot re-pull as the image is inaccessible/i)
      ).toBeVisible();
      await user.click(screen.getByTestId('cancel-recreate'));
      expect(onSubmit).toHaveBeenCalledWith();
      return undefined;
    });

    await confirmContainerRecreation(true);
  });
});

  it('dismisses via modal close button onDismiss', async () => {
    const user = userEvent.setup();
    openModalMock.mockImplementation(async (Component, props) => {
      const onSubmit = vi.fn();
      render(<Component {...props} onSubmit={onSubmit} />);
      await user.click(document.querySelector('button.close-button') as HTMLElement);
      expect(onSubmit).toHaveBeenCalledWith();
      return undefined;
    });
    await confirmContainerRecreation(false);
  });
