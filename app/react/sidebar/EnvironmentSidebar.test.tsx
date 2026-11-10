import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { createMockEnvironment, createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { EnvironmentType } from '@/react/portainer/environments/types';
import { environmentStore } from '@/react/hooks/current-environment-store';

import { Context } from './useSidebarState';
import { EnvironmentSidebar } from './EnvironmentSidebar';

const goMock = vi.fn();
const paramsState: { endpointId?: string; environmentId?: string } = {
  endpointId: undefined,
};

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useCurrentStateAndParams: () => ({
      params: paramsState,
      state: { name: 'docker.dashboard' },
    }),
    useRouter: () => ({
      stateService: { go: goMock },
    }),
  };
});

vi.mock('@/react/portainer/environments/queries/useEnvironment', () => ({
  useEnvironment: (id?: number) => ({
    data: id
      ? createMockEnvironment({
          Id: id,
          Name: 'local-docker',
          Type: EnvironmentType.Docker,
        })
      : undefined,
    isLoading: false,
  }),
}));

vi.mock('./DockerSidebar', () => ({
  DockerSidebar: ({ environmentId }: { environmentId: number }) => (
    <div data-cy="stub-docker-sidebar">DockerSidebar {environmentId}</div>
  ),
}));


function renderEnvSidebar(sidebarState = { isOpen: true, toggle: vi.fn() }) {
  const Wrapped = withUserProvider(
    withTestRouter(EnvironmentSidebar),
    createMockUser({ Role: 1 })
  );

  return render(
    <Context.Provider value={sidebarState}>
      <Wrapped />
    </Context.Provider>
  );
}

describe('EnvironmentSidebar local Docker environment parts', () => {
  beforeEach(() => {
    goMock.mockReset();
    paramsState.endpointId = undefined;
    paramsState.environmentId = undefined;
    environmentStore.getState().clear();
    window.sessionStorage.clear();
  });

  it('shows none selected when sidebar is open and no environment is set', () => {
    renderEnvSidebar({ isOpen: true, toggle: vi.fn() });

    expect(screen.getByText('Environment:')).toBeInTheDocument();
    expect(screen.getByText('None selected')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-docker-sidebar')).not.toBeInTheDocument();
  });

  it('renders no environment chrome when sidebar is closed and no environment is set', () => {
    renderEnvSidebar({ isOpen: false, toggle: vi.fn() });

    expect(screen.queryByText('Environment:')).not.toBeInTheDocument();
    expect(screen.queryByText('None selected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-docker-sidebar')).not.toBeInTheDocument();
  });

  it('renders DockerSidebar when a Docker environment is selected', () => {
    environmentStore.getState().setEnvironmentId(7);
    renderEnvSidebar({ isOpen: true, toggle: vi.fn() });

    expect(screen.getByText('local-docker')).toBeInTheDocument();
    expect(screen.getByTestId('stub-docker-sidebar')).toHaveTextContent(
      'DockerSidebar 7'
    );
  });

  it('clears the environment and navigates home when clear is clicked with endpoint param', () => {
    paramsState.endpointId = '7';
    environmentStore.getState().setEnvironmentId(7);
    renderEnvSidebar({ isOpen: true, toggle: vi.fn() });

    fireEvent.click(screen.getByTitle('Clear environment'));

    expect(goMock).toHaveBeenCalledWith('portainer.home');
    expect(environmentStore.getState().environmentId).toBeUndefined();
  });

  it('clears the store without navigating when no endpoint param is present', () => {
    environmentStore.getState().setEnvironmentId(3);
    renderEnvSidebar({ isOpen: true, toggle: vi.fn() });

    fireEvent.click(screen.getByTitle('Clear environment'));

    expect(goMock).not.toHaveBeenCalled();
    expect(environmentStore.getState().environmentId).toBeUndefined();
  });

  it('shows only the platform icon when sidebar is closed with an environment', () => {
    environmentStore.getState().setEnvironmentId(2);
    renderEnvSidebar({ isOpen: false, toggle: vi.fn() });

    expect(screen.queryByText('local-docker')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('local-docker').length).toBeGreaterThan(0);
    expect(screen.queryByTitle('Clear environment')).not.toBeInTheDocument();
    expect(screen.getByTestId('stub-docker-sidebar')).toBeInTheDocument();
  });

  it('sets environment id from endpointId route param', () => {
    paramsState.endpointId = '42';
    renderEnvSidebar({ isOpen: true, toggle: vi.fn() });

    expect(environmentStore.getState().environmentId).toBe(42);
  });
});
