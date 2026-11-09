import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';

import { ItemView } from './ItemView';

const mockGo = vi.fn();
vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({
    params: { id: 'net1', nodeName: undefined },
  }),
  useRouter: () => ({ stateService: { go: mockGo } }),
  useSref: () => ({ href: '#', onClick: vi.fn() }),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@@/Link', () => ({
  Link: ({ children, 'data-cy': dataCy }: { children: React.ReactNode; 'data-cy'?: string }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy}>{children}</a>
  ),
}));

vi.mock('@/react/portainer/access-control/AccessControlPanel/AccessControlPanel', () => ({
  AccessControlPanel: () => <div data-cy="access-control-panel" />,
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

function networkPayload() {
  return {
    Id: 'net1',
    Name: 'bridge',
    Driver: 'bridge',
    Scope: 'local',
    Options: { 'com.docker.network.bridge.name': 'docker0' },
    Containers: {
      ctr1: { Name: 'web', EndpointID: 'e1', IPv4Address: '172.17.0.2/16', MacAddress: 'aa' },
    },
    IPAM: { Config: [{ Subnet: '172.17.0.0/16' }] },
  };
}

describe('REQ-NET-03 Network ItemView', () => {
  beforeEach(() => {
    mockGo.mockClear();
    server.use(
      http.get('/api/endpoints/1/docker/networks/net1', () =>
        HttpResponse.json(networkPayload())
      ),
      http.get('/api/endpoints/1/docker/containers/json', () =>
        HttpResponse.json([
          {
            Id: 'ctr1',
            Names: ['/web'],
            Image: 'nginx',
            ImageID: 'sha',
            Command: 'x',
            Created: 1,
            Ports: [],
            Labels: {},
            State: 'running',
            Status: 'Up',
            HostConfig: {},
            NetworkSettings: { Networks: { bridge: {} } },
            Mounts: [],
          },
        ])
      ),
      http.delete('/api/endpoints/1/docker/networks/net1', () =>
        new HttpResponse(null, { status: 204 })
      )
    );
  });

  it('renders local network details options and containers', async () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(withTestRouter(ItemView), createMockUser({ Role: Role.Admin }))
    );
    render(<Wrapped />);
    expect((await screen.findAllByText('Network details')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('bridge').length).toBeGreaterThan(0);
    expect(screen.getByTestId('access-control-panel')).toBeVisible();
  });
});
