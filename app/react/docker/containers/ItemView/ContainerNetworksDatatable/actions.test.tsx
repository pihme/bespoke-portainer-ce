import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mutateDisconnect = vi.fn();
vi.mock('@/react/docker/networks/queries/useDisconnectContainerMutation', () => ({
  useDisconnectContainer: () => ({
    mutate: mutateDisconnect,
    isLoading: false,
  }),
}));

const notifySuccess = vi.fn();
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

import { buildActions } from './actions';

describe('container network leave action', () => {
  beforeEach(() => {
    mutateDisconnect.mockReset();
    notifySuccess.mockReset();
  });

  it('disconnects the container from the network', async () => {
    const user = userEvent.setup();
    const column = buildActions({ nodeName: 'n1' });
    const Cell = column.cell as Function;
    render(
      Cell({
        row: { original: { id: 'bridge', name: 'bridge' } },
        table: {
          options: {
            meta: { table: 'container-networks', containerId: 'c1' },
          },
        },
      })
    );
    await user.click(screen.getByRole('button', { name: /Leave network/i }));
    expect(mutateDisconnect).toHaveBeenCalledWith(
      { containerId: 'c1', nodeName: 'n1' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    const onSuccess = mutateDisconnect.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(notifySuccess).toHaveBeenCalled();
  });
});
