import { render, screen } from '@testing-library/react';

import { createMockUser } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { HomeView } from './HomeView';

let localState: {
  status: 'error' | 'loading' | 'success';
  type?: EnvironmentType;
} = { status: 'loading' };

vi.mock('./useFetchOrCreateLocalEnvironment', () => ({
  useConnectLocalEnvironment: () => localState,
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => <a data-cy={dataCy}>{children}</a>,
}));

function renderView() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(withTestRouter(HomeView), createMockUser())
  );
  return render(<Wrapped />);
}

describe('REQ-ENV-04 HomeView wizard entry', () => {
  it('shows the add-environments tile while connecting', () => {
    localState = { status: 'loading' };
    renderView();

    expect(screen.getByText('Welcome to Portainer')).toBeVisible();
    expect(screen.getByTestId('wizard-add-environments-link')).toBeVisible();
    expect(screen.queryByTestId('wizard-get-started-link')).not.toBeInTheDocument();
  });

  it('shows get-started for a connected local Docker environment', () => {
    localState = { status: 'success', type: EnvironmentType.Docker };
    renderView();

    expect(
      screen.getByText(/connected your local environment of Docker/i)
    ).toBeVisible();
    expect(screen.getByTestId('wizard-get-started-link')).toBeVisible();
    expect(screen.getByText('Get Started')).toBeVisible();
  });

  it('REQ-TAI-002 never labels the local environment as Kubernetes', () => {
    localState = { status: 'success', type: EnvironmentType.KubernetesLocal };
    renderView();

    expect(
      screen.queryByText(/connected your local environment of Kubernetes/i)
    ).not.toBeInTheDocument();
  });

  it('shows get-started label for a docker agent environment', () => {
    localState = { status: 'success', type: EnvironmentType.AgentOnDocker };
    renderView();

    expect(
      screen.getByText(/connected your local environment of Docker Agent/i)
    ).toBeVisible();
  });

  it('shows an error message when the local environment cannot be connected', () => {
    localState = { status: 'error' };
    renderView();

    expect(
      screen.getByText(/could not connect your local environment/i)
    ).toBeVisible();
    expect(screen.queryByTestId('wizard-get-started-link')).not.toBeInTheDocument();
  });
});

  it('omits the type label for an unknown environment type', () => {
    localState = { status: 'success', type: 99 as EnvironmentType };
    renderView();

    expect(
      screen.getByText(/connected your local environment of\s+to Portainer/i)
    ).toBeVisible();
  });

