import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NodeViewModel } from '@/docker/models/node';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';

import { MacvlanNodesSelector } from './MacvlanNodesSelector';
import { useColumns } from './useColumns';

vi.mock('@/react/docker/swarm/SwarmView/NodesDatatable/columns', () => ({
  name: { id: 'name', header: 'Name', accessorKey: 'Hostname' },
  role: { id: 'role', header: 'Role', accessorKey: 'Role' },
  engine: { id: 'engine', header: 'Engine', accessorKey: 'EngineVersion' },
  ip: { id: 'ip', header: 'IP Address', accessorKey: 'IPAddress' },
  status: { id: 'status', header: 'Status', accessorKey: 'Status' },
}));

function node(overrides: Partial<NodeViewModel> = {}): NodeViewModel {
  return {
    Id: 'node-1',
    Hostname: 'worker-1',
    Role: 'worker',
    EngineVersion: '24.0',
    Status: 'ready',
    IPAddress: '10.0.0.1',
    ...overrides,
  } as NodeViewModel;
}

function renderSelector(
  props: Partial<React.ComponentProps<typeof MacvlanNodesSelector>> = {}
) {
  const Wrapped = withTestQueryProvider(
    withUserProvider(
      withTestRouter(() => (
        <MacvlanNodesSelector
          dataset={[node()]}
          isIpColumnVisible
          haveAccessToNode
          value={[]}
          onChange={() => {}}
          {...props}
        />
      ))
    )
  );
  return render(<Wrapped />);
}

describe('MacvlanNodesSelector', () => {
  it('renders the nodes table title and loading empty dataset', () => {
    renderSelector({ dataset: undefined });
    expect(
      screen.getByText(
        'Select the nodes where you want to deploy the local configuration'
      )
    ).toBeVisible();
  });


  it('selects nodes via the controlled selection callback', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelector({ onChange, value: [] });
    // Datatable select-all or row checkbox
    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalled();
  });


  it('maps selected values with empty Id to empty strings', () => {
    renderSelector({
      value: [node({ Id: '' })],
      dataset: [node({ Id: 'node-1' }), node({ Id: '', Hostname: 'empty' })],
    });
    expect(screen.getByText('worker-1')).toBeVisible();
  });

  it('renders rows when a dataset is provided', () => {
    renderSelector();
    expect(screen.getByText('worker-1')).toBeVisible();
  });
});

describe('useColumns', () => {
  it('includes the IP column only when visible', () => {
    function Probe({ showIp }: { showIp: boolean }) {
      const cols = useColumns(showIp);
      return <div data-cy="cols">{cols.map((c) => c.id).join(',')}</div>;
    }
    const { rerender } = render(<Probe showIp />);
    expect(screen.getByTestId('cols')).toHaveTextContent('name,role,engine,ip,status');
    rerender(<Probe showIp={false} />);
    expect(screen.getByTestId('cols')).toHaveTextContent(
      'name,role,engine,status'
    );
  });
});
