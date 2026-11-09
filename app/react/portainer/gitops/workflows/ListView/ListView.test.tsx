import { render, screen } from '@testing-library/react';

import { mockWorkflowHealthy, mockWorkflowSourceError } from '../test-utils/workflow.mock';

import { ListView } from './ListView';

const useWorkflows = vi.fn();
const useWorkflowsSummary = vi.fn();
const useListState = vi.fn();

vi.mock('../queries/useWorkflows', () => ({
  useWorkflows: (...args: unknown[]) => useWorkflows(...args),
}));
vi.mock('../../queries/useWorkflowsSummary', () => ({
  useWorkflowsSummary: (...args: unknown[]) => useWorkflowsSummary(...args),
}));
vi.mock('./useListState', () => ({
  useListState: (...args: unknown[]) => useListState(...args),
  SORT_KEYS: ['name', 'status', 'lastSyncDate'],
}));
vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@@/StatusSummaryBar/StatusSummaryBar', () => ({
  StatusSummaryBar: ({
    total,
    segments,
  }: {
    total: number;
    segments: Array<{ key: string; count: number }>;
  }) => (
    <div data-cy="summary">
      total:{total}{' '}
      {segments.map((s) => (
        <span key={s.key}>
          {s.key}:{s.count}
        </span>
      ))}
    </div>
  ),
}));
vi.mock('@@/SortableList/SortableList', () => ({
  SortableList: ({
    groups,
    emptyMessage,
    renderItem,
    totalCount,
  }: {
    groups: Array<{ key: string; items: unknown[] }>;
    emptyMessage: string;
    renderItem: (item: unknown) => React.ReactNode;
    totalCount: number;
  }) => (
    <div data-cy="workflows-list">
      <div>total:{totalCount}</div>
      {groups.length === 0 || groups.every((g) => g.items.length === 0) ? (
        <div>{emptyMessage}</div>
      ) : (
        groups.flatMap((g) =>
          g.items.map((item, i) => (
            <div key={`${g.key}-${i}`}>{renderItem(item)}</div>
          ))
        )
      )}
    </div>
  ),
}));
vi.mock('./WorkflowCard', () => ({
  WorkflowCard: ({ item }: { item: { name: string } }) => (
    <div data-cy="card">{item.name}</div>
  ),
}));

describe('REQ-GIT-01 GitOps workflows ListView for local stacks', () => {
  beforeEach(() => {
    useListState.mockReturnValue({
      search: '',
      page: 0,
      pageSize: 10,
      sortBy: { id: 'name', desc: false },
      status: null,
      setStatus: vi.fn(),
    });
    useWorkflowsSummary.mockReturnValue({
      data: { healthy: 2, error: 1, syncing: 0, paused: 0, unknown: 0 },
      isLoading: false,
    });
  });

  it('renders the summary and workflow cards for local stack workflows', () => {
    useWorkflows.mockReturnValue({
      data: {
        data: [mockWorkflowHealthy, mockWorkflowSourceError],
        totalCount: 2,
      },
      isLoading: false,
    });

    render(<ListView />);
    expect(screen.getByText('GitOps Workflows')).toBeVisible();
    expect(screen.getByTestId('summary')).toHaveTextContent('total:3');
    expect(screen.getByText('healthy-workflow')).toBeVisible();
    expect(screen.getByText('broken-source-stack')).toBeVisible();
  });

  it('shows the empty message when there are no workflows', () => {
    useWorkflows.mockReturnValue({
      data: { data: [], totalCount: 0 },
      isLoading: false,
    });
    render(<ListView />);
    expect(screen.getByText('No workflows found')).toBeVisible();
  });

  it('groups by status when sorting by status', () => {
    useListState.mockReturnValue({
      search: '',
      page: 0,
      pageSize: 10,
      sortBy: { id: 'status', desc: false },
      status: null,
      setStatus: vi.fn(),
    });
    useWorkflows.mockReturnValue({
      data: {
        data: [mockWorkflowHealthy, mockWorkflowSourceError],
        totalCount: 2,
      },
      isLoading: false,
    });

    render(<ListView />);
    expect(screen.getByText('healthy-workflow')).toBeVisible();
    expect(screen.getByText('broken-source-stack')).toBeVisible();
  });

  it('handles a null page payload as empty groups', () => {
    useWorkflows.mockReturnValue({
      data: { data: null, totalCount: 0 },
      isLoading: false,
    });
    render(<ListView />);
    expect(screen.getByText('No workflows found')).toBeVisible();
  });
});
