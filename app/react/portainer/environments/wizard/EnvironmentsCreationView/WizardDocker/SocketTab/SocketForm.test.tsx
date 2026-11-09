import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import { ContainerEngine } from '@/react/portainer/environments/types';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

const mutate = vi.fn();

vi.mock(
  '@/react/portainer/environments/queries/useCreateEnvironmentMutation',
  () => ({
    useCreateLocalDockerEnvironmentMutation: () => ({
      mutate,
      isLoading: false,
    }),
  })
);

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('../../shared/MoreSettingsSection', () => ({
  MoreSettingsSection: () => <div data-cy="more-settings">more</div>,
}));

import { SocketForm } from './SocketForm';

describe('SocketForm', () => {
  it('submits a local Docker socket environment', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const env = createMockEnvironment({ Name: 'local-docker' });
    mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(env);
    });

    server.use(
      http.get('/api/endpoints', () =>
        HttpResponse.json([], {
          headers: { 'x-total-available': '0', 'x-total-count': '0' },
        })
      )
    );

    const Wrapped = withTestQueryProvider(() => (
      <SocketForm onCreate={onCreate} containerEngine={ContainerEngine.Docker} />
    ));
    render(<Wrapped />);

    await user.type(
      screen.getByTestId('environmentCreate-nameInput'),
      'local-docker'
    );
    const connect = screen.getByTestId('docker-socket-connect-button');
    await waitFor(() => expect(connect).not.toBeDisabled());
    await user.click(connect);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'local-docker',
          socketPath: '',
          containerEngine: ContainerEngine.Docker,
        }),
        expect.any(Object)
      );
      expect(onCreate).toHaveBeenCalledWith(env);
    });
  });

  it('sends an overridden socket path when enabled', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(createMockEnvironment({ Name: 'sock' }));
    });
    server.use(
      http.get('/api/endpoints', () =>
        HttpResponse.json([], {
          headers: { 'x-total-available': '0', 'x-total-count': '0' },
        })
      )
    );

    const Wrapped = withTestQueryProvider(() => (
      <SocketForm onCreate={() => {}} containerEngine={ContainerEngine.Docker} />
    ));
    render(<Wrapped />);

    await user.type(screen.getByTestId('environmentCreate-nameInput'), 'sock');
    await user.click(
      screen.getByTestId('create-docker-env-socket-override-switch')
    );
    await user.type(
      screen.getByPlaceholderText(/docker\.sock/),
      '/custom/docker.sock'
    );
    const connect = screen.getByTestId('docker-socket-connect-button');
    await waitFor(() => expect(connect).not.toBeDisabled());
    await user.click(connect);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          socketPath: '/custom/docker.sock',
        }),
        expect.any(Object)
      );
    });
  });
});
