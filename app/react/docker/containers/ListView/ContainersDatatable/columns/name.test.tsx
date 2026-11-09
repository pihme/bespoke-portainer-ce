import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CellContext } from '@tanstack/react-table';

import { TableSettingsProvider } from '@@/datatables/useTableSettings';
import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { createStore } from '../datatable-store';

import { NameCell, name as nameColumn } from './name';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useSref: () => ({ href: '#container', onClick: vi.fn() }),
}));

function createContainer(
  overrides: Partial<ContainerListViewModel> = {}
): ContainerListViewModel {
  return {
    Id: 'cid-1',
    Names: ['very-long-container-name-that-should-truncate'],
    Image: 'nginx:latest',
    ImageID: 'sha256:abc',
    Command: 'nginx',
    Created: 1704067200,
    Ports: [],
    Labels: {},
    State: 'running',
    Status: ContainerStatus.Running,
    StatusText: 'Up',
    HostConfig: {},
    Mounts: [],
    NodeName: 'node',
    IP: '1.2.3.4',
    Gpus: '',
    ...overrides,
  } as ContainerListViewModel;
}

function renderNameCell(truncate: number, containerName: string) {
  const key = `name-col-${Date.now()}-${Math.random()}`;
  const store = createStore(key);
  store.getState().setTruncateContainerName(truncate);
  const container = createContainer({ Names: [containerName] });

  const ctx = {
    getValue: () => containerName,
    row: { original: container },
  } as unknown as CellContext<ContainerListViewModel, string>;

  return render(
    <TableSettingsProvider settings={store}>
      <NameCell {...ctx} />
    </TableSettingsProvider>
  );
}

describe('REQ-CTR-01 containers datatable name column', () => {
  it('exports a name accessor column', () => {
    expect(nameColumn.id).toBe('name');
    expect(nameColumn.header).toBe('Name');
  });

  it('truncates long names when truncate length is positive', () => {
    renderNameCell(10, 'abcdefghijklmnop');
    expect(screen.getByTitle('abcdefghijklmnop')).toHaveTextContent(
      'abcdefg...'
    );
  });

  it('shows the full name when truncate is disabled', () => {
    renderNameCell(0, 'full-container-name');
    expect(screen.getByTitle('full-container-name')).toHaveTextContent(
      'full-container-name'
    );
  });
});
