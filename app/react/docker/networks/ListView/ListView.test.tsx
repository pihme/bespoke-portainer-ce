import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { server } from '@/setup-tests/server';
import { Role } from '@/portainer/users/types';
import {
  createMockEnvironment,
  createMockUsers,
} from '@/react-tools/test-mocks';

import { ListView } from './ListView';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: vi.fn(() => ({
    params: { endpointId: '1' },
  })),
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy}>{children}</a>
  ),
}));

function localNetwork(overrides: Record<string, unknown> = {}) {
  return {
    Id: 'net-bridge',
    Name: 'bridge',
    Scope: 'local',
    Driver: 'bridge',
    Attachable: false,
    IPAM: {
      Driver: 'default',
      Config: [{ Subnet: '172.17.0.0/16', Gateway: '172.17.0.1' }],
    },
    Containers: {},
    Options: {},
    Labels: {},
    ...overrides,
  };
}

function renderList() {
  const user = createMockUsers(1, Role.Admin)[0];
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ListView), user)
  );
  return render(<Wrapped />);
}

describe('REQ-NET-01 Networks ListView for local Docker', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/endpoints/1', () =>
        HttpResponse.json(
          createMockEnvironment({ Id: 1, Name: 'local', Type: 1 })
        )
      ),
      http.get('/api/endpoints/:id/docker/networks', () =>
        HttpResponse.json([
          localNetwork(),
          localNetwork({
            Id: 'net-custom',
            Name: 'custom-net',
            Labels: { 'com.docker.compose.project': 'demo' },
          }),
        ])
      )
    );
  });

  it('renders the network list heading and local network rows', async () => {
    renderList();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Network List/i })
      ).toBeVisible();
    });
    await waitFor(() => {
      expect(document.querySelector('[data-cy="network-link-bridge"]')).toBeTruthy();
    });
    expect(
      document.querySelector('[data-cy="network-link-custom-net"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-cy="network-addNetworkButton"]')
    ).toBeTruthy();
  });

  it('REQ-TAI-003 lists no Swarm-scoped networks', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/networks', () =>
        HttpResponse.json([
          localNetwork(),
          localNetwork({
            Id: 'net-ingress',
            Name: 'ingress',
            Scope: 'swarm',
            Driver: 'overlay',
          }),
        ])
      )
    );
    renderList();
    await waitFor(() => {
      expect(
        document.querySelector('[data-cy="network-link-bridge"]')
      ).toBeTruthy();
    });
    expect(
      document.querySelector('[data-cy="network-link-ingress"]')
    ).toBeNull();
  });
});
