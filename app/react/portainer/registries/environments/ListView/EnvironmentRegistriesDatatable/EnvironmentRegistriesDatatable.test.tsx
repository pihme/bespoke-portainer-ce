import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';

import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import {
  createMockEnvironment,
  createMockUsers,
} from '@/react-tools/test-mocks';
import { server, http } from '@/setup-tests/server';
import { Role } from '@/portainer/users/types';
import { RegistryTypes } from '@/react/portainer/registries/types/registry';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { EnvironmentRegistriesDatatable } from './EnvironmentRegistriesDatatable';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

// the manage access link is relative ('.access'), which the test router can't resolve
vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href=".">{children}</a>
  ),
}));

const mockRegistry = {
  Id: 2,
  Name: 'my-registry',
  Type: RegistryTypes.CUSTOM,
  URL: 'registry.example.com',
  Authentication: false,
};

beforeEach(() => {
  server.use(
    http.get('/api/endpoints/1', () =>
      HttpResponse.json(
        createMockEnvironment({ Id: 1, Type: EnvironmentType.KubernetesLocal })
      )
    ),
    http.get('/api/endpoints/1/registries', () =>
      HttpResponse.json([mockRegistry])
    )
  );
});

function createTestComponent(role: Role) {
  return withTestRouter(
    withUserProvider(
      withTestQueryProvider(EnvironmentRegistriesDatatable),
      createMockUsers(1, role)[0]
    ),
    {
      route: '/docker/registries',
      stateConfig: [
        {
          name: 'docker.host.registries',
          url: '/docker/registries',
          params: { endpointId: '1' },
        },
      ],
    }
  );
}

describe('EnvironmentRegistriesDatatable', () => {
  it('REQ-TAI-002 offers no Kubernetes namespace "Manage access"', async () => {
    const TestComponent = createTestComponent(Role.Admin);
    render(<TestComponent />);

    expect(await screen.findByText('my-registry')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Manage access')).not.toBeInTheDocument();
    });
  });

  it('REQ-TAI-001 offers no per-user registry access on a Docker environment', async () => {
    server.use(
      http.get('/api/endpoints/1', () =>
        HttpResponse.json(
          createMockEnvironment({ Id: 1, Type: EnvironmentType.Docker })
        )
      )
    );
    const TestComponent = createTestComponent(Role.Admin);
    render(<TestComponent />);

    expect(await screen.findByText('my-registry')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Manage access')).not.toBeInTheDocument();
    });
  });
});
