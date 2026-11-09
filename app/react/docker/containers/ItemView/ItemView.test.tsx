import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { createMockContainer, createMockUser } from '@/react-tools/test-mocks';
import { server } from '@/setup-tests/server';
import { User } from '@/portainer/users/types';
import { ContainerDetailsViewModel } from '@/docker/models/containerDetails';

import { ItemView } from './ItemView';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: vi.fn(() => ({
    params: { id: 'container-id-123', endpointId: '1', nodeName: undefined },
  })),
}));

describe('ItemView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header with container details title', async () => {
    renderComponent();

    expect(
      await screen.findByRole('heading', {
        name: 'Container details',
        level: 1,
      })
    ).toBeVisible();
  });

  it('displays container name in breadcrumbs with leading slash trimmed', async () => {
    renderComponent();

    expect(await screen.findByText('test-container')).toBeVisible();
    expect(screen.queryByText('/test-container')).not.toBeInTheDocument();
  });

  it('renders health status section when container has health data', async () => {
    renderComponent({
      container: {
        State: {
          Health: {
            Status: 'healthy',
            FailingStreak: 0,
            Log: [
              {
                Start: '2024-01-01T00:00:00Z',
                End: '2024-01-01T00:00:01Z',
                ExitCode: 0,
                Output: 'Health check passed',
              },
            ],
          },
        },
      },
    });

    expect(await screen.findByText('Container health')).toBeVisible();
  });

  it('returns null while container data is still loading', () => {
    server.use(
      http.get('/api/endpoints/:endpointId/docker/containers/:id/json', async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      })
    );
    const Wrapped = withTestQueryProvider(
      withTestRouter(withUserProvider(ItemView, createMockUser({ Role: 1 })))
    );
    const { container } = render(<Wrapped />);
    expect(container.querySelector('h1')).toBeNull();
  });

  it('REQ-TAI-001 shows no ownership/access control panel', async () => {
    renderComponent({
      container: {
        Config: { Image: '' },
      },
    });
    await screen.findByRole('heading', {
      name: 'Container details',
      level: 1,
    });
    expect(screen.queryByText('Access control')).not.toBeInTheDocument();
  });

});

function renderComponent({
  user = createMockUser({ Role: 1 }),
  container,
}: {
  user?: User;
  container?: Partial<ContainerDetailsViewModel>;
} = {}) {
  server.use(
    http.get('/api/endpoints/:endpointId/docker/containers/:id/json', () =>
      HttpResponse.json(createMockContainer(container))
    )
  );

  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(ItemView, user))
  );

  return render(<Wrapped />);
}
