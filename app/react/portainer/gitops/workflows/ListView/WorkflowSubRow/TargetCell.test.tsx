import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { TargetCell } from './TargetCell';

const useEnvironment = vi.fn((id?: number) =>
  id ? { data: { Id: id, Name: `Env ${id}`, Type: 1 } } : { data: undefined }
);

vi.mock('@/react/portainer/environments/queries', () => ({
  useEnvironment: (id?: number) => useEnvironment(id),
}));
vi.mock('@/react/portainer/environments/utils', () => ({
  getDashboardRoute: () => ({ to: 'docker.dashboard', params: { endpointId: 5 } }),
  getEnvironmentTypeIcon: () => 'box',
}));
vi.mock('@@/Icon', () => ({
  Icon: () => <span data-cy="icon" />,
}));
vi.mock('@/react/edge/edge-groups/queries/useEdgeGroup', () => ({
  useEdgeGroup: () => ({ data: undefined }),
}));
vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe('REQ-GIT-01 TargetCell for local stack targets', () => {
  beforeEach(() => {
    useEnvironment.mockImplementation((id?: number) =>
      id ? { data: { Id: id, Name: `Env ${id}`, Type: 1 } } : { data: undefined }
    );
  });

  it('returns null without a target', () => {
    const { container } = render(
      <TargetCell target={undefined} type="stack" status="healthy" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a local environment target link', () => {
    render(
      <TargetCell
        target={{ endpointId: 5 }}
        type="stack"
        status="healthy"
      />
    );
    expect(screen.getByText('Env 5')).toBeVisible();
  });

  it('includes the namespace in the label when present', () => {
    render(
      <TargetCell
        target={{ endpointId: 5, namespace: 'default' }}
        type="stack"
        status="healthy"
      />
    );
    expect(screen.getByText('Env 5 / default')).toBeVisible();
  });

  it('shows No target when endpointId is missing on a stack', () => {
    render(
      <TargetCell target={{}} type="stack" status="unknown" />
    );
    expect(screen.getByText('No target')).toBeVisible();
  });

  it('falls back when the environment query has not loaded', () => {
    useEnvironment.mockReturnValue({ data: undefined });
    render(
      <TargetCell
        target={{ endpointId: 9 }}
        type="stack"
        status="healthy"
      />
    );
    expect(screen.getByText('Environment 9')).toBeVisible();
  });
});
