import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EnvironmentStatsDocker } from './EnvironmentStatsDocker';

describe('REQ-ENV-01 EnvironmentStatsDocker', () => {
  it('shows a placeholder when no snapshot is available', () => {
    render(<EnvironmentStatsDocker />);
    expect(screen.getByText('No snapshot available')).toBeVisible();
  });

  it('renders container, node, CPU, and memory stats from a Docker snapshot', () => {
    render(
      <EnvironmentStatsDocker
        snapshot={{
          ContainerCount: 5,
          RunningContainerCount: 3,
          StoppedContainerCount: 2,
          NodeCount: 1,
          TotalCPU: 4,
          TotalMemory: 8 * 1024 * 1024 * 1024,
        } as never}
      />
    );
    expect(screen.getByText('3 / 5')).toBeVisible();
    expect(screen.getByText('NODES')).toBeVisible();
    expect(screen.getByText('CORES')).toBeVisible();
    expect(screen.getByText('MEMORY')).toBeVisible();
  });
});
