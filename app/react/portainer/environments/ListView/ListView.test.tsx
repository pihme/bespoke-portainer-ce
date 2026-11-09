import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnvironmentStatus } from '@/react/portainer/environments/types';

import { ListView } from './ListView';

const mutate = vi.fn();
const confirmDelete = vi.fn();
const notifySuccess = vi.fn();
const clear = vi.fn();
let currentId = 1;

vi.mock('zustand', () => ({
  useStore: () => ({
    get environmentId() {
      return currentId;
    },
    clear: (...args: unknown[]) => clear(...args),
  }),
}));
vi.mock('@/react/hooks/current-environment-store', () => ({
  environmentStore: {},
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));
vi.mock('@@/modals/confirm', () => ({
  confirmDelete: (...args: unknown[]) => confirmDelete(...args),
}));
vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('./useDeleteEnvironmentsMutation', () => ({
  useDeleteEnvironmentsMutation: () => ({ mutate }),
}));
vi.mock('./EnvironmentsDatatable', () => ({
  EnvironmentsDatatable: ({
    onRemove,
  }: {
    onRemove: (envs: Array<{ Id: number; Name: string }>) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onRemove([
          { Id: 1, Name: 'local' },
          { Id: 2, Name: 'other' },
        ])
      }
    >
      Remove selected
    </button>
  ),
}));

describe('REQ-ENV-03 ListView for local Docker environments', () => {
  beforeEach(() => {
    mutate.mockReset();
    confirmDelete.mockReset();
    notifySuccess.mockReset();
    clear.mockReset();
    currentId = 1;
  });

  it('renders the environments page', () => {
    render(<ListView />);
    expect(screen.getByText('Environments')).toBeVisible();
  });

  it('cancels removal when confirmation is declined', async () => {
    const user = userEvent.setup();
    confirmDelete.mockResolvedValue(false);
    render(<ListView />);
    await user.click(screen.getByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(confirmDelete).toHaveBeenCalled());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('clears the current environment store and deletes confirmed rows', async () => {
    const user = userEvent.setup();
    confirmDelete.mockResolvedValue(true);
    mutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());

    render(<ListView />);
    await user.click(screen.getByRole('button', { name: 'Remove selected' }));

    await waitFor(() => {
      expect(clear).toHaveBeenCalled();
      expect(mutate).toHaveBeenCalledWith(
        [
          { id: 1, deleteCluster: false, name: 'local' },
          { id: 2, deleteCluster: false, name: 'other' },
        ],
        expect.any(Object)
      );
      expect(notifySuccess).toHaveBeenCalledWith(
        'Environments successfully removed',
        'local, other'
      );
    });
  });

  it('does not clear the store when the current environment is not deleted', async () => {
    const user = userEvent.setup();
    currentId = 99;
    confirmDelete.mockResolvedValue(true);
    render(<ListView />);
    await user.click(screen.getByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(clear).not.toHaveBeenCalled();
  });
});
