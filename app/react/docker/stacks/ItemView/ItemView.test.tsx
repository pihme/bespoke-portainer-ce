import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { createMockStack, createMockUser } from '@/react-tools/test-mocks';
import { StackStatus, StackType } from '@/react/common/stacks/types';
import { server } from '@/setup-tests/server';
import { notifyError } from '@/portainer/services/notifications';

import { ItemView } from './ItemView';

const routeParams: Record<string, string> = {
  regular: 'true',
  external: 'false',
  orphaned: 'false',
  orphanedRunning: 'false',
  name: 'compose-stack',
  id: '12',
  type: '2',
  endpointId: '1',
};

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: vi.fn(() => ({
    params: routeParams,
  })),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({
    title,
    breadcrumbs,
  }: {
    title: string;
    breadcrumbs: Array<string | { label: string }>;
  }) => (
    <div>
      <h1>{title}</h1>
      <nav>
        {breadcrumbs.map((crumb) =>
          typeof crumb === 'string' ? crumb : crumb.label
        )}
      </nav>
    </div>
  ),
}));

vi.mock('./StackDetails', () => ({
  StackDetails: (props: {
    stackName: string;
    isRegular: boolean;
    isExternal: boolean;
    isOrphaned: boolean;
  }) => (
    <div
      data-cy="stack-details-stub"
      data-stack-name={props.stackName}
      data-regular={String(props.isRegular)}
      data-external={String(props.isExternal)}
      data-orphaned={String(props.isOrphaned)}
    />
  ),
}));

vi.mock('./StackContainersDatatable', () => ({
  StackContainersDatatable: ({ stackName }: { stackName: string }) => (
    <div data-cy="stack-containers-stub" data-stack-name={stackName} />
  ),
}));

vi.mock('./StackServicesDatatable', () => ({
  StackServicesDatatable: ({ name }: { name: string }) => (
    <div data-cy="stack-services-stub" data-stack-name={name} />
  ),
}));

vi.mock('@/react/portainer/access-control', () => ({
  AccessControlPanel: ({ resourceId }: { resourceId: string }) => (
    <div data-cy="access-control-stub" data-resource-id={resourceId} />
  ),
}));

vi.mock('./useUpdateStackResourcesOnDeployment', () => ({
  useUpdateStackResourcesOnDeployment: vi.fn(),
}));

describe('REQ-STK-04 ItemView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(routeParams, {
      regular: 'true',
      external: 'false',
      orphaned: 'false',
      orphanedRunning: 'false',
      name: 'compose-stack',
      id: '12',
      type: String(StackType.DockerCompose),
      endpointId: '1',
    });
  });

  it('renders the stack details page header and compose containers for a regular compose stack', async () => {
    const stack = createMockStack({
      Id: 12,
      Name: 'compose-stack',
      Type: StackType.DockerCompose,
      EndpointId: 1,
    });
    server.use(http.get('/api/stacks/:id', () => HttpResponse.json(stack)));

    renderComponent();

    expect(
      await screen.findByRole('heading', { name: 'Stack details' })
    ).toBeVisible();

    await waitFor(() => {
      expect(screen.getByTestId('stack-details-stub')).toHaveAttribute(
        'data-stack-name',
        'compose-stack'
      );
    });
    expect(screen.getByRole('navigation')).toHaveTextContent('compose-stack');
    expect(screen.getByTestId('stack-containers-stub')).toHaveAttribute(
      'data-stack-name',
      'compose-stack'
    );
    expect(screen.queryByTestId('stack-services-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('access-control-stub')).toHaveAttribute(
      'data-resource-id',
      '1_compose-stack'
    );
  });

  it('shows swarm services instead of containers for a swarm stack type', async () => {
    routeParams.type = String(StackType.DockerSwarm);
    const stack = createMockStack({
      Id: 12,
      Type: StackType.DockerSwarm,
      Name: 'compose-stack',
    });
    server.use(http.get('/api/stacks/:id', () => HttpResponse.json(stack)));

    renderComponent();

    expect(await screen.findByTestId('stack-services-stub')).toHaveAttribute(
      'data-stack-name',
      'compose-stack'
    );
    expect(
      screen.queryByTestId('stack-containers-stub')
    ).not.toBeInTheDocument();
  });

  it('hides containers and access control for an orphaned non-running stack', async () => {
    routeParams.orphaned = 'true';
    routeParams.regular = 'false';
    routeParams.orphanedRunning = 'false';
    const stack = createMockStack({ Id: 12, Name: 'compose-stack' });
    server.use(http.get('/api/stacks/:id', () => HttpResponse.json(stack)));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stack-details-stub')).toHaveAttribute(
        'data-orphaned',
        'true'
      );
    });
    expect(
      screen.queryByTestId('stack-containers-stub')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-control-stub')).not.toBeInTheDocument();
  });

  it('notifies on an invalid external stack type', async () => {
    routeParams.external = 'true';
    routeParams.regular = 'false';
    routeParams.type = '9';
    delete routeParams.id;

    renderComponent();

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith(
        'Failure',
        undefined,
        'Invalid type URL parameter.'
      );
    });
  });
});

function renderComponent() {
  const user = createMockUser({ Role: 1 });
  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(ItemView, user))
  );
  return render(<Wrapped />);
}
