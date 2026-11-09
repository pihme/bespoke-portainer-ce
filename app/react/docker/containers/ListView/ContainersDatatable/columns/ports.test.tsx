import { render, screen } from '@testing-library/react';
import { CellContext } from '@tanstack/react-table';

import { createMockEnvironment } from '@/react-tools/test-mocks';
import {
  ContainerListViewModel,
  ContainerStatus,
  Port,
} from '@/react/docker/containers/types';

import { RowProvider } from '../RowContext';

import { ports as portsColumn } from './ports';

function renderPortsCell(ports: Port[], publicURL?: string) {
  const Cell = portsColumn.cell as React.FC<
    CellContext<ContainerListViewModel, string>
  >;
  const container = {
    Id: 'c1',
    Names: ['c'],
    Status: ContainerStatus.Running,
    Ports: ports,
  } as ContainerListViewModel;

  const ctx = {
    row: { original: container },
  } as unknown as CellContext<ContainerListViewModel, string>;

  return render(
    <RowProvider
      context={{
        environment: createMockEnvironment({
          Id: 1,
          PublicURL: publicURL ?? '',
        }),
      }}
    >
      <Cell {...ctx} />
    </RowProvider>
  );
}

describe('REQ-CTR-01 containers datatable ports column', () => {
  it('exports a ports accessor column', () => {
    expect(portsColumn.id).toBe('ports');
    expect(portsColumn.header).toBe('Published Ports');
  });

  it('renders a dash when there are no published ports', () => {
    renderPortsCell([]);
    expect(screen.getByText('-')).toBeVisible();
  });

  it('renders published port links for a few ports', () => {
    renderPortsCell(
      [
        { host: '0.0.0.0', public: 8080, private: 80 },
        { host: '0.0.0.0', public: 8443, private: 443 },
      ],
      'example.com'
    );

    expect(screen.getAllByTestId('published-port-link')).toHaveLength(2);
  });

  it('collapses ports beyond the visible limit behind a badge', () => {
    renderPortsCell(
      [
        { host: '0.0.0.0', public: 1, private: 1 },
        { host: '0.0.0.0', public: 2, private: 2 },
        { host: '0.0.0.0', public: 3, private: 3 },
        { host: '0.0.0.0', public: 4, private: 4 },
        { host: '0.0.0.0', public: 5, private: 5 },
      ],
      'host.local'
    );

    expect(screen.getAllByTestId('published-port-link')).toHaveLength(3);
    expect(screen.getByText('+2 more')).toBeVisible();
  });

  it('deduplicates ports by public port in the accessor', () => {
    const accessor = portsColumn.accessorFn as (
      row: ContainerListViewModel
    ) => string;
    const value = accessor({
      Ports: [
        { host: '0.0.0.0', public: 80, private: 80 },
        { host: '::', public: 80, private: 80 },
        { host: '0.0.0.0', public: 443, private: 443 },
      ],
    } as ContainerListViewModel);

    expect(value).toBe('80:80,443:443');
  });
});
