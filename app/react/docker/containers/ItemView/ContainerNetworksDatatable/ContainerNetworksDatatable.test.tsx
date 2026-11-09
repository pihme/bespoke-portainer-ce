import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useAuthorizations: () => ({ authorized: true }),
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mutateConnect = vi.fn();
vi.mock('@/react/docker/networks/queries/useConnectContainerMutation', () => ({
  useConnectContainerMutation: () => ({
    mutate: mutateConnect,
    isLoading: false,
  }),
}));

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

vi.mock('../../components/NetworkSelector', () => ({
  NetworkSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      aria-label="network"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">pick</option>
      <option value="net-1">net-1</option>
    </select>
  ),
}));

vi.mock('@@/datatables/ExpandableDatatable', () => ({
  ExpandableDatatable: ({
    dataset,
    description,
    title,
  }: {
    dataset: Array<{ name: string }>;
    description?: React.ReactNode;
    title: string;
  }) => (
    <div>
      <h2>{title}</h2>
      <ul>
        {dataset.map((n) => (
          <li key={n.name}>{n.name}</li>
        ))}
      </ul>
      {description}
    </div>
  ),
}));

vi.mock('@@/datatables/useTableState', () => ({
  useTableState: () => ({ pageSize: 10 }),
}));

vi.mock('@@/datatables/types', () => ({
  createPersistedStore: () => ({}),
}));

vi.mock('@@/datatables/extend-options/withMeta', () => ({
  withMeta: () => ({}),
}));
vi.mock('@@/datatables/extend-options/mergeOptions', () => ({
  mergeOptions: () => () => ({}),
}));

import { ContainerNetworksDatatable } from './ContainerNetworksDatatable';
import { buildColumns } from './columns';
import { ConnectNetworkForm } from './ConnectNetworkForm';

describe('REQ-CTR-04 ContainerNetworksDatatable for local containers', () => {
  beforeEach(() => {
    mutateConnect.mockReset();
  });

  it('maps defined networks into the table dataset', () => {
    render(
      <ContainerNetworksDatatable
        containerId="c1"
        dataset={{
          bridge: {
            IPAddress: '172.17.0.2',
            Gateway: '172.17.0.1',
            MacAddress: 'aa:bb',
          } as never,
          empty: undefined,
        }}
      />
    );
    expect(screen.getByText('Connected Networks')).toBeInTheDocument();
    expect(screen.getByText('bridge')).toBeInTheDocument();
    expect(screen.queryByText('empty')).not.toBeInTheDocument();
  });

  it('buildColumns includes network IP gateway mac and actions', () => {
    const cols = buildColumns({ nodeName: 'n1' });
    const headers = cols.map((c) =>
      typeof c.header === 'string' ? c.header : c.id
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        'Network',
        'IP Address',
        'Gateway',
        'MAC Address',
        'Actions',
      ])
    );
  });

  it('ConnectNetworkForm joins the selected network', async () => {
    const user = userEvent.setup();
    render(
      <ConnectNetworkForm
        containerId="c1"
        selectedNetworks={['bridge']}
      />
    );
    await user.selectOptions(screen.getByLabelText('network'), 'net-1');
    await user.click(screen.getByRole('button', { name: /Join Network/i }));
    expect(mutateConnect).toHaveBeenCalledWith(
      { containerId: 'c1', networkId: 'net-1', nodeName: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});

describe('container network column accessors and leave action', () => {
  it('column accessors fall back to dash for empty IP gateway and MAC', () => {
    const cols = buildColumns();
    const ip = cols.find((c) => c.id === 'ip') as { accessorFn?: (r: object) => string };
    const gateway = cols.find((c) => c.id === 'gateway') as {
      accessorFn?: (r: object) => string;
    };
    const mac = cols.find((c) => c.id === 'macAddress') as {
      accessorFn?: (r: object) => string;
    };
    expect(ip.accessorFn?.({ IPAddress: '' })).toBe('-');
    expect(ip.accessorFn?.({ IPAddress: '1.2.3.4' })).toBe('1.2.3.4');
    expect(gateway.accessorFn?.({ Gateway: '' })).toBe('-');
    expect(mac.accessorFn?.({ MacAddress: 'aa' })).toBe('aa');
  });
});
