import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { stack as stackColumn } from './stack';

describe('REQ-CTR-01 containers datatable stack column', () => {
  it('exports a stack accessor that falls back to a dash', () => {
    expect(stackColumn.id).toBe('stack');
    expect(stackColumn.header).toBe('Stack');

    const accessor = stackColumn.accessorFn as (
      row: ContainerListViewModel
    ) => string;

    expect(
      accessor({
        StackName: 'frontend',
        Status: ContainerStatus.Running,
      } as ContainerListViewModel)
    ).toBe('frontend');
    expect(
      accessor({
        StackName: undefined,
        Status: ContainerStatus.Running,
      } as ContainerListViewModel)
    ).toBe('-');
  });
});
