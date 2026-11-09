import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnvironmentStatus, EnvironmentType } from '@/react/portainer/environments/types';

import { EnvironmentsDatatable } from './EnvironmentsDatatable';

const useEnvironmentList = vi.fn();
const useGroups = vi.fn();
const useTableState = vi.fn();

vi.mock('@/react/portainer/environments/queries', () => ({
  useEnvironmentList: (...args: unknown[]) => useEnvironmentList(...args),
}));
vi.mock('@/react/portainer/environments/environment-groups/queries', () => ({
  useGroups: (...args: unknown[]) => useGroups(...args),
}));
vi.mock('@@/datatables/types', () => ({
  createPersistedStore: () => ({}),
}));
vi.mock('@@/datatables/useTableState', () => ({
  useTableState: (...args: unknown[]) => useTableState(...args),
}));
vi.mock('../../feature-flags/feature-flags.service', () => ({
  isBE: false,
}));
vi.mock('../queries/useEnvironmentList', () => ({
  isSortType: (id?: string) => id === 'Name',
}));
vi.mock('./columns', () => ({
  columns: [{ id: 'Name', header: 'Name' }],
}));
vi.mock('@@/datatables', () => ({
  Datatable: ({
    dataset,
    renderTableActions,
    isRowSelectable,
    onPageChange,
  }: {
    dataset: Array<{ Name: string; Status: number }>;
    renderTableActions: (rows: unknown[]) => React.ReactNode;
    isRowSelectable: (row: { original: { Status: number } }) => boolean;
    onPageChange: (page: number) => void;
  }) => (
    <div>
      {dataset.map((env) => (
        <div key={env.Name}>{env.Name}</div>
      ))}
      <div data-cy="selectable">
        {String(
          isRowSelectable({
            original: { Status: EnvironmentStatus.Active },
          })
        )}
        /
        {String(
          isRowSelectable({
            original: { Status: EnvironmentStatus.Provisioning },
          })
        )}
      </div>
      <button type="button" onClick={() => onPageChange(1)}>
        Next page
      </button>
      {renderTableActions([{ Name: 'local' }])}
    </div>
  ),
}));
vi.mock('@@/buttons', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AddButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

describe('REQ-ENV-03 EnvironmentsDatatable for local Docker environments', () => {
  beforeEach(() => {
    useTableState.mockReturnValue({
      search: '',
      pageSize: 10,
      sortBy: { id: 'Name', desc: false },
    });
    useGroups.mockReturnValue({
      isSuccess: true,
      data: [{ Id: 1, Name: 'default' }],
    });
    useEnvironmentList.mockReturnValue({
      environments: [
        {
          Id: 1,
          Name: 'local',
          GroupId: 1,
          Type: EnvironmentType.Docker,
          Status: EnvironmentStatus.Active,
        },
      ],
      isLoading: false,
      totalCount: 1,
    });
  });

  it('lists environments with their group names and add action', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<EnvironmentsDatatable onRemove={onRemove} />);

    expect(screen.getByText('local')).toBeVisible();
    expect(screen.getByText('Add environment')).toBeVisible();
    expect(screen.queryByText('Auto onboarding')).toBeNull();
    expect(screen.getByTestId('selectable')).toHaveTextContent('true/false');

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith([{ Name: 'local' }]);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(useEnvironmentList).toHaveBeenCalled();
  });
});
