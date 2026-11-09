import { render, screen } from '@testing-library/react';

import {
  mockWorkflowHealthy,
  mockWorkflowSourceError,
  mockWorkflowMultiArtifact,
} from '../test-utils/workflow.mock';

import { WorkflowCard } from './WorkflowCard';

vi.mock('../queries/useWorkflowSources', () => ({
  useWorkflowSources: () => [
    {
      sourceId: 25,
      query: { data: { name: 'repo', url: 'https://example.com/repo.git' } },
    },
  ],
}));
vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@@/SortableList/SortableListItem', () => ({
  SortableListItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('../../components/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  TypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
  PlatformBadge: ({ platform }: { platform: string }) => <span>{platform}</span>,
}));
vi.mock('./WorkflowSubRow/WorkflowSubRow', () => ({
  WorkflowSubRow: ({
    artifact,
    showHeader,
  }: {
    artifact: { name: string };
    showHeader: boolean;
  }) => (
    <div data-cy="subrow">
      {artifact.name}
      {showHeader ? ':header' : ''}
    </div>
  ),
}));

describe('REQ-GIT-01 WorkflowCard for local stack workflows', () => {
  it('renders the workflow name, status and sync label', () => {
    render(
      <WorkflowCard
        item={{ ...mockWorkflowHealthy, lastSyncDate: 1751000000 }}
      />
    );
    expect(screen.getByText('healthy-workflow')).toBeVisible();
    expect(screen.getByText('healthy')).toBeVisible();
    expect(screen.getByText(/Last sync:/)).toBeVisible();
    expect(screen.getByTestId('subrow')).toHaveTextContent('nginx-stack');
  });

  it('shows an error message and a dash when there is no sync date', () => {
    render(
      <WorkflowCard item={{ ...mockWorkflowSourceError, lastSyncDate: undefined }} />
    );
    expect(
      screen.getByText(/authentication failed: git clone error/)
    ).toBeVisible();
    expect(screen.getByText(/Last sync: -/)).toBeVisible();
  });

  it('shows artifact headers when there are multiple artifacts', () => {
    render(
      <WorkflowCard
        item={{ ...mockWorkflowMultiArtifact, lastSyncDate: 1751000000 }}
      />
    );
    expect(screen.getAllByTestId('subrow')[0]).toHaveTextContent(':header');
  });
});
