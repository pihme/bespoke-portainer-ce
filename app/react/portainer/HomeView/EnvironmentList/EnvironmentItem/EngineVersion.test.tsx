import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import {
  ContainerEngine,
  EnvironmentType,
} from '@/react/portainer/environments/types';

import { EngineVersion } from './EngineVersion';

describe('REQ-ENV-01 EngineVersion', () => {
  it('shows the Docker engine version from the snapshot', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Snapshots = [
      { Swarm: false, DockerVersion: '24.0.5' } as never,
    ];
    render(<EngineVersion environment={environment} />);
    expect(screen.getByText(/24\.0\.5/)).toBeVisible();
  });

  it('returns null when a Docker environment has no snapshot', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Snapshots = [];
    const { container } = render(<EngineVersion environment={environment} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Podman type when the container engine is Podman', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.ContainerEngine = ContainerEngine.Podman;
    environment.Snapshots = [
      { Swarm: false, DockerVersion: '4.0.0' } as never,
    ];
    render(<EngineVersion environment={environment} />);
    expect(screen.getByText(/4\.0\.0/)).toBeVisible();
  });
});
