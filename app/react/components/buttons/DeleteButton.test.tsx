import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DeleteButton } from './DeleteButton';

const confirmDelete = vi.hoisted(() => vi.fn());

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: (...args: unknown[]) => confirmDelete(...args),
}));

describe('DeleteButton', () => {
  beforeEach(() => {
    confirmDelete.mockReset();
  });

  test('renders a plain button and calls onClick without confirmation', async () => {
    const onClick = vi.fn();
    render(
      <DeleteButton data-cy="delete-btn" onClick={onClick}>
        Wipe
      </DeleteButton>
    );

    const button = await screen.findByRole('button', { name: 'Wipe' });
    expect(button).toHaveClass('btn-dangerlight');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(confirmDelete).not.toHaveBeenCalled();
  });

  test('uses default Remove label and icon class when icon is true', async () => {
    const onClick = vi.fn();
    render(
      <DeleteButton data-cy="delete-btn" onClick={onClick} icon />
    );

    const button = await screen.findByRole('button', { name: 'Remove' });
    expect(button).toHaveClass('btn-icon');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  test('asks for confirmation then runs onConfirmed', async () => {
    const onConfirmed = vi.fn();
    confirmDelete.mockResolvedValue(true);

    render(
      <DeleteButton
        data-cy="delete-btn"
        confirmMessage="Really delete?"
        onConfirmed={onConfirmed}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(confirmDelete).toHaveBeenCalledWith('Really delete?');
      expect(onConfirmed).toHaveBeenCalledTimes(1);
    });
  });

  test('skips onConfirmed when confirmation is cancelled', async () => {
    const onConfirmed = vi.fn();
    confirmDelete.mockResolvedValue(false);

    render(
      <DeleteButton
        data-cy="delete-btn"
        confirmMessage="Cancel me"
        onConfirmed={onConfirmed}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(confirmDelete).toHaveBeenCalled();
    });
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  test('renders LoadingButton when isLoading is provided', async () => {
    render(
      <DeleteButton
        data-cy="delete-btn"
        isLoading
        loadingText="Removing..."
        onClick={() => {}}
      />
    );

    expect(await screen.findByText('Removing...')).toBeVisible();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  test('LoadingButton path shows children when not loading', async () => {
    const onClick = vi.fn();
    render(
      <DeleteButton data-cy="delete-btn" isLoading={false} onClick={onClick}>
        Drop it
      </DeleteButton>
    );

    const button = await screen.findByRole('button', { name: 'Drop it' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});
