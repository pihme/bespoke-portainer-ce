import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { createElement, Fragment } from 'react';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { name } from './name';

import { useColumns } from './index';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

const isSwarmMock = vi.fn(() => false);
vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsSwarm: () => isSwarmMock(),
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy}>{children}</a>
  ),
}));

vi.mock('@@/datatables/Filter', () => ({
  MultipleSelectionFilter: ({
    menuTitle,
    options,
  }: {
    menuTitle: string;
    options: string[];
  }) => (
    <div data-cy="usage-filter">
      {menuTitle}:{options.join(',')}
    </div>
  ),
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe('REQ-VOL-01 volume table columns', () => {
  it('builds non-swarm columns including name stack driver mount created', () => {
    isSwarmMock.mockReturnValue(false);
    const Wrapper = withTestQueryProvider(({ children }) =>
      createElement(Fragment, null, children)
    );
    const { result } = renderHook(() => useColumns(), { wrapper: Wrapper });
    const headers = result.current.map((c) =>
      typeof c.header === 'string' ? c.header : (c as { id?: string }).id
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        'Name',
        'Stack',
        'Driver',
        'Mount point',
        'Created',
      ])
    );
    expect(headers).not.toContain('Host');
    // REQ-TAI-001: no ownership column
    expect(headers).not.toContain('Ownership');

    const mountCol = result.current.find((c) => c.header === 'Mount point') as {
      cell?: (p: never) => unknown;
      accessorFn?: (item: { Mountpoint: string }) => string;
    };
    expect(mountCol.accessorFn?.({ Mountpoint: '/var/lib/docker/volumes/x' })).toBe(
      '/var/lib/docker/volumes/x'
    );
    if (mountCol.cell) {
      const node = mountCol.cell({
        getValue: () => '/very/long/mount/point/path/here',
      } as never);
      render(<>{node as React.ReactNode}</>);
    }

    const createdCol = result.current.find((c) => c.header === 'Created') as {
      cell?: (p: never) => unknown;
    };
    if (createdCol?.cell) {
      const node = createdCol.cell({
        getValue: () => '2020-01-01T00:00:00Z',
      } as never);
      render(<>{node as React.ReactNode}</>);
    }

    const stackCol = result.current.find((c) => c.header === 'Stack') as {
      accessorFn?: (item: { StackName?: string }) => string;
    };
    expect(stackCol.accessorFn?.({ StackName: '' })).toBe('-');
    expect(stackCol.accessorFn?.({ StackName: 'web' })).toBe('web');
  });

  it('includes Host column when swarm is enabled', () => {
    isSwarmMock.mockReturnValue(true);
    const Wrapper = withTestQueryProvider(({ children }) =>
      createElement(Fragment, null, children)
    );
    const { result } = renderHook(() => useColumns(), { wrapper: Wrapper });
    const headers = result.current.map((c) =>
      typeof c.header === 'string' ? c.header : (c as { id?: string }).id
    );
    expect(headers).toContain('Host');
    const hostCol = result.current.find((c) => c.header === 'Host') as {
      accessorFn?: (item: { NodeName?: string }) => string;
    };
    expect(hostCol.accessorFn?.({})).toBe('-');
    expect(hostCol.accessorFn?.({ NodeName: 'n1' })).toBe('n1');
  });

  it('filters used and unused volumes by dangling flag', () => {
    const filterFn = name.filterFn!;
    expect(
      filterFn({ original: { dangling: false } } as never, 'name', [])
    ).toBe(true);
    expect(
      filterFn({ original: { dangling: false } } as never, 'name', ['Used'])
    ).toBe(true);
    expect(
      filterFn({ original: { dangling: true } } as never, 'name', ['Unused'])
    ).toBe(true);
    expect(
      filterFn({ original: { dangling: true } } as never, 'name', ['Used'])
    ).toBe(false);
  });

  it('renders the name cell with unused badge', () => {
    const Cell = name.cell as (props: never) => JSX.Element;
    render(
      Cell({
        getValue: () => 'vol-long-name',
        row: {
          original: { Name: 'vol-long-name', dangling: true, NodeName: '' },
        },
        table: {
          options: { meta: { table: 'volumes', isBrowseVisible: false } },
        },
      } as never)
    );
    expect(screen.getByTestId('volume-link-vol-long-name')).toBeVisible();
    expect(screen.getByText(/Unused/i)).toBeVisible();
  });

  it('renders browse action when browse is visible', () => {
    const Cell = name.cell as (props: never) => JSX.Element;
    render(
      Cell({
        getValue: () => 'vol',
        row: { original: { Name: 'vol', dangling: false, NodeName: 'n1' } },
        table: {
          options: { meta: { table: 'volumes', isBrowseVisible: true } },
        },
      } as never)
    );
    expect(screen.getByTestId('volume-browse-button-vol')).toBeVisible();
  });

  it('renders usage filter control from column meta', () => {
    const Filter = (name.meta as { filter: (p: never) => JSX.Element }).filter;
    render(
      Filter({
        column: {
          id: 'name',
          getFilterValue: () => [],
          setFilterValue: vi.fn(),
        },
      } as never)
    );
    expect(screen.getByTestId('usage-filter')).toHaveTextContent(
      /Filter by usage/
    );
  });
});
