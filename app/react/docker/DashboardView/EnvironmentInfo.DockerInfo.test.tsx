import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { ContainerEngine } from '@/react/portainer/environments/types';
import { createMockEnvironment } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { DockerInfo } from './EnvironmentInfo.DockerInfo';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

function renderDockerInfo(isAgent = false) {
  const Wrapped = withTestQueryProvider(() => (
    <DockerInfo isAgent={isAgent} />
  ));
  return render(<Wrapped />);
}

describe('EnvironmentInfo.DockerInfo', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/endpoints/1', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            ContainerEngine: ContainerEngine.Docker,
          })
        )
      ),
      http.get('/api/endpoints/1/docker/info', () =>
        HttpResponse.json({
          ServerVersion: '24.0.7',
          Swarm: { NodeID: '' },
        })
      )
    );
  });

  it('renders nothing while docker info is loading', () => {
    server.use(
      http.get(
        '/api/endpoints/1/docker/info',
        () => new Promise(() => undefined) as never
      )
    );

    const { container } = renderDockerInfo();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Standalone and the server version for a local Docker engine', async () => {
    renderDockerInfo(false);

    await waitFor(() => {
      expect(screen.getByText(/Standalone 24.0.7/)).toBeVisible();
    });
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
  });

  it('shows the Agent badge when isAgent is true', async () => {
    renderDockerInfo(true);

    await waitFor(() => {
      expect(screen.getByText(/Standalone 24.0.7/)).toBeVisible();
    });
    expect(screen.getByText('Agent')).toBeVisible();
  });

  it('REQ-TAI-003 shows a Swarm member as Standalone', async () => {
    server.use(
      http.get('/api/endpoints/1/docker/info', () =>
        HttpResponse.json({
          ServerVersion: '24.0.7',
          Swarm: { NodeID: 'node-1' },
        })
      )
    );

    renderDockerInfo(false);

    await waitFor(() => {
      expect(screen.getByText(/Standalone 24.0.7/)).toBeVisible();
    });
  });

  it('shows Podman when the environment uses the Podman engine', async () => {
    server.use(
      http.get('/api/endpoints/1', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 1,
            ContainerEngine: ContainerEngine.Podman,
          })
        )
      )
    );

    renderDockerInfo(false);

    await waitFor(() => {
      expect(screen.getByText(/Podman 24.0.7/)).toBeVisible();
    });
  });
});
