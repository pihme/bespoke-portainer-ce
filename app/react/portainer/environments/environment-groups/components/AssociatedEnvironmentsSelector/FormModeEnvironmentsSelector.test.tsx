import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { FormModeEnvironmentsSelector } from './FormModeEnvironmentsSelector';
import { EnvironmentTableData } from './types';

vi.mock('./AssociatedEnvironmentsTable', () => ({
  AssociatedEnvironmentsTable: ({
    environments,
    onRemove,
    onOpenAddDrawer,
  }: {
    environments: EnvironmentTableData[];
    onRemove: (envs: EnvironmentTableData[]) => void;
    onOpenAddDrawer: () => void;
  }) => (
    <div>
      <div data-cy="form-mode-envs">
        {environments.map((e) => e.Name).join(',')}
      </div>
      <button type="button" data-cy="open-drawer" onClick={onOpenAddDrawer}>
        add
      </button>
      <button
        type="button"
        data-cy="remove-env"
        onClick={() => onRemove(environments)}
      >
        remove
      </button>
    </div>
  ),
}));

vi.mock('./AddEnvironmentsDrawer', () => ({
  AddEnvironmentsDrawer: ({
    open,
    onAdd,
    onClose,
  }: {
    open: boolean;
    onAdd: (envs: EnvironmentTableData[]) => void;
    onClose: () => void;
  }) =>
    open ? (
      <div>
        <button
          type="button"
          data-cy="drawer-add"
          onClick={() =>
            onAdd([{ Id: 5, Name: 'env-5' }])
          }
        >
          drawer-add
        </button>
        <button type="button" data-cy="drawer-close" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));

describe('FormModeEnvironmentsSelector', () => {
  it('updates local selection within a single mount', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let selectedIds: number[] = [];
    function Harness() {
      return (
        <FormModeEnvironmentsSelector
          selectedIds={selectedIds}
          onChange={(ids) => {
            selectedIds = ids;
            onChange(ids);
          }}
        />
      );
    }
    const Wrapped = withTestQueryProvider(Harness);
    const { rerender } = render(<Wrapped />);

    await user.click(screen.getByTestId('open-drawer'));
    await user.click(screen.getByTestId('drawer-add'));
    expect(onChange).toHaveBeenLastCalledWith([5]);
    rerender(<Wrapped />);
    expect(screen.getByTestId('form-mode-envs')).toHaveTextContent('env-5');

    await user.click(screen.getByTestId('remove-env'));
    expect(onChange).toHaveBeenLastCalledWith([]);
    await user.click(screen.getByTestId('drawer-close'));
  });
});
