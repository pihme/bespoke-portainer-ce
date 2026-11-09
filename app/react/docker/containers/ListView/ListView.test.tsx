import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { Environment } from '@/react/portainer/environments/types';

import { ListView } from './ListView';

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useInfo: vi.fn(),
}));

vi.mock('@/react/portainer/environments/utils', () => ({
  isAgentEnvironment: vi.fn((type: number) => type === 2),
}));

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('./ContainersDatatable', () => ({
  ContainersDatatable: ({
    isHostColumnVisible,
    environment,
  }: {
    isHostColumnVisible: boolean;
    environment: Environment;
  }) => (
    <div data-cy="containers-table">
      host:{String(isHostColumnVisible)};env:{environment.Id}
    </div>
  ),
}));

import { useInfo } from '@/react/docker/proxy/queries/useInfo';

function env(overrides: Partial<Environment> = {}): Environment {
  return {
    Id: 9,
    Type: 1,
    Name: 'local',
    ...overrides,
  } as Environment;
}

describe('containers ListView parent', () => {
  it('hides host column for non-agent environments', () => {
    vi.mocked(useInfo).mockReturnValue({ data: true } as ReturnType<
      typeof useInfo
    >);
    render(<ListView endpoint={env({ Type: 1 })} />);
    expect(screen.getByText('Container list')).toBeVisible();
    expect(screen.getByTestId('containers-table')).toHaveTextContent(
      'host:false;env:9'
    );
  });

  it('shows host column for agent swarm managers', () => {
    vi.mocked(useInfo).mockImplementation((_id, opts?: { select?: (i: { Swarm?: { NodeID?: string } }) => boolean }) => {
      const info = { Swarm: { NodeID: 'node-1' } };
      return {
        data: opts?.select ? opts.select(info) : info,
      } as ReturnType<typeof useInfo>;
    });
    render(<ListView endpoint={env({ Type: 2 })} />);
    expect(screen.getByTestId('containers-table')).toHaveTextContent(
      'host:true;env:9'
    );
  });
});
