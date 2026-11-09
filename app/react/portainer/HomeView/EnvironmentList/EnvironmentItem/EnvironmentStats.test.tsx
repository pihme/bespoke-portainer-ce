import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { EnvironmentStats } from './EnvironmentStats';

describe('REQ-ENV-01 EnvironmentStats', () => {
  it('renders Docker stats for a local Docker environment', () => {
    const environment = createMockEnvironment();
    environment.Type = EnvironmentType.Docker;
    environment.Snapshots = [
      {
        ContainerCount: 2,
        RunningContainerCount: 1,
        StoppedContainerCount: 1,
        NodeCount: 1,
        TotalCPU: 2,
        TotalMemory: 1024,
      } as never,
    ];
    render(<EnvironmentStats environment={environment} />);
    expect(screen.getByText('1 / 2')).toBeVisible();
  });
});
