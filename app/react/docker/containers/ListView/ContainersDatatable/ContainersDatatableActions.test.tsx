import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { withTestRouter } from '@/react/test-utils/withRouter';
import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { ContainersDatatableActions } from './ContainersDatatableActions';

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockKill = vi.fn();
const mockRestart = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockRemove = vi.fn();
const mockReload = vi.fn();
const mockConfirm = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockSetAgentHeader = vi.fn();

let authorized = true;

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useRouter: () => ({
    stateService: { reload: mockReload },
  }),
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

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useAuthorizations: () => ({ authorized }),
    Authorized: ({ children }: { children: React.ReactNode }) =>
      authorized ? children : null,
  };
});

vi.mock('@/react/docker/containers/containers.service', () => ({
  startContainer: (...args: unknown[]) => mockStart(...args),
  stopContainer: (...args: unknown[]) => mockStop(...args),
  killContainer: (...args: unknown[]) => mockKill(...args),
  restartContainer: (...args: unknown[]) => mockRestart(...args),
  pauseContainer: (...args: unknown[]) => mockPause(...args),
  resumeContainer: (...args: unknown[]) => mockResume(...args),
  removeContainer: (...args: unknown[]) => mockRemove(...args),
}));

vi.mock('@/portainer/services/notifications', () => ({
  success: (...args: unknown[]) => mockSuccess(...args),
  error: (...args: unknown[]) => mockError(...args),
}));

vi.mock('@/portainer/services/http-request.helper', () => ({
  setPortainerAgentTargetHeader: (...args: unknown[]) =>
    mockSetAgentHeader(...args),
}));

vi.mock(
  '@/react/docker/containers/common/confirm-container-delete-modal',
  () => ({
    confirmContainerDeletion: (...args: unknown[]) => mockConfirm(...args),
  })
);

function createContainer(
  overrides: Partial<ContainerListViewModel> = {}
): ContainerListViewModel {
  return {
    Id: 'cid-1',
    Names: ['web'],
    Image: 'nginx:latest',
    ImageID: 'sha256:abc',
    Command: 'nginx',
    Created: 1704067200,
    Ports: [],
    Labels: {},
    State: 'running',
    Status: ContainerStatus.Running,
    StatusText: 'Up 1 hour',
    HostConfig: {},
    Mounts: [],
    NodeName: 'node-a',
    IP: '172.17.0.2',
    StackName: 'compose',
    Gpus: '',
    IsPortainer: false,
    ...overrides,
  } as ContainerListViewModel;
}

function renderActions(
  selectedItems: ContainerListViewModel[],
  {
    isAddActionVisible = true,
    endpointId = 1,
  }: {
    isAddActionVisible?: boolean;
    endpointId?: number;
  } = {}
) {
  const Wrapped = withTestRouter(ContainersDatatableActions);

  return render(
    <Wrapped
      selectedItems={selectedItems}
      isAddActionVisible={isAddActionVisible}
      endpointId={endpointId}
    />
  );
}

describe('REQ-CTR-01 ContainersDatatableActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorized = true;
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockKill.mockResolvedValue(undefined);
    mockRestart.mockResolvedValue(undefined);
    mockPause.mockResolvedValue(undefined);
    mockResume.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  it('returns null when the user is not authorized for container actions', () => {
    authorized = false;
    renderActions([createContainer()]);

    expect(
      screen.queryByTestId('start-docker-container-button')
    ).not.toBeInTheDocument();
  });

  it('renders action buttons and add container when authorized', () => {
    renderActions([]);

    expect(screen.getByTestId('start-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('stop-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('kill-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('restart-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('pause-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('resume-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('remove-docker-container-button')).toBeVisible();
    expect(screen.getByTestId('add-docker-container-button')).toBeVisible();
  });

  it('hides add container when isAddActionVisible is false', () => {
    renderActions([], { isAddActionVisible: false });

    expect(
      screen.queryByTestId('add-docker-container-button')
    ).not.toBeInTheDocument();
  });

  it('disables all selection-dependent actions when nothing is selected', () => {
    renderActions([]);

    expect(screen.getByTestId('start-docker-container-button')).toBeDisabled();
    expect(screen.getByTestId('stop-docker-container-button')).toBeDisabled();
    expect(screen.getByTestId('kill-docker-container-button')).toBeDisabled();
    expect(screen.getByTestId('restart-docker-container-button')).toBeDisabled();
    expect(screen.getByTestId('pause-docker-container-button')).toBeDisabled();
    expect(screen.getByTestId('resume-docker-container-button')).toBeDisabled();
    expect(screen.getByTestId('remove-docker-container-button')).toBeDisabled();
  });

  it('enables start for stopped/created/exited containers and starts them', async () => {
    const user = userEvent.setup();
    const stopped = createContainer({
      Id: 'stopped-1',
      Names: ['stopped'],
      State: 'exited',
      Status: ContainerStatus.Exited,
      StatusText: 'Exited (0) 2 minutes ago',
    });
    renderActions([stopped]);

    const start = screen.getByTestId('start-docker-container-button');
    expect(start).toBeEnabled();
    await user.click(start);

    await waitFor(() => {
      // REQ-TAI-007: no per-node agent target header any more
      expect(mockSetAgentHeader).not.toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalledWith(1, 'stopped-1');
      expect(mockSuccess).toHaveBeenCalledWith(
        'Container successfully started',
        'stopped'
      );
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('enables stop/pause for running containers and notifies on failure', async () => {
    const user = userEvent.setup();
    mockStop.mockRejectedValueOnce(new Error('boom'));
    const running = createContainer({
      Status: ContainerStatus.Healthy,
      State: 'running',
    });
    renderActions([running]);

    expect(screen.getByTestId('stop-docker-container-button')).toBeEnabled();
    expect(screen.getByTestId('pause-docker-container-button')).toBeEnabled();
    expect(screen.getByTestId('kill-docker-container-button')).toBeEnabled();

    await user.click(screen.getByTestId('stop-docker-container-button'));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Failure',
        expect.any(Error),
        'Unable to stop container:web'
      );
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('enables resume for paused containers and resumes them', async () => {
    const user = userEvent.setup();
    const paused = createContainer({
      State: ContainerStatus.Paused,
      Status: ContainerStatus.Paused,
      StatusText: 'Up 1 hour (Paused)',
    });
    renderActions([paused]);

    const resume = screen.getByTestId('resume-docker-container-button');
    expect(resume).toBeEnabled();
    expect(screen.getByTestId('start-docker-container-button')).toBeDisabled();

    await user.click(resume);

    await waitFor(() => {
      expect(mockResume).toHaveBeenCalledWith(1, 'cid-1');
      expect(mockSuccess).toHaveBeenCalledWith(
        'Container successfully resumed',
        'web'
      );
    });
  });

  it('restarts selected containers', async () => {
    const user = userEvent.setup();
    renderActions([createContainer()]);

    await user.click(screen.getByTestId('restart-docker-container-button'));

    await waitFor(() => {
      expect(mockRestart).toHaveBeenCalledWith(1, 'cid-1');
      expect(mockSuccess).toHaveBeenCalledWith(
        'Container successfully restarted',
        'web'
      );
    });
  });

  it('kills selected containers', async () => {
    const user = userEvent.setup();
    renderActions([createContainer({ Status: ContainerStatus.Starting })]);

    await user.click(screen.getByTestId('kill-docker-container-button'));

    await waitFor(() => {
      expect(mockKill).toHaveBeenCalledWith(1, 'cid-1');
      expect(mockSuccess).toHaveBeenCalledWith(
        'Container successfully killed',
        'web'
      );
    });
  });

  it('pauses selected running containers', async () => {
    const user = userEvent.setup();
    renderActions([
      createContainer({ Status: ContainerStatus.Unhealthy, State: 'running' }),
    ]);

    await user.click(screen.getByTestId('pause-docker-container-button'));

    await waitFor(() => {
      expect(mockPause).toHaveBeenCalledWith(1, 'cid-1');
      expect(mockSuccess).toHaveBeenCalledWith(
        'Container successfully paused',
        'web'
      );
    });
  });

  it('removes selected containers after confirmation including volumes', async () => {
    const user = userEvent.setup();
    mockConfirm.mockResolvedValue({ removeVolumes: true });
    renderActions([
      createContainer({ State: 'running', Status: ContainerStatus.Running }),
    ]);

    await user.click(screen.getByTestId('remove-docker-container-button'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        'You are about to remove one or more running containers.'
      );
      expect(mockRemove).toHaveBeenCalledWith(1, 'cid-1', {
        removeVolumes: true,
      });
      expect(mockSuccess).toHaveBeenCalledWith(
        'Container successfully removed',
        'web'
      );
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('does not remove when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    mockConfirm.mockResolvedValue(undefined);
    renderActions([
      createContainer({ State: 'exited', Status: ContainerStatus.Exited }),
    ]);

    await user.click(screen.getByTestId('remove-docker-container-button'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        'You are about to remove one or more  containers.'
      );
    });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('notifies failure when remove rejects', async () => {
    const user = userEvent.setup();
    mockConfirm.mockResolvedValue({ removeVolumes: false });
    mockRemove.mockRejectedValueOnce(new Error('nope'));
    renderActions([createContainer()]);

    await user.click(screen.getByTestId('remove-docker-container-button'));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Failure',
        expect.any(Error),
        'Unable to remove container'
      );
      expect(mockReload).toHaveBeenCalled();
    });
  });
});
