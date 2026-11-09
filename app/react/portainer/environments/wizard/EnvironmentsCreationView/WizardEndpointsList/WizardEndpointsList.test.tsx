import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnvironmentType } from '@/react/portainer/environments/types';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { WizardEndpointsList } from './WizardEndpointsList';

const listState = vi.hoisted(() => ({
  environments: [] as Array<{
    Id: number;
    Name: string;
    URL: string;
    Type: EnvironmentType;
    ContainerEngine?: string;
  }>,
}));

vi.mock('@/react/portainer/environments/queries/useEnvironmentList', () => ({
  ENVIRONMENTS_POLLING_INTERVAL: 5000,
  useEnvironmentList: (
    _params: unknown,
    opts?: {
      refetchInterval?: (envs: unknown) => unknown;
      enabled?: boolean;
    }
  ) => {
    // Exercise the refetchInterval callback KEEP paths without Edge polling
    opts?.refetchInterval?.(undefined);
    opts?.refetchInterval?.({ value: listState.environments });
    return { environments: listState.environments };
  },
}));

vi.mock('@@/EdgeIndicator', () => ({
  EdgeIndicator: () => <div data-cy="edge-indicator" />,
}));

describe('WizardEndpointsList', () => {
  it('lists local Docker environments from the wizard selection', () => {
    listState.environments = [
      {
        Id: 1,
        Name: 'local',
        URL: 'unix:///var/run/docker.sock',
        Type: EnvironmentType.Docker,
      },
    ];
    const Wrapped = withTestQueryProvider(() => (
      <WizardEndpointsList environmentIds={[1]} />
    ));
    render(<Wrapped />);
    expect(screen.getByText('New Environments')).toBeVisible();
    expect(screen.getByText('local')).toBeVisible();
    expect(screen.getByText(/URL:/)).toBeVisible();
    expect(screen.queryByTestId('edge-indicator')).not.toBeInTheDocument();
  });

  it('renders an empty list when no environments are selected', () => {
    listState.environments = [];
    const Wrapped = withTestQueryProvider(() => (
      <WizardEndpointsList environmentIds={[]} />
    ));
    render(<Wrapped />);
    expect(screen.getByText('New Environments')).toBeVisible();
  });
});
