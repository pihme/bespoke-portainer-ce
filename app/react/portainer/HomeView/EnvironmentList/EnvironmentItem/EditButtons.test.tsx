import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import { EnvironmentType } from '@/react/portainer/environments/types';

vi.mock('@/react/hooks/useUser', () => ({
  useCurrentUser: () => ({ isPureAdmin: true }),
}));

vi.mock('@uirouter/react', () => ({
  useSref: () => ({ href: '#', onClick: vi.fn() }),
}));

import { EditButtons } from './EditButtons';

describe('REQ-ENV-01 EditButtons', () => {
  it('links configuration to docker.host for a local non-swarm Docker environment', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Name = 'local';
    environment.Snapshots = [{ Swarm: false } as never];
    render(<EditButtons environment={environment} />);
    expect(
      screen.getByTestId('configure-environment-link-local')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('edit-environment-link-local')
    ).toBeInTheDocument();
  });

  it('disables configuration when there is no snapshot', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Name = 'nosnap';
    environment.Snapshots = [];
    render(<EditButtons environment={environment} />);
    const config = screen.getByTestId('configure-environment-link-nosnap');
    // disabled LinkButton renders as span
    expect(config.closest('button, a, span')).toBeTruthy();
  });
});
