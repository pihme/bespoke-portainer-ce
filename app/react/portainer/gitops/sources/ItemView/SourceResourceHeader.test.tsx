import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { SourceDetail } from '../queries/useSource';

import { SourceResourceHeader } from './SourceResourceHeader';

const workflowsState: {
  data: Array<{ id: number }> | undefined;
  isLoading: boolean;
  isError: boolean;
} = {
  data: [],
  isLoading: false,
  isError: false,
};

const deleteMutate = vi.fn();
const deleteState = {
  mutate: deleteMutate,
  isLoading: false,
};

const go = vi.fn();

vi.mock('../queries/useSourceWorkflows', () => ({
  useSourceWorkflows: () => workflowsState,
}));

vi.mock('../queries/useDeleteSourceMutation', () => ({
  useDeleteSourceMutation: () => deleteState,
}));

vi.mock('./TestConnectionButton', () => ({
  TestConnectionButton: ({
    sourceId,
    'data-cy': dataCy,
  }: {
    sourceId: number;
    'data-cy': string;
  }) => (
    <button type="button" data-cy={dataCy}>
      Test connection {sourceId}
    </button>
  ),
}));

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useRouter: () => ({ stateService: { go } }),
  };
});

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: vi.fn().mockResolvedValue(true),
}));

const source: SourceDetail = {
  id: 42,
  name: 'local-compose',
  type: 'git',
  url: 'https://github.com/org/local.git',
  status: 'healthy',
  connection: {},
  lastSync: 1_700_000_000,
};

function renderHeader() {
  const Wrapped = withTestQueryProvider(
    withTestRouter(() => <SourceResourceHeader source={source} />)
  );
  return render(<Wrapped />);
}

describe('REQ-GIT-01 SourceResourceHeader', () => {
  beforeEach(() => {
    workflowsState.data = [];
    workflowsState.isLoading = false;
    workflowsState.isError = false;
    deleteMutate.mockReset();
    go.mockReset();
  });

  it('TestREQ_GIT_01_shows_source_name_url_and_workflow_count', () => {
    workflowsState.data = [{ id: 1 }, { id: 2 }];
    renderHeader();

    expect(screen.getByText('local-compose')).toBeVisible();
    expect(screen.getByText('https://github.com/org/local.git')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText(/Last sync/i)).toBeVisible();
    expect(screen.getByTestId('source-test-connection-btn')).toBeVisible();
  });

  it('TestREQ_GIT_01_shows_loading_and_error_workflow_stats', () => {
    workflowsState.isLoading = true;
    const { rerender } = renderHeader();
    expect(document.querySelector('.animate-spin-slow')).toBeTruthy();

    workflowsState.isLoading = false;
    workflowsState.isError = true;
    const Wrapped = withTestQueryProvider(
      withTestRouter(() => <SourceResourceHeader source={source} />)
    );
    rerender(<Wrapped />);
    expect(screen.getByText('-')).toBeVisible();
  });

  it('TestREQ_GIT_01_disables_delete_while_source_still_has_workflows', () => {
    workflowsState.data = [{ id: 1 }];
    renderHeader();

    expect(screen.getByTestId('delete-btn')).toBeDisabled();
  });

  it('TestREQ_GIT_01_deletes_unused_source_and_navigates_back', async () => {
    const user = userEvent.setup();
    const { notifySuccess } = await import(
      '@/portainer/services/notifications'
    );
    workflowsState.data = [];
    deleteMutate.mockImplementation((_id, opts) => {
      opts?.onSuccess?.();
    });

    renderHeader();

    await user.click(screen.getByTestId('delete-btn'));

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith(42, expect.any(Object));
    });
    expect(notifySuccess).toHaveBeenCalledWith('Success', 'Source deleted');
    expect(go).toHaveBeenCalledWith('^');
  });

  it('TestREQ_GIT_01_falls_back_to_git_label_without_type', () => {
    workflowsState.data = undefined;
    const Wrapped = withTestQueryProvider(
      withTestRouter(() => (
        <SourceResourceHeader
          source={{
            ...source,
            type: undefined as unknown as SourceDetail['type'],
            url: '',
            lastSync: undefined,
          }}
        />
      ))
    );
    render(<Wrapped />);

    expect(screen.getByText('Git')).toBeVisible();
    expect(screen.getByText('-')).toBeVisible();
  });
});
