import { render, screen } from '@testing-library/react';

import { DetailsTable } from '@@/DetailsTable';

import { GpuInfo } from './EnvironmentInfo.GpuInfo';
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
    TotalMemory: 0,
    UnhealthyContainerCount: 0,
    VolumeCount: 0,
    ...overrides,
  };
}

function renderGpu(
  gpus: Array<{ name: string }>,
  snap?: DockerSnapshot
) {
  return render(
    <DetailsTable dataCy="gpu-info">
      <GpuInfo gpus={gpus} snapshot={snap} />
    </DetailsTable>
  );
}

describe('GpuInfo', () => {
  it('renders nothing when snapshot is missing', () => {
    const { container } = render(
      <DetailsTable dataCy="gpu-info">
        <GpuInfo gpus={[{ name: 'nvidia' }]} snapshot={undefined} />
      </DetailsTable>
    );
    expect(container.querySelector('tr')).toBeNull();
  });

  it('shows none when all GPUs are in use', () => {
    renderGpu([{ name: 'nvidia' }], snapshot({ GpuUseAll: true }));
    expect(screen.getByLabelText('GPU')).toBeVisible();
    expect(screen.getByText('none')).toBeVisible();
  });

  it('shows none when no GPUs are configured', () => {
    renderGpu([], snapshot({ GpuUseAll: false, GpuUseList: [] }));
    expect(screen.getByText('none')).toBeVisible();
  });

  it('lists free GPUs with counts when some are unused', () => {
    renderGpu(
      [{ name: 'A100' }, { name: 'A100' }, { name: 'T4' }],
      snapshot({ GpuUseAll: false, GpuUseList: ['T4'] })
    );

    expect(screen.getByLabelText('GPUs')).toBeVisible();
    // GpuUseList matches by name, so unused A100 instances are counted together
    expect(screen.getByText('2 x A100')).toBeVisible();
  });

  it('shows none when every configured GPU name is in use', () => {
    renderGpu(
      [{ name: 'A100' }, { name: 'T4' }],
      snapshot({ GpuUseAll: false, GpuUseList: ['A100', 'T4'] })
    );
    expect(screen.getByText('none')).toBeVisible();
  });

  it('uses singular GPU label when at most one GPU is configured', () => {
    renderGpu([{ name: 'T4' }], snapshot({ GpuUseList: [] }));
    expect(screen.getByLabelText('GPU')).toBeVisible();
    expect(screen.getByText('1 x T4')).toBeVisible();
  });
});
