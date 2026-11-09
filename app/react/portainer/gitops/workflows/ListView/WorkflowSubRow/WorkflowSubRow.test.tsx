import { render, screen } from '@testing-library/react';

import { mockWorkflowHealthy } from '../../test-utils/workflow.mock';

import { WorkflowSubRow } from './WorkflowSubRow';

vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('../../../components/StatusBadge', () => ({
  TypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
  PlatformBadge: ({ platform }: { platform: string }) => <span>{platform}</span>,
}));
vi.mock('./TargetCell', () => ({
  TargetCell: () => <div data-cy="target">target</div>,
}));

const sources = [
  {
    sourceId: 25,
    query: {
      data: { name: 'my-source', url: 'https://git.example/repo.git' },
    },
  },
];

describe('REQ-GIT-01 WorkflowSubRow for local Compose artifacts', () => {
  it('renders source, artifact path and target cells', () => {
    const artifact = mockWorkflowHealthy.artifacts[0];
    render(
      <WorkflowSubRow artifact={artifact} sources={sources} showHeader={false} />
    );
    expect(screen.getByText('my-source')).toBeVisible();
    expect(screen.getByText('https://git.example/repo.git')).toBeVisible();
    expect(screen.getByText('docker-compose.yml')).toBeVisible();
    expect(screen.getByTestId('target')).toBeVisible();
  });

  it('shows headers and empty fallbacks when requested', () => {
    const artifact = {
      ...mockWorkflowHealthy.artifacts[0],
      files: [],
      name: 'headered',
    };
    render(
      <WorkflowSubRow artifact={artifact} sources={[]} showHeader />
    );
    expect(screen.getByText('headered')).toBeVisible();
    expect(screen.getByText('stack')).toBeVisible();
    expect(screen.getByText('No source')).toBeVisible();
    expect(screen.getByText('No files')).toBeVisible();
  });

  it('shows Unknown source when the source query has no data', () => {
    const artifact = mockWorkflowHealthy.artifacts[0];
    render(
      <WorkflowSubRow
        artifact={artifact}
        sources={[{ sourceId: 25, query: { data: undefined } }]}
        showHeader={false}
      />
    );
    expect(screen.getByText('Unknown source')).toBeVisible();
  });
});
