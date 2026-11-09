import { render, screen } from '@testing-library/react';

import { humanize } from '@/portainer/filters/filters';

import { SnapshotStats } from './EnvironmentInfo.SnapshotStats';
import { DockerSnapshot } from '../snapshots/types';

function snapshot(
  overrides: Partial<DockerSnapshot> = {}
): DockerSnapshot {
  return {
    ContainerCount: 0,
    DockerVersion: '24.0.0',
    GpuUseAll: false,
    GpuUseList: [],
    HealthyContainerCount: 0,
    ImageCount: 0,
    IsPodman: false,
    NodeCount: 1,
    RunningContainerCount: 0,
    ServiceCount: 0,
    StackCount: 0,
    StoppedContainerCount: 0,
    Swarm: false,
    Time: 0,
    TotalCPU: 4,
    TotalMemory: 2147483648,
    UnhealthyContainerCount: 0,
    VolumeCount: 0,
    ...overrides,
  };
}

describe('REQ-ENV-02 SnapshotStats', () => {
  it('renders nothing when snapshot is undefined', () => {
    const { container } = render(<SnapshotStats snapshot={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders CPU count and humanized memory from the snapshot', () => {
    const snap = snapshot({ TotalCPU: 8, TotalMemory: 2147483648 });
    const humanized = humanize(snap.TotalMemory);
    if (humanized === undefined) {
      throw new Error('Expected humanize(TotalMemory) to return a value');
    }

    render(<SnapshotStats snapshot={snap} />);

    expect(screen.getByText('8')).toBeVisible();
    expect(screen.getByText(humanized)).toBeVisible();
  });
});
