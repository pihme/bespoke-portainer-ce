import { render, screen } from '@testing-library/react';

import { withTestRouter } from '@/react/test-utils/withRouter';
import { SourceWorkflow } from '../queries/useSourceWorkflows';

import { WorkflowsTab } from './WorkflowsTab';

const workflowsState: {
  data: Array<SourceWorkflow> | undefined;
  isLoading: boolean;
} = {
  data: undefined,
  isLoading: false,
};

vi.mock('../queries/useSourceWorkflows', () => ({
  useSourceWorkflows: () => workflowsState,
}));

function stackWorkflow(
  overrides: Partial<SourceWorkflow> = {}
): SourceWorkflow {
  return {
    id: 1,
    name: 'compose-stack',
    type: 'stack',
    platform: 'dockerCompose',
    status: {
      source: { status: 'healthy' },
      artifact: { status: 'healthy' },
      target: { status: 'healthy' },
    },
    target: { endpointId: 1 },
    creationDate: 1,
    lastSyncDate: 1_700_000_000,
    gitConfig: { ConfigFilePath: 'docker-compose.yml' },
    ...overrides,
  } as SourceWorkflow;
}

function renderTab() {
  const Wrapped = withTestRouter(() => <WorkflowsTab sourceId={5} />);
  return render(<Wrapped />);
}

describe('REQ-GIT-01 WorkflowsTab', () => {
  beforeEach(() => {
    workflowsState.data = undefined;
    workflowsState.isLoading = false;
  });

  it('TestREQ_GIT_01_shows_loading_skeleton_while_workflows_load', () => {
    workflowsState.isLoading = true;
    renderTab();

    expect(screen.getByText('Workflows')).toBeVisible();
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('TestREQ_GIT_01_shows_unable_to_load_when_query_has_no_data', () => {
    workflowsState.data = undefined;
    renderTab();

    expect(screen.getByText('Unable to load workflows.')).toBeVisible();
  });

  it('TestREQ_GIT_01_shows_empty_state_when_no_workflows_use_source', () => {
    workflowsState.data = [];
    renderTab();

    expect(
      screen.getByText('No workflows are using this source.')
    ).toBeVisible();
    expect(screen.getByText('0 workflows using this source')).toBeVisible();
  });

  it('TestREQ_GIT_01_lists_local_stack_workflows_with_sync_info', () => {
    workflowsState.data = [
      stackWorkflow(),
      stackWorkflow({
        id: 2,
        name: 'never-synced',
        lastSyncDate: 0,
        gitConfig: undefined,
      }),
    ];
    renderTab();

    expect(screen.getByText('2 workflows using this source')).toBeVisible();
    expect(screen.getByText('compose-stack')).toBeVisible();
    expect(screen.getByText('docker-compose.yml')).toBeVisible();
    expect(screen.getByText('never-synced')).toBeVisible();
    expect(screen.getByText(/Last sync:\s*Never/)).toBeVisible();
    expect(screen.getAllByTestId('workflow-item')).toHaveLength(2);
  });

  it('TestREQ_GIT_01_does_not_render_edge_group_block_for_stack_workflows', () => {
    workflowsState.data = [stackWorkflow()];
    renderTab();

    expect(screen.queryByText('Groups')).not.toBeInTheDocument();
  });
});
