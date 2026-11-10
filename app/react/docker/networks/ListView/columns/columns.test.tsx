import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

import { DecoratedNetwork } from '../types';

import { columnHelper } from './helper';
import { name } from './name';

import { useColumns } from './index';

vi.mock('@@/datatables/expand-column', () => ({
  buildExpandColumn: () => ({ id: 'expand', header: '' }),
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
    title,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
    title?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy} title={title}>
      {children}
    </a>
  ),
}));

function network(partial: Partial<DecoratedNetwork> = {}): DecoratedNetwork {
  return {
    Id: 'net-1',
    Name: 'bridge',
    Scope: 'local',
    Driver: 'bridge',
    Attachable: false,
    Internal: false,
    Ingress: false,
    Labels: {},
    Subs: [],
    ...partial,
  } as DecoratedNetwork;
}

describe('networks ListView columns', () => {
  it('exports a typed column helper', () => {
    expect(columnHelper).toBeDefined();
    expect(typeof columnHelper.accessor).toBe('function');
  });

  it('builds local columns without a Node column', () => {
    const { result } = renderHook(() => useColumns());
    const headers = result.current.map((c) =>
      typeof c.header === 'string' ? c.header : (c as { id?: string }).id
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        'Name',
        'Stack',
        'Driver',
        'Attachable',
        'IPAM Driver',
        'IPV4 IPAM Subnet',
        'IPV4 IPAM Gateway',
        'IPV6 IPAM Subnet',
        'IPV6 IPAM Gateway',
      ])
    );
    expect(headers).not.toContain('Node');
    // REQ-TAI-001: no ownership column
    expect(headers).not.toContain('Ownership');
  });

  it('REQ-TAI-017 useColumns takes no Swarm host column switch', () => {
    expect(useColumns.length).toBe(0);
  });

  it('formats stack and IPAM accessors with fallbacks', () => {
    const { result } = renderHook(() => useColumns());
    const byHeader = (header: string) =>
      result.current.find((c) => c.header === header) as {
        accessorFn?: (item: DecoratedNetwork) => unknown;
      };

    expect(byHeader('Stack').accessorFn?.(network({ StackName: 'web' }))).toBe(
      'web'
    );
    expect(byHeader('Stack').accessorFn?.(network({ StackName: undefined }))).toBe(
      '-'
    );

    const withIpam = network({
      IPAM: {
        Driver: 'default',
        IPV4Configs: [{ Subnet: '172.17.0.0/16', Gateway: '172.17.0.1' }],
        IPV6Configs: [{ Subnet: 'fd00::/64', Gateway: 'fd00::1' }],
      },
    } as Partial<DecoratedNetwork>);
    expect(byHeader('IPV4 IPAM Subnet').accessorFn?.(withIpam)).toBe(
      '172.17.0.0/16'
    );
    expect(byHeader('IPV4 IPAM Gateway').accessorFn?.(withIpam)).toBe(
      '172.17.0.1'
    );
    expect(byHeader('IPV6 IPAM Subnet').accessorFn?.(withIpam)).toBe('fd00::/64');
    expect(byHeader('IPV6 IPAM Gateway').accessorFn?.(withIpam)).toBe('fd00::1');

    const empty = network({ IPAM: { Driver: 'default' } } as Partial<DecoratedNetwork>);
    expect(byHeader('IPV4 IPAM Subnet').accessorFn?.(empty)).toBe('-');
    expect(byHeader('IPV4 IPAM Gateway').accessorFn?.(empty)).toBe('-');
    expect(byHeader('IPV6 IPAM Subnet').accessorFn?.(empty)).toBe('-');
    expect(byHeader('IPV6 IPAM Gateway').accessorFn?.(empty)).toBe('-');
  });

  it('renders the name link and System badge when resource control marks system', () => {
    const cell = name.cell as (ctx: {
      row: { original: DecoratedNetwork };
    }) => React.ReactNode;

    const { unmount } = render(
      <>
        {cell({
          row: {
            original: network({
              Name: 'a-very-long-network-name-that-should-be-truncated-for-display',
              NodeName: 'node-a',
              ResourceControl: { System: true } as never,
            }),
          },
        })}
      </>
    );
    expect(
      screen.getByTestId(
        'network-link-a-very-long-network-name-that-should-be-truncated-for-display'
      )
    ).toBeVisible();
    expect(screen.getByText('System')).toBeVisible();
    unmount();

    render(
      <>
        {cell({
          row: {
            original: network({ Name: 'bridge' }),
          },
        })}
      </>
    );
    expect(screen.getByTestId('network-link-bridge')).toBeVisible();
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });
});
