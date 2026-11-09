import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { createMockStack, createMockUser } from '@/react-tools/test-mocks';
import { StackStatus } from '@/react/common/stacks/types';
import { server } from '@/setup-tests/server';
import { notifyError, notifySuccess } from '@/portainer/services/notifications';

import { StackActions } from './StackActions';

const mockReload = vi.fn();
const mockGo = vi.fn();

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useRouter: () => ({
    stateService: { reload: mockReload, go: mockGo },
  }),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const mockConfirm = vi.fn(async () => true);
const mockConfirmDelete = vi.fn(async () => true);

vi.mock('@@/modals/confirm', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@@/modals/confirm')>();
  return {
    ...actual,
    confirm: (...args: unknown[]) => mockConfirm(...args),
    confirmDelete: (...args: unknown[]) => mockConfirmDelete(...args),
  };
});

vi.mock('@/react/common/stacks/EditGitSettingsButton', () => ({
  EditGitSettingsButton: () => (
    <button type="button" data-cy="edit-git-settings">
      Edit Git settings
    </button>
  ),
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

vi.mock('@/react/common/stacks/GitPullButton', () => ({
  GitPullButton: () => (
    <button type="button" data-cy="git-pull">
      Pull and redeploy
    </button>
  ),
}));

describe('REQ-STK-05 StackActions start and stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    mockConfirmDelete.mockResolvedValue(true);
  });

  it('shows stop for an active regular stack and stops after confirm', async () => {
    const user = userEvent.setup();
    let stopCalled = false;
    server.use(
      http.post('/api/stacks/:id/stop', () => {
        stopCalled = true;
        return HttpResponse.json(
          createMockStack({ Status: StackStatus.Inactive })
        );
      })
    );

    renderComponent({
      status: StackStatus.Active,
      isRegular: true,
    });

    await user.click(screen.getByTestId('stack-stop-btn'));
    expect(mockConfirm).toHaveBeenCalled();

    await waitFor(() => expect(stopCalled).toBe(true));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        'Success',
        'Stack test-stack stopped successfully'
      )
    );
    expect(mockReload).toHaveBeenCalled();
  });

  it('shows start for an inactive regular stack and starts it', async () => {
    const user = userEvent.setup();
    let startCalled = false;
    server.use(
      http.post('/api/stacks/:id/start', () => {
        startCalled = true;
        return HttpResponse.json(
          createMockStack({ Status: StackStatus.Active })
        );
      })
    );

    renderComponent({
      status: StackStatus.Inactive,
      isRegular: true,
    });

    await user.click(screen.getByTestId('stack-start-btn'));

    await waitFor(() => expect(startCalled).toBe(true));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        'Success',
        'Stack test-stack started successfully'
      )
    );
    expect(mockReload).toHaveBeenCalled();
  });

  it('does not stop when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup();
    mockConfirm.mockResolvedValueOnce(false);
    let stopCalled = false;
    server.use(
      http.post('/api/stacks/:id/stop', () => {
        stopCalled = true;
        return HttpResponse.json({});
      })
    );

    renderComponent({ status: StackStatus.Active, isRegular: true });
    await user.click(screen.getByTestId('stack-stop-btn'));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(stopCalled).toBe(false);
  });
});

describe('REQ-STK-08 StackActions delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDelete.mockResolvedValue(true);
  });

  it('deletes the stack after confirm and navigates up', async () => {
    const user = userEvent.setup();
    let deleteCalled = false;
    server.use(
      http.delete('/api/stacks/:id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete('/api/stacks/name/:name', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderComponent({ isRegular: true, status: StackStatus.Active });
    await user.click(screen.getByTestId('stack-delete-btn'));

    await waitFor(() => expect(mockConfirmDelete).toHaveBeenCalled());
    await waitFor(() => expect(deleteCalled).toBe(true));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        'Stack successfully removed',
        'test-stack'
      )
    );
    expect(mockGo).toHaveBeenCalledWith('^');
  });

  it('does not delete when confirm is cancelled', async () => {
    const user = userEvent.setup();
    mockConfirmDelete.mockResolvedValueOnce(false);
    let deleteCalled = false;
    server.use(
      http.delete('/api/stacks/:id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderComponent({ isRegular: true });
    await user.click(screen.getByTestId('stack-delete-btn'));
    await waitFor(() => expect(mockConfirmDelete).toHaveBeenCalled());
    expect(deleteCalled).toBe(false);
  });

  it('disables delete while the stack is deploying', () => {
    renderComponent({ status: StackStatus.Deploying, isRegular: true });
    expect(screen.getByTestId('stack-delete-btn')).toBeDisabled();
  });
});

describe('REQ-STK-06 StackActions create template', () => {
  it('links to custom template creation when file content is available', () => {
    renderComponent({
      isRegular: true,
      fileContent: 'services:\n  web:\n    image: nginx',
    });
    expect(screen.getByTestId('stack-create-template-btn')).toBeVisible();
  });

  it('hides the create-template action without file content', () => {
    renderComponent({ isRegular: true, fileContent: undefined });
    expect(
      screen.queryByTestId('stack-create-template-btn')
    ).not.toBeInTheDocument();
  });
});

describe('REQ-STK-04 StackActions git detach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
  });

  it('shows git actions and detaches after confirm', async () => {
    const user = userEvent.setup();
    let updateBody: unknown;
    server.use(
      http.put('/api/stacks/:id', async ({ request }) => {
        updateBody = await request.json();
        return HttpResponse.json(createMockStack());
      })
    );

    const stack = createMockStack({
      GitConfig: {
        URL: 'https://github.com/test/repo',
        ReferenceName: 'main',
        ConfigFilePath: 'docker-compose.yml',
        ConfigHash: 'abc',
        TLSSkipVerify: false,
      },
      FromAppTemplate: false,
      Env: [{ name: 'A', value: '1' }],
    });

    renderComponent({
      stack,
      isRegular: true,
      fileContent: 'version: "3"',
      status: StackStatus.Active,
    });

    expect(screen.getByTestId('edit-git-settings')).toBeVisible();
    expect(screen.getByTestId('git-pull')).toBeVisible();

    await user.click(screen.getByTestId('stack-detach-git-btn'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    await waitFor(() => expect(updateBody).toBeTruthy());
    expect(mockGo).toHaveBeenCalledWith('^');
  });
});

describe('StackActions visibility', () => {
  it('hides start/stop when the stack is not regular', () => {
    renderComponent({ isRegular: false, status: StackStatus.Active });
    expect(screen.queryByTestId('stack-stop-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stack-start-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('stack-delete-btn')).toBeVisible();
  });

  it('shows stop for an error status regular stack', () => {
    renderComponent({ isRegular: true, status: StackStatus.Error });
    expect(screen.getByTestId('stack-stop-btn')).toBeVisible();
  });
});

function renderComponent({
  stack = createMockStack(),
  fileContent,
  isRegular = true,
  environmentId = 1,
  isExternal = false,
  status = StackStatus.Active,
}: Partial<React.ComponentProps<typeof StackActions>> = {}) {
  const user = createMockUser({ Role: 1 });
  const Wrapped = withTestQueryProvider(
    withTestRouter(withUserProvider(StackActions, user))
  );

  return render(
    <Wrapped
      stack={stack}
      fileContent={fileContent}
      isRegular={isRegular}
      environmentId={environmentId}
      isExternal={isExternal}
      status={status}
    />
  );
}
