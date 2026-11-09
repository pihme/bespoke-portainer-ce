import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { ip as ipColumn } from './ip';

describe('REQ-CTR-01 containers datatable ip column', () => {
  it('exports an ip accessor that falls back to a dash', () => {
    expect(ipColumn.id).toBe('ip');
    expect(ipColumn.header).toBe('IP Address');

    const accessor = ipColumn.accessorFn as (
      row: ContainerListViewModel
    ) => string;

    expect(
      accessor({
        IP: '10.0.0.5',
        Status: ContainerStatus.Running,
      } as ContainerListViewModel)
    ).toBe('10.0.0.5');
    expect(
      accessor({
        IP: '',
        Status: ContainerStatus.Running,
      } as ContainerListViewModel)
    ).toBe('-');
  });
});
