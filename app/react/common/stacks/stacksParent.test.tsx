import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';

import { EditGitSettingsButton } from './EditGitSettingsButton';
import { GitPullButton } from './GitPullButton';
import { PruneField } from './PruneField';
import { Stack, StackStatus, StackType } from './types';

const mutate = vi.fn();
const confirmStackUpdate = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();
const reload = vi.fn();
let openGitSettings: unknown;
let apiVersion = 1.4;

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useCurrentStateAndParams: () => ({
    params: { openGitSettings },
  }),
  useRouter: () => ({
    stateService: { reload },
  }),
}));

vi.mock('./EditGitSettings/EditGitSettingsModal', () => ({
  EditGitSettingsModal: ({ onClose }: { onClose: () => void }) => (
    <div data-cy="edit-git-modal">
      <button type="button" onClick={onClose}>
        close-modal
      </button>
    </div>
  ),
}));

vi.mock('@/react/portainer/gitops/queries/useUpdateGitStack', () => ({
  useUpdateGitStack: () => ({ mutate, isLoading: false }),
}));

vi.mock('@/react/common/stacks/common/confirm-stack-update', () => ({
  confirmStackUpdate: (...args: unknown[]) => confirmStackUpdate(...args),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
  notifyError: (...args: unknown[]) => notifyError(...args),
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/docker/proxy/queries/useVersion', () => ({
  useApiVersion: () => apiVersion,
}));

function stack(overrides: Partial<Stack> = {}): Stack {
  return {
    Id: 9,
    Name: 'web',
    Type: StackType.DockerCompose,
    EndpointId: 1,
    SwarmId: '',
    EntryPoint: 'docker-compose.yml',
    Env: [],
    Status: StackStatus.Active,
    ProjectPath: '/data',
    CreationDate: 1,
    CreatedBy: 'admin',
    UpdateDate: 1,
    UpdatedBy: 'admin',
    FromAppTemplate: false,
    IsComposeFormat: true,
    SupportRelativePath: false,
    FilesystemPath: '',
    StackFileVersion: 1,
    Option: { Prune: true, Force: false },
    ...overrides,
  };
}

describe('REQ-STK stacks parent helpers', () => {
  beforeEach(() => {
    mutate.mockReset();
    confirmStackUpdate.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
    reload.mockReset();
    openGitSettings = undefined;
    apiVersion = 1.4;
  });

  it('opens edit git settings from the button and query param', async () => {
    const user = userEvent.setup();
    openGitSettings = true;
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => <EditGitSettingsButton stack={stack()} />),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    expect(screen.getByTestId('edit-git-modal')).toBeVisible();
    await user.click(screen.getByText('close-modal'));
    expect(screen.queryByTestId('edit-git-modal')).not.toBeInTheDocument();

    cleanup();
    openGitSettings = undefined;
    const Wrapped2 = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => <EditGitSettingsButton stack={stack()} />),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped2 />);
    await user.click(screen.getByTestId('edit-git-settings-button'));
    expect(screen.getByTestId('edit-git-modal')).toBeVisible();
  });

  it('pulls and redeploys a Compose stack after confirmation', async () => {
    const user = userEvent.setup();
    confirmStackUpdate.mockResolvedValue({ repullImageAndRedeploy: true });
    mutate.mockImplementation((_payload, opts) => {
      opts.onSuccess();
    });

    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => <GitPullButton stack={stack()} />),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    await user.click(screen.getByTestId('git-pull-button'));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          RepullImageAndRedeploy: true,
          Env: [],
          Prune: true,
        },
        expect.any(Object)
      )
    );
    expect(notifySuccess).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('skips pull when confirmation is cancelled and reports errors', async () => {
    const user = userEvent.setup();
    confirmStackUpdate.mockResolvedValueOnce(undefined);
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => <GitPullButton stack={stack()} />),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    await user.click(screen.getByTestId('git-pull-button'));
    expect(mutate).not.toHaveBeenCalled();

    confirmStackUpdate.mockResolvedValue({ repullImageAndRedeploy: false });
    mutate.mockImplementation((_payload, opts) => {
      opts.onError(new Error('fail'));
    });
    await user.click(screen.getByTestId('git-pull-button'));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
  });

  it('shows prune for Compose when API is new enough', async () => {
    const user = userEvent.setup();
    apiVersion = 1.4;
    const onChange = vi.fn();
    const Wrapped = withTestQueryProvider(() => (
      <PruneField
        stackType={StackType.DockerCompose}
        checked={false}
        onChange={onChange}
      />
    ));
    render(<Wrapped />);
    expect(screen.getByText(/prune services/i)).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', { name: /prune services/i })
    );
    expect(onChange).toHaveBeenCalledWith(true, undefined);
  });

  it('hides prune for unsupported stack types or old API', () => {
    apiVersion = 1.26;
    const { container, rerender } = render(
      <PruneField
        stackType={StackType.DockerCompose}
        checked={false}
        onChange={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();

    apiVersion = 1.4;
    rerender(
      <PruneField
        stackType={StackType.Kubernetes}
        checked={false}
        onChange={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes stack enums used by local Compose flows', () => {
    expect(StackType.DockerCompose).toBe(2);
    expect(StackStatus.Active).toBe(1);
  });
});
