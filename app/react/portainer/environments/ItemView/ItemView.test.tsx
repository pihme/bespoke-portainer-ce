import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import {
  Environment,
  EnvironmentType,
  EnvironmentStatus,
} from '@/react/portainer/environments/types';
import { createMockEnvironment } from '@/react-tools/test-mocks';

import { ItemView } from './ItemView';

vi.mock('./EnvironmentDetailsForm', () => ({
  EnvironmentDetailsForm: ({ environment }: { environment: Environment }) => (
    <div data-cy="environment-details-form">
      EnvironmentDetailsForm: {environment.Name}
    </div>
  ),
}));

// Mock useIdParam hook
vi.mock('@/react/hooks/useIdParam', () => ({
  useIdParam: () => 1,
}));

describe('ItemView', () => {
  it('should render page header with environment name and breadcrumbs', async () => {
    const { getByRole } = renderComponent();

    await waitFor(() => {
      expect(
        getByRole('heading', { name: 'Environment details' })
      ).toBeVisible();
    });

    // Check breadcrumbs are present
    expect(screen.getByText('Test Environment')).toBeVisible();
  });

  it('REQ-TAI-004 shows a legacy Edge environment as unsupported, without an edit form', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.EdgeAgentOnDocker,
      EdgeID: 'edge-123',
      EdgeKey: 'edge-key-123',
    });

    renderComponentWithEnvironment(environment);

    await waitFor(() => {
      expect(
        screen.getByText(/Edge environments are no longer supported/)
      ).toBeVisible();
    });
    expect(
      screen.queryByTestId('environment-details-form')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/edge-key-123/)).not.toBeInTheDocument();
  });

  it('should not render edge components for non-edge environment', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.Docker,
    });

    renderComponentWithEnvironment(environment);

    await waitFor(() => {
      expect(screen.getByTestId('environment-details-form')).toBeVisible();
    });

    expect(
      screen.queryByText(/Edge environments are no longer supported/)
    ).not.toBeInTheDocument();
  });

  it('REQ-TAI-002 shows no kubeconfig panel', async () => {
    const environment = createMockEnvironment({
      Type: EnvironmentType.KubernetesLocal,
      Status: EnvironmentStatus.Up,
    });

    renderComponentWithEnvironment(environment);

    await waitFor(() => {
      expect(screen.getByTestId('environment-details-form')).toBeVisible();
    });
    expect(screen.queryByText(/kubeconfig/i)).not.toBeInTheDocument();
  });

  it('should render EnvironmentDetailsForm component', async () => {
    const { getByTestId } = renderComponent();

    await waitFor(() => {
      const detailsForm = getByTestId('environment-details-form');
      expect(detailsForm).toBeVisible();
      expect(detailsForm).toHaveTextContent('Test Environment');
    });
  });
});

function renderComponent() {
  const mockEnvironment = createMockEnvironment({
    Id: 1,
    Name: 'Test Environment',
    Type: EnvironmentType.Docker,
    Status: EnvironmentStatus.Up,
  });
  return renderComponentWithEnvironment(mockEnvironment);
}

function renderComponentWithEnvironment(environment: Environment) {
  server.use(
    http.get('/api/endpoints/:id', ({ params }) => {
      const { id } = params;
      return HttpResponse.json({
        ...environment,
        Id: Number(id),
      });
    })
  );

  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(ItemView))
  );

  return render(<Wrapped />);
}
