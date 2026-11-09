import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createColumnHelper } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import { Clock } from 'lucide-react';

import {
  EditableDatatable,
  NEW_ROW_ID,
  UNSET_EDITABLE_ROW,
} from './EditableDatatable';
import { actionsColumn, isIdForNewRow } from './actionsColumn';
import { isEditableTableMeta } from './isEditableTableMeta';

type Row = { Id: number; Name: string };

const settings = {
  sortBy: { id: 'Name', desc: false },
  setSortBy: vi.fn(),
  search: '',
  setSearch: vi.fn(),
  pageSize: 10,
  setPageSize: vi.fn(),
};

const columnHelper = createColumnHelper<Row>();

function nameColumn() {
  return columnHelper.accessor('Name', {
    header: 'Name',
    cell: ({ row: { original, index }, table }) => {
      if (!isEditableTableMeta(table.options.meta)) {
        return null;
      }
      const editableRowIndex = table.options.meta.getEditableRow();
      if (index === editableRowIndex || isIdForNewRow(original.Id)) {
        return (
          <input
            aria-label={`name-${index}`}
            value={original.Name}
            onChange={(e) =>
              table.options.meta!.updateRow(index, {
                ...original,
                Name: e.target.value,
              })
            }
          />
        );
      }
      return <div>{original.Name}</div>;
    },
  });
}

describe('isIdForNewRow (backwards compatibility)', () => {
  it('treats NEW_ROW_ID and lower as new rows', () => {
    expect(NEW_ROW_ID).toBe(-1);
    expect(UNSET_EDITABLE_ROW).toBe(-1);
    expect(isIdForNewRow(-1)).toBe(true);
    expect(isIdForNewRow(-2)).toBe(true);
    expect(isIdForNewRow(0)).toBe(false);
    expect(isIdForNewRow(1)).toBe(false);
  });
});

describe('EditableDatatable and actionsColumn (backwards compatibility)', () => {
  it('renders rows and edits an existing row then accepts to leave edit mode', async () => {
    const user = userEvent.setup();
    const acceptRow = vi.fn();
    const revertRow = vi.fn();
    const onRemove = vi.fn();
    const dataset: Row[] = [
      { Id: 1, Name: 'Alpha' },
      { Id: 2, Name: 'Beta' },
    ];

    render(
      <EditableDatatable
        dataset={dataset}
        columns={[nameColumn(), actionsColumn(onRemove)]}
        settingsManager={settings}
        title="Editable"
        titleIcon={Clock}
        data-cy="editable"
        disableSelect
        acceptRow={acceptRow}
        revertRow={revertRow}
      />
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    const input = await screen.findByLabelText('name-0');
    expect(input).toHaveValue('Alpha');
    await user.clear(input);
    await user.type(input, 'Alpha2');
    expect(input).toHaveValue('Alpha2');

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(acceptRow).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha2')).toBeInTheDocument();
    expect(screen.queryByLabelText('name-0')).not.toBeInTheDocument();
  });

  it('reverts an existing edited row to the original data', async () => {
    const user = userEvent.setup();
    const dataset: Row[] = [{ Id: 1, Name: 'Alpha' }];

    render(
      <EditableDatatable
        dataset={dataset}
        columns={[nameColumn(), actionsColumn(vi.fn())]}
        settingsManager={settings}
        data-cy="editable"
        disableSelect
        acceptRow={vi.fn()}
        revertRow={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByLabelText('name-0');
    await user.clear(input);
    await user.type(input, 'Changed');
    await user.click(screen.getByRole('button', { name: 'Revert' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('accepts and reverts a new row through the parent callbacks', async () => {
    const user = userEvent.setup();
    const acceptRow = vi.fn();
    const revertRow = vi.fn();
    const dataset: Row[] = [{ Id: NEW_ROW_ID, Name: 'Draft' }];

    render(
      <EditableDatatable
        dataset={dataset}
        columns={[nameColumn(), actionsColumn(vi.fn())]}
        settingsManager={settings}
        data-cy="editable"
        disableSelect
        acceptRow={acceptRow}
        revertRow={revertRow}
      />
    );

    expect(screen.getByLabelText('name-0')).toHaveValue('Draft');
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(acceptRow).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole('button', { name: 'Revert' }));
    expect(revertRow).toHaveBeenCalledWith(0);
  });

  it('removes a row and disables Edit while another row is being edited', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const dataset: Row[] = [
      { Id: 1, Name: 'Alpha' },
      { Id: 2, Name: 'Beta' },
    ];

    render(
      <EditableDatatable
        dataset={dataset}
        columns={[nameColumn(), actionsColumn(onRemove)]}
        settingsManager={settings}
        data-cy="editable"
        disableSelect
        acceptRow={vi.fn()}
        revertRow={vi.fn()}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith({ Id: 2, Name: 'Beta' });

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const remainingEdit = screen.getByRole('button', { name: 'Edit' });
    expect(remainingEdit).toBeDisabled();
  });

  it('throws when actionsColumn is used without editable table meta', () => {
    const column = actionsColumn<Row>(vi.fn());
    expect(() =>
      // force the cell renderer with a non-editable meta
      (
        column.cell as (ctx: {
          row: { original: Row; index: number };
          table: { options: { meta: unknown } };
        }) => unknown
      )({
        row: { original: { Id: 1, Name: 'x' }, index: 0 },
        table: { options: { meta: {} } },
      })
    ).toThrow(/actionsColumn\(\) should be used within the EditableDatatable/);
  });

  it('defaultIsNewRow returns false for objects without a numeric Id', () => {
    const column = actionsColumn<{ name: string }>(vi.fn());
    const meta = {
      getEditableRow: () => -1,
      getEditableRowOriginalData: () => undefined,
      editRow: vi.fn(),
      updateRow: vi.fn(),
      revertRow: vi.fn(),
      acceptRow: vi.fn(),
    };
    const cell = column.cell as unknown as (ctx: {
      row: { original: { name: string }; index: number };
      table: { options: { meta: typeof meta } };
    }) => unknown;
    expect(
      cell({
        row: { original: { name: 'no-id' }, index: 0 },
        table: { options: { meta } },
      })
    ).toBeTruthy();
  });

  it('syncs dataset prop changes into local table data', () => {
    const { rerender } = render(
      <EditableDatatable
        dataset={[{ Id: 1, Name: 'Old' }]}
        columns={[nameColumn(), actionsColumn(vi.fn())]}
        settingsManager={settings}
        data-cy="editable"
        disableSelect
        acceptRow={vi.fn()}
        revertRow={vi.fn()}
      />
    );
    expect(screen.getByText('Old')).toBeInTheDocument();
    rerender(
      <EditableDatatable
        dataset={[{ Id: 1, Name: 'New' }]}
        columns={[nameColumn(), actionsColumn(vi.fn())]}
        settingsManager={settings}
        data-cy="editable"
        disableSelect
        acceptRow={vi.fn()}
        revertRow={vi.fn()}
      />
    );
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
